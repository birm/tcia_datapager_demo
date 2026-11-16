#!/usr/bin/env python3
"""
General YAML-driven cube generator: flat tabular data + YAML config → mdhist JSON.

Works with any single-grain tabular dataset (CSV, Parquet, JSON).
Multi-table joins are a preprocessing concern (see preprocess_synthea.py for an example).

Usage:
  python generate.py --input data.parquet --config configs/synthea-omop.yaml --output out.json
  python generate.py --input data.csv     --config configs/my-dataset.yaml  --output out.json [--k-anon 5]

YAML config schema: see configs/synthea-omop.yaml for a documented example.
"""
import argparse
import json
from datetime import date
from pathlib import Path

import pandas as pd
import polars as pl
import yaml


def load_data(path: str) -> pl.LazyFrame:
    """Return a lazy scan of the input file. Data is not loaded until .collect() is called."""
    p = Path(path)
    suf = p.suffix.lower()
    if suf == '.parquet':
        return pl.scan_parquet(p)
    elif suf in ('.csv', '.gz'):
        return pl.scan_csv(p)
    elif suf == '.json':
        return pl.read_json(p).lazy()   # no scan_json in polars; JSON is typically small
    else:
        raise ValueError(f"Unsupported format: {suf}. Expected .parquet, .csv, .csv.gz, or .json")


def apply_top_n(series: pl.Series, top_n: int) -> pl.Series:
    """Keep top-N values by frequency; merge everything else into 'Other'."""
    if isinstance(series, pd.Series):
        series = pl.Series(series.name or "v", series)
    counts_df = series.value_counts(sort=True)
    top_values = counts_df[series.name].head(top_n).to_list()
    return (
        pl.DataFrame({series.name: series})
        .with_columns(
            pl.when(pl.col(series.name).is_in(top_values))
            .then(pl.col(series.name))
            .otherwise(pl.lit('Other'))
            .alias(series.name)
        )
    )[series.name]


COLUMNAR_THRESHOLD = 50_000  # auto-select columnar layout above this cell count


def generate_mdhist(df, config: dict, k_anon_override: int | None = None,
                    cell_format: str = 'auto') -> dict:
    # Accept pandas DataFrame, polars DataFrame, or polars LazyFrame.
    # The lazy path (LazyFrame from scan_parquet/scan_csv) keeps peak memory
    # bounded to O(one_row_group + n_output_cells) regardless of source file size.
    if isinstance(df, pd.DataFrame):
        lf = pl.from_pandas(df).lazy()
    elif isinstance(df, pl.DataFrame):
        lf = df.lazy()
    elif isinstance(df, pl.LazyFrame):
        lf = df
    else:
        raise TypeError(f"Expected DataFrame or LazyFrame, got {type(df)}")

    meta_cfg = config.get('meta', {})
    dim_specs = config.get('dimensions', [])
    measure_specs = config.get('measures', [])
    k_anon = k_anon_override if k_anon_override is not None else config.get('k_anon', 0)
    cell_limit = config.get('cell_limit', 500_000)

    # Capture original schema without executing the query
    source_columns = set(lf.collect_schema().names())

    # Apply top_n collapsing per dimension.
    # Each top_n step does a small partial scan (one column) to count frequencies,
    # then appends a lazy transform — no full-data load until the final .collect().
    for dim in dim_specs:
        field = dim['field']
        top_n = dim.get('top_n')
        if top_n and field in source_columns:
            top_values = (
                lf.select(pl.col(field).cast(pl.Utf8).alias(field))
                   .group_by(field)
                   .agg(pl.len().alias("_cnt"))
                   .sort("_cnt", descending=True)
                   .head(int(top_n))
                   .collect()[field].to_list()
            )
            lf = lf.with_columns(
                pl.when(pl.col(field).cast(pl.Utf8).is_in(top_values))
                .then(pl.col(field).cast(pl.Utf8))
                .otherwise(pl.lit('Other'))
                .alias(field)
            )

    # Identify available dimension fields and warn about missing ones
    dim_fields = []
    for dim in dim_specs:
        if dim['field'] in source_columns:
            dim_fields.append(dim['field'])
        else:
            print(f"  WARNING: dimension field '{dim['field']}' not found in data — skipping")

    if not dim_fields:
        raise ValueError("No dimension fields found in data. Check that column names match the YAML config.")

    # Build lazy plan: drop nulls, cast dimensions to string
    lf = lf.drop_nulls(subset=dim_fields)
    lf = lf.with_columns([pl.col(f).cast(pl.Utf8) for f in dim_fields])

    # Build agg expressions
    agg_exprs = []
    count_field = None
    sum_fields = []

    for m in measure_specs:
        if m['type'] == 'count':
            count_field = m['field']
            agg_exprs.append(pl.len().alias(m['field']))
        elif m['type'] == 'sum':
            if m['field'] in source_columns:
                agg_exprs.append(pl.col(m['field']).sum())
                sum_fields.append(m['field'])
            else:
                print(f"  WARNING: measure field '{m['field']}' not found in data — skipping")

    if not agg_exprs:
        raise ValueError("No valid measures configured. Add at least one measure to the YAML config.")

    # Execute the groupby. The lazy engine reads parquet row-group by row-group,
    # accumulating only the hash table — peak memory stays bounded regardless of n_rows.
    grouped = lf.group_by(dim_fields).agg(agg_exprs).collect()

    # Derive grand totals from the grouped output (before k-anon suppression).
    # sum(all cell counts) == total non-null rows; sum(all cell sums) == total column sum.
    # This is mathematically identical to the old int(len(df)) approach and avoids a
    # second pass over the data.
    totals: dict = {}
    if count_field:
        totals[count_field] = int(grouped[count_field].sum())
    for f in sum_fields:
        totals[f] = float(grouped[f].sum())

    n_before = len(grouped)
    if n_before > cell_limit:
        print(f"  WARNING: {n_before:,} cells exceeds cell_limit={cell_limit:,}. "
              f"Consider fewer or coarser dimensions.")

    # Apply k-anonymity suppression
    suppressed_rows = 0
    if k_anon > 0 and count_field:
        below = grouped.filter(pl.col(count_field) < k_anon)
        suppressed_rows = int(below[count_field].sum() or 0)
        grouped = grouped.filter(pl.col(count_field) >= k_anon)
        n_after = len(grouped)
        print(f"  K-anon k={k_anon}: dropped {n_before - n_after} cells, "
              f"suppressed {suppressed_rows:,} rows ({suppressed_rows/max(totals.get(count_field,1),1)*100:.1f}%)")

    # Build cells — row-oriented (v1) or columnar (v2)
    measure_fields_present = {m['field'] for m in measure_specs if m['field'] in grouped.columns}
    n_cells = len(grouped)
    use_columnar = (
        cell_format == 'columnar'
        or (cell_format == 'auto' and n_cells > COLUMNAR_THRESHOLD)
    )

    if use_columnar:
        # One list per column — avoids per-row Python dict allocation (3–5× faster at large counts)
        cells: dict = {}
        for f in dim_fields:
            cells[f] = grouped[f].to_list()
        for m in measure_specs:
            if m['field'] in measure_fields_present:
                series = grouped[m['field']]
                cells[m['field']] = (series if m['type'] == 'count' else series.round(4)).to_list()
    else:
        cells: list = []
        for row in grouped.to_dicts():
            cell = {f: row[f] for f in dim_fields}
            for m in measure_specs:
                if m['field'] in measure_fields_present:
                    v = row[m['field']]
                    cell[m['field']] = int(v) if m['type'] == 'count' else round(float(v), 4)
            cells.append(cell)

    # Build dimension definitions (preserve ordinal ordering from YAML)
    dim_defs = []
    for dim_spec in dim_specs:
        f = dim_spec['field']
        if f not in dim_fields:
            continue
        d = {
            'field': f,
            'label': dim_spec.get('label', f),
            'type': dim_spec.get('type', 'categorical'),
        }
        if 'values' in dim_spec:
            d['values'] = dim_spec['values']
        else:
            d['values'] = sorted(grouped[f].unique().to_list())
        if 'description' in dim_spec:
            d['description'] = dim_spec['description']
        dim_defs.append(d)

    measure_defs = []
    for m in measure_specs:
        if m['field'] not in grouped.columns:
            continue
        md = {'field': m['field'], 'label': m.get('label', m['field']), 'type': m['type']}
        if 'unit' in m:
            md['unit'] = m['unit']
        measure_defs.append(md)

    meta_out = {
        'name': meta_cfg.get('name', 'Dataset'),
        'description': meta_cfg.get('description', ''),
        'total_records': totals.get(count_field, 0),
        'generated_at': str(date.today()),
        'version': '1.0',
        'cube_type': meta_cfg.get('cube_type', 'sparse_full'),
    }
    if use_columnar:
        meta_out['format_version'] = 2

    mdhist = {
        'meta': meta_out,
        'dimensions': dim_defs,
        'measures': measure_defs,
        'cells': cells,
        'totals': totals,
    }

    for key in ('source_url', 'data_access', 'tables'):
        if key in meta_cfg:
            mdhist['meta'][key] = meta_cfg[key]

    return mdhist


def main():
    parser = argparse.ArgumentParser(
        description='Generate mdhist JSON from tabular data + YAML config.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate.py --input synthea_flat.parquet --config configs/synthea-omop.yaml --output ../../config/synthea-mdhist.json
  python generate.py --input data.csv --config configs/my-dataset.yaml --output out.json --k-anon 5
        """,
    )
    parser.add_argument('--input',   required=True, help='Input file (.csv, .parquet, .json)')
    parser.add_argument('--config',  required=True, help='YAML config file')
    parser.add_argument('--output',  required=True, help='Output mdhist JSON path')
    parser.add_argument('--k-anon',  type=int, default=None,
                        help='Override k-anonymity threshold (0 = off, default: from YAML)')
    parser.add_argument('--gzip', action='store_true',
                        help='Write output as gzip-compressed .json.gz (appends .gz if not already in path)')
    parser.add_argument('--format', choices=['json', 'columnar', 'auto'], default='auto',
                        help='Cell layout: json=row-oriented array-of-objects, '
                             'columnar=object-of-arrays (faster for >50K cells), '
                             'auto=columnar when cell_count>50000 (default)')
    args = parser.parse_args()

    print(f"Loading {args.input} (lazy scan)...")
    lf = load_data(args.input)
    print(f"  {len(lf.collect_schema().names())} columns — schema read, data not yet loaded")

    with open(args.config) as f:
        config = yaml.safe_load(f)

    print(f"Cubing with config '{config.get('meta', {}).get('name', args.config)}'...")
    mdhist = generate_mdhist(lf, config, k_anon_override=args.k_anon, cell_format=args.format)

    cells = mdhist['cells']
    n_cells = len(cells) if isinstance(cells, list) else len(next(iter(cells.values())))
    total = mdhist['totals'].get(next(m['field'] for m in mdhist['measures'] if m['type'] == 'count'), 0)
    print(f"  {n_cells:,} cells from {total:,} total records")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    if args.gzip:
        import gzip
        if not str(out).endswith('.gz'):
            out = Path(str(out) + '.gz')
        json_bytes = json.dumps(mdhist, separators=(',', ':')).encode('utf-8')
        with gzip.open(out, 'wb') as f:
            f.write(json_bytes)
        print(f"Written to {out}  ({out.stat().st_size // 1024} KB gzip / {len(json_bytes) // 1024} KB uncompressed)")
    else:
        with open(out, 'w') as f:
            json.dump(mdhist, f, indent=2)
        print(f"Written to {out}  ({out.stat().st_size // 1024} KB)")


if __name__ == '__main__':
    main()

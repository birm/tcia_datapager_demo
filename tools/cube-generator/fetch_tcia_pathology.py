#!/usr/bin/env python3
"""
Download the TCIA pathology cohort-builder export and flatten it into a
cube-ready Parquet file (one row per image).

Source:
  https://pathdb.cancerimagingarchive.net/system/files/collectionmetadata/202401/cohort_builder_v1_01-16-2024.csv

Usage:
  python fetch_tcia_pathology.py                 # download + preprocess
  python fetch_tcia_pathology.py --csv local.csv # preprocess an existing download

Writes:
  data/tcia-pathology.parquet               (cube input, one row per image)
  ../../public/config/tcia-pathology-eaglescope.json
      Map from each cube dimension value back to the raw CSV value(s), so the
      app can hand the current filter state to the original Eaglescope viewer.
"""
import argparse
import json
import re
from pathlib import Path

import pandas as pd
import requests

SOURCE_URL = (
    "https://pathdb.cancerimagingarchive.net/system/files/collectionmetadata/"
    "202401/cohort_builder_v1_01-16-2024.csv"
)
HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
PUBLIC_CONFIG = HERE.parent.parent / "public" / "config"

EAGLESCOPE_BASE = "https://pathdb.cancerimagingarchive.net/eaglescope/dist/"
EAGLESCOPE_CONFIG = "/system/files/collectionmetadata/202401/cohort_builder_01-27-2024.json"

# cube dimension -> (raw CSV column, Eaglescope chart id, Eaglescope chart title)
# Ids/titles come from the Eaglescope config above.  Dimensions without an
# Eaglescope chart still map onto a raw column so they can be expressed as a filter.
EAGLESCOPE_FIELDS = {
    "collection":           ("collection", "collection", "TCIA Collection"),
    "species":              ("species", "species", "Species"),
    "cancer_type":          ("cancer_type", "cancer_type", "Cancer Type"),
    "cancer_location":      ("cancer_location", "cancer_location", "Cancer Location"),
    "modality":             ("modality", "modality", "Image Type or Modality"),
    "stain":                ("protocol", "protocol", "Staining Protocol"),
    "data_format":          ("data_format", "data_format", "Data Format"),
    "magnification":        ("magnification", "magnification", "Magnification"),
    "has_radiology":        ("has_radiology", "has_radiology", "Has Radiology"),
    "has_genomics":         ("has_genomics", "has_genomics", "Has Genomics"),
    "has_proteomics":       ("has_proteomics", "has_proteomics", "Has Proteomics"),
    "supporting_data":      ("supporting_data_type", "supporting_data_type", "Supporting Data"),
    "resolution":           ("par", "par", "Pixel Size"),
    "updated_year":         ("update", "update", "Last Updated"),
}


def download(dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {SOURCE_URL} ...")
    with requests.get(SOURCE_URL, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    print(f"  {dest.stat().st_size / 1e6:.1f} MB")
    return dest


def norm_text(s: pd.Series) -> pd.Series:
    return s.fillna("").astype(str).str.strip().str.replace(r"\s+", " ", regex=True)


def not_reported(s: pd.Series, extra=()) -> pd.Series:
    missing = {"", "N/A", "NA", "Not Reported", *extra}
    return s.where(~s.isin(missing), "Not reported")


def modality(s: pd.Series) -> pd.Series:
    # Same concept spelled with different capitalisation ("Whole slide image")
    canon = {
        "whole slide image": "Whole Slide Image",
        "tissue microarray, whole slide image": "TMA + WSI",
        "whole slide image, multiphoton": "WSI (multiphoton)",
        "whole mount tissue & laser microdisection": "Whole Mount + LMD",
        "otls microscope image": "Open-top light-sheet",
    }
    low = s.str.lower()
    return low.map(canon).fillna(s)


def stain(s: pd.Series) -> pd.Series:
    low = s.str.lower()
    out = s.copy()
    out[low == "hematoxylin and eosin"] = "H&E"
    out[low.str.contains("multiplex") | low.str.contains("codex")] = "Multiplex IF/IHC"
    out[low.isin(["immunofluorescence"])] = "Immunofluorescence"
    out[low.isin(["immunohistochemistry", "immunohistochemistry, hematoxylin and eosin"])] = "IHC (+/- H&E)"
    ihc_markers = {"cd3", "cd8", "cd56", "cd68", "cd163", "mhc1", "pdl1", "tp53", "ki67"}
    out[low.isin(ihc_markers)] = "IHC: " + s[low.isin(ihc_markers)].str.upper().str.replace("PDL1", "PD-L1")
    return not_reported(out)


def resolution_bin(s: pd.Series) -> pd.Series:
    """Pixel size in microns-per-pixel → coarse bins. Handles '(0.25,0.25)mpp' and '0.4965'."""
    def one(v: str) -> str:
        m = re.search(r"(\d*\.\d+|\d+)", v or "")
        if not m:
            return "Not reported"
        x = float(m.group(1))
        if x < 0.15:
            return "< 0.15 µm"
        if x < 0.30:
            return "0.15–0.30 µm"
        if x < 0.45:
            return "0.30–0.45 µm"
        return "≥ 0.45 µm"
    return s.map(one)


def yes_no(s: pd.Series) -> pd.Series:
    m = {"yes": "Yes", "no": "No", "in progress": "In progress"}
    return s.str.lower().map(m).fillna("Not reported")


def supporting(s: pd.Series) -> pd.Series:
    return s.where(s != "N/A", "None")


def build(csv_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    # One stray non-UTF-8 byte (Mac-Roman NBSP) lives in a slide filename; latin-1
    # decodes everything losslessly and none of the cube fields are affected.
    raw = pd.read_csv(csv_path, dtype=str, keep_default_na=False, encoding="latin-1")
    print(f"  {len(raw):,} rows × {raw.shape[1]} columns")
    df = raw.apply(norm_text)

    out = pd.DataFrame({
        "collection": df["collection"],
        "species": df["species"],
        "cancer_type": not_reported(df["cancer_type"]),
        "cancer_location": not_reported(df["cancer_location"]),
        "modality": modality(df["modality"]),
        "stain": stain(df["protocol"]),
        "data_format": not_reported(df["data_format"]),
        "magnification": not_reported(df["magnification"]),
        "resolution": resolution_bin(df["par"]),
        "has_radiology": yes_no(df["has_radiology"]),
        "has_genomics": yes_no(df["has_genomics"]),
        "has_proteomics": yes_no(df["has_proteomics"]),
        "supporting_data": supporting(df["supporting_data_type"]),
        "updated_year": df["update"].str[:4].where(df["update"].str.match(r"^\d{4}"), "Unknown"),
    })

    # Patient flag: 1 on exactly one image per (collection, patient_id), so that
    # sum(patients) == distinct patients for any filter on patient-level fields
    # (collection, species, cancer type/location, modality, linked-data flags).
    # For image-level fields (stain, format, magnification) a patient is counted
    # under the attributes of their first-listed image only.
    pk = df["collection"] + "\x00" + df["patient_id"]
    out["patients"] = (~pk.duplicated()).astype("int32")
    print(f"  {out['patients'].sum():,} distinct patients across {out['collection'].nunique()} collections")
    return out, raw


def eaglescope_map(out: pd.DataFrame, raw: pd.DataFrame) -> dict:
    """For each dimension: cube value -> sorted list of exact raw CSV values (untrimmed,
    because Eaglescope compares against the CSV as-is)."""
    fields = {}
    for dim, (col, chart_id, title) in EAGLESCOPE_FIELDS.items():
        pairs = pd.DataFrame({"v": out[dim], "r": raw[col]}).drop_duplicates()
        values = {v: sorted(g["r"].tolist()) for v, g in pairs.groupby("v")}
        fields[dim] = {"id": chart_id, "title": title, "field": col, "values": values}
    return {"BASE_URL": EAGLESCOPE_BASE, "CONFIG_URL": EAGLESCOPE_CONFIG, "FIELDS": fields}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="Use an existing local CSV instead of downloading")
    ap.add_argument("--out", default=str(DATA / "tcia-pathology.parquet"))
    args = ap.parse_args()

    csv_path = Path(args.csv) if args.csv else download(DATA / "cohort_builder_v1.csv")
    df, raw = build(csv_path)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)
    print(f"Wrote {out}")

    emap = PUBLIC_CONFIG / "tcia-pathology-eaglescope.json"
    emap.parent.mkdir(parents=True, exist_ok=True)
    emap.write_text(json.dumps(eaglescope_map(df, raw), indent=1, ensure_ascii=False))
    print(f"Wrote {emap}")


if __name__ == "__main__":
    main()

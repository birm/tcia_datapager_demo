# TCIA Histopathology Explorer (datapager demo)

An interactive cohort explorer for The Cancer Imaging Archive's pathology
collections, built on datapager. It is a fully static site:
the 827,761-row source CSV (~190 MB) is pre-aggregated into a 246-cell cube
(`public/config/tcia-pathology-mdhist.json`, ~140 KB), and all filtering happens in
the browser. Deploy it anywhere that serves static files (GitHub Pages, S3, Netlify, nginx).

Source data: [cohort_builder_v1_01-16-2024.csv](https://pathdb.cancerimagingarchive.net/system/files/collectionmetadata/202401/cohort_builder_v1_01-16-2024.csv)
(TCIA PathDB; one row per image).

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/  (npm run preview to serve it)
```

## Deploy to GitHub Pages

Push to `main` on GitHub, then under **Settings → Pages** set *Source* to
**GitHub Actions**. `.github/workflows/deploy.yml` tests, builds and publishes `dist/`.
Asset paths are relative (`base: './'`), so it works at `user.github.io/repo/`.

## Regenerating the cube

The generated files under `public/config/` are committed, so you only need this
when the source CSV changes.

```bash
cd tools/cube-generator
pip install -r requirements.txt
python fetch_tcia_pathology.py          # download + clean → data/tcia-pathology.parquet
                                        # also writes public/config/tcia-pathology-eaglescope.json
python generate.py \
  --input  data/tcia-pathology.parquet \
  --config configs/tcia-pathology.yaml \
  --output ../../public/config/tcia-pathology-mdhist.json
```

`fetch_tcia_pathology.py --csv path/to/local.csv` skips the download.

## What's in the cube

| File | Purpose |
|------|---------|
| `public/config/tcia-pathology-config.json` | Dashboard layout and chart definitions |
| `public/config/tcia-pathology-mdhist.json` | Pre-aggregated cube (14 dimensions × 2 measures) |
| `public/config/tcia-pathology-eaglescope.json` | Map from cube values back to raw CSV values, used by the Eaglescope button |

**Measures**
- **Images**: row count (exact under every filter).
- **Patients**: a flag set on one image per (collection, patient_id). This is exact
  when you filter on patient-level fields (collection, cancer type/location, species,
  image type, linked radiology/genomics/proteomics, supporting data, last-updated).
  Stain, data format and magnification can vary between a patient's images, so those
  charts show image counts, and patient totals under those filters count each patient
  by their first-listed image only.

**Cleaning applied** (raw values stay available to Eaglescope through the map):
case variants of image type merged ("Whole slide image" → "Whole Slide Image");
stain spellings merged ("Hematoxylin and eosin"/"…Eosin" → "H&E", IHC markers
prefixed "IHC:"); `N/A`/`NA` → "Not reported"; pixel size (`par`) binned into four
µm/pixel ranges; update date → year.

## View in Eaglescope

The header button opens the original Eaglescope cohort builder at
`pathdb.cancerimagingarchive.net/eaglescope/` with the current selection as its
`filterState`. Each cleaned value is translated back to its raw CSV value(s): one raw
value becomes an `eq` filter, several (e.g. the two H&E spellings) become an `in`
filter. Filters that can't be translated are listed in the button's tooltip and
marked with `*`.

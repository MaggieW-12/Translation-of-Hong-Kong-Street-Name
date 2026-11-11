# Translation of Hong Kong Street Names

This repository contains a 500-entry corpus of official bilingual street and
road names in Hong Kong. The analytic direction is Traditional Chinese
`source_text` to English `target_text`, but the pairs come from an official
bilingual registry and are not records of historical translation decisions.

The published site is a static corpus explorer with:

- keyword search and URL-backed filters for strategy, verification, road type,
  and sound score;
- a linked term network, strategy treemap, sound-score heatmap, and sortable
  data grid;
- a Traditional Chinese/English interface switch;
- a learning report, codebook, and AI use declaration;
- filtered CSV export.

## Dataset

- `data/hong_kong_street_names.csv` - the 500-entry corpus.
- `data/dataset_metadata.json` - source, sampling method, filters, and counts.
- `data/validation.json` - automated structural and source-match checks.
- `data/manual_review_queue.csv` - a 50-entry queue for the required personal
  source check.
- `index.html` - the interactive corpus explorer.
- `report.html` - the learning report.
- `codebook.html` - the published coding framework.
- `ai-use.html` - the AI use declaration and division of work.
- `site/data/street_names.js` - the compact browser data file generated from
  the validated CSV.
- `CODEBOOK.md` - definitions and decision rules for the four categories.

## Source and sampling

The source is the Hong Kong Transport Department's **Road Network (2nd
Generation), Road centerline** dataset on [DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_15-road-network-v2).
The large source GML file was streamed on 11 November 2026, reduced to unique
bilingual name pairs, filtered with predeclared rules, and sampled with fixed
seed `3620`. Sample IDs are selected by the lowest SHA-256 hashes rather than
by hand-picking.

Every row includes the official `OBJECTID`, `ST_CODE`, source URL, retrieval
date, unit, category, and the corpus-required `human_checked` field. All rows
currently say `human_checked=no`; the 50-entry review queue is prepared but
has not yet been personally checked by the project owner.

## Rebuild

```powershell
python -m pip install -r requirements.txt
python scripts/build_street_corpus.py
python scripts/validate_street_corpus.py
python scripts/build_site_data.py
```

The builder downloads the official source only when its local cache is absent.
The source is attributed to DATA.GOV.HK and the Transport Department under the
DATA.GOV.HK terms of use.

For a local preview, run `python -m http.server 8000` in the repository root
and open `http://127.0.0.1:8000/`.

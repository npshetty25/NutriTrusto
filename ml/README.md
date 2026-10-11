# Product-category classifier

A text classifier that predicts which of the app's ten pantry categories a
product name belongs to (`dairy`, `grain`, `beverage`, `snack`, …). It is
called after a barcode scan or receipt read, and the dashboard shows
"Looks like: dairy · model, 91% sure".

It is **trained on packaged-product names**, so it is best at things that have
a barcode. It is weak on loose fresh produce (see *Known limitations*).

## Results

All numbers are on a held-out test set of **510 product names** the model never
saw during training or model selection. Source: `ml/artifacts/metrics.json`,
`ml/artifacts/comparison.json`.

| | Accuracy | Macro precision | Macro recall | Macro F1 |
|---|---|---|---|---|
| **Trained model** (`category-v1`) | **85.3%** | 0.871 | 0.847 | **0.856** |
| App's existing keyword rules (`item-category.ts`) | 42.6% | 0.762 | 0.435 | 0.543 |

The rules answer `unknown` for 44.7% of these names; when they do answer
they are right 77.0% of the time (282 of 510 answered). The model answers all
of them.

### Per class (test set)

From `ml/artifacts/metrics.json`, the shipped (calibrated) model.

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| meat | 0.92 | 0.93 | 0.92 | 70 |
| fruit | 0.94 | 0.89 | 0.92 | 55 |
| bakery | 1.00 | 0.82 | 0.90 | 17 |
| vegetable | 0.86 | 0.91 | 0.89 | 47 |
| beverage | 0.84 | 0.90 | 0.87 | 70 |
| dairy | 0.93 | 0.79 | 0.85 | 33 |
| pantry | 0.81 | 0.88 | 0.84 | 48 |
| grain | 0.85 | 0.80 | 0.83 | 51 |
| frozen | 0.86 | 0.72 | 0.79 | 58 |
| snack | 0.70 | 0.82 | 0.76 | 61 |

`bakery` has only 17 test rows, so its 1.00 precision rests on a handful of
examples and is not a strong claim.

Confusion matrix: `ml/artifacts/confusion_matrix.csv`. The largest
off-diagonal cells are `frozen → snack` (8), `frozen → meat` (4),
`dairy → snack` (4) and `snack → beverage` (4): frozen versions of foods that
also have an ordinary category, and `snack` absorbing neighbours.

### Calibration

The model is **underconfident**: mean predicted confidence 0.757 against 0.853
actual accuracy (expected calibration error 0.101). A "70% sure" is, in
practice, right more often than 70% of the time. The UI shows the number as
the model's own score, not as a guarantee.

## Data

| | |
|---|---|
| Source | [Open Food Facts](https://world.openfoodfacts.org), via the search-a-licious API |
| Licence | Database: **ODbL 1.0**. Contents: **DbCL 1.0**. © Open Food Facts contributors |
| Fetched | 2026-10-11, `ml/fetch_data.py` |
| Rows | 5,100 products seen → 782 dropped (matched more than one class) → 4,318 → **3,394 after de-duplicating names** |
| Scope | India (`countries_tags = en:india`); classes the Indian subset could not fill (vegetable, fruit, meat, frozen) are topped up with English-named products from anywhere |
| Labels | Derived from Open Food Facts category tags by a fixed tag → class mapping in `fetch_data.py`. They are **not hand-verified**. |

The raw download is not committed (share-alike). The trained model and
aggregate metrics are, with the attribution above.

## Method

1. Lower-case, collapse whitespace, **de-duplicate names before splitting** so a
   product listed twice cannot appear in both train and test.
2. Stratified 70 / 15 / 15 split, seed 42.
3. Features: TF-IDF over word 1–2-grams plus character 2–5-grams.
4. Candidates swept on the validation split by macro-F1: Complement Naive
   Bayes (α ∈ 0.1, 0.3, 1), Logistic Regression (C ∈ 1, 3, 10, 30), Linear SVM
   (C ∈ 0.1, 0.3, 1). Winner: **Linear SVM, C = 0.3** (validation macro-F1
   0.833; the three families were within 0.03 of each other).
5. Refit on train + validation, sigmoid-calibrate (5-fold), score **once** on test.

## Known limitations

- **Fresh produce.** "Fresh Spinach" is predicted `frozen`: in the training
  data, packaged spinach is overwhelmingly frozen. Pinned as a strict
  expected-failure in `ml/service/test_app.py`.
- **Label noise.** Labels come from community-entered tags, and `biscuit` vs
  `snack` is genuinely ambiguous in the source (a cookie is predicted `snack`).
  The test set shares that noise, so 85% is measured against imperfect labels.
- **Different distribution from the rules.** The test set is packaged-product
  names, which is what the model trained on. The existing rules were written
  for pantry-item names such as "tomato" or "dal". The comparison favours the
  model; it does not show the model would win on a hand-labelled set of real
  receipt lines, which does not exist yet.
- **Small classes.** `bakery` has 17 test rows and `dairy` 33. Per-class
  figures for those are noisy.
- **One split, one seed.** No cross-validated confidence interval was computed.
  With n = 510, the 95% interval on accuracy is roughly ±3 points.

## Run it

```bash
python -m venv .venv && . .venv/bin/activate
pip install scikit-learn pandas numpy joblib fastapi uvicorn httpx pytest

python ml/fetch_data.py                    # ml/data/raw.jsonl (needs network)
python ml/train.py                         # ml/artifacts/*
npx vite-node -c vitest.config.ts ml/evaluate_rules.ts
python ml/compare.py                       # ml/artifacts/comparison.json

pytest ml/service                          # service tests
uvicorn ml.service.app:app --port 8000     # run the service
docker compose up --build                  # web + ml together
```

The web app reads `ML_SERVICE_URL`. When it is unset, or the service is down
or slower than 2 s, `/api/categorize` answers from the keyword rules and the
response says `"source": "rules"`; the UI then reads "keyword guess" with no
percentage. A keyword guess is never presented as a model prediction.

## Versioning

`ml/artifacts/category-v1.joblib` is the model; the version string is embedded
in the file and returned by `/health` and `/predict`. A joblib file only loads
under the scikit-learn that wrote it, so `ml/service/requirements.txt` pins
`scikit-learn==1.9.1`. Retraining writes a new file; bump `MODEL_VERSION` in
`train.py` and the path in `ml/service/Dockerfile`.

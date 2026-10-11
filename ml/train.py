"""Train and evaluate the product-category classifier.

    python ml/train.py

Method
------
* Names are lower-cased and de-duplicated *before* splitting, so the same
  product name under two barcodes cannot leak from train into test.
* Stratified 70 / 15 / 15 split, fixed seed.
* Features: TF-IDF over word 1-2-grams plus character 2-5-grams (character
  n-grams are what make "Parle-G", "Mother's Dairy" and typos tractable).
* Three candidates (Complement Naive Bayes, Logistic Regression, Linear SVM),
  each with a small C / alpha sweep, chosen on the VALIDATION split by macro-F1.
* The winner is refit on train + validation and scored ONCE on the held-out
  test split. Nothing is tuned on the test split.

Everything the script prints is also written to ml/artifacts/metrics.json.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

SEED = 42
HERE = Path(__file__).parent
RAW = HERE / "data" / "raw.jsonl"
OUT = HERE / "artifacts"
MODEL_VERSION = "category-v1"


def normalise(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower().strip())


def load() -> pd.DataFrame:
    df = pd.read_json(RAW, lines=True)
    df["text"] = df["name"].map(normalise)
    before = len(df)
    df = df[df["text"].str.len() >= 2].drop_duplicates(subset="text", keep="first").reset_index(drop=True)
    print(f"rows: {before} -> {len(df)} after dropping blanks and duplicate names")
    return df


def features() -> FeatureUnion:
    return FeatureUnion(
        [
            ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
            ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True, min_df=2)),
        ]
    )


def candidates() -> list[tuple[str, dict, object]]:
    out = []
    for a in (0.1, 0.3, 1.0):
        out.append(("complement_nb", {"alpha": a}, ComplementNB(alpha=a)))
    for c in (1, 3, 10, 30):
        out.append(("logistic_regression", {"C": c}, LogisticRegression(C=c, max_iter=2000, class_weight="balanced")))
    for c in (0.1, 0.3, 1.0):
        out.append(("linear_svm", {"C": c}, LinearSVC(C=c, class_weight="balanced")))
    return out


def macro(y_true, y_pred):
    p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    return float(p), float(r), float(f)


def main() -> int:
    if not RAW.exists():
        print(f"{RAW} not found. Run python ml/fetch_data.py first.", file=sys.stderr)
        return 1
    OUT.mkdir(exist_ok=True)

    df = load()
    X, y = df["text"].to_numpy(), df["label"].to_numpy()

    X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.30, stratify=y, random_state=SEED)
    X_va, X_te, y_va, y_te = train_test_split(X_tmp, y_tmp, test_size=0.50, stratify=y_tmp, random_state=SEED)
    print(f"train {len(X_tr)}  validation {len(X_va)}  test {len(X_te)}")

    # ── model selection on the validation split ────────────────────
    trials = []
    for name, params, clf in candidates():
        pipe = Pipeline([("features", features()), ("clf", clf)])
        pipe.fit(X_tr, y_tr)
        p, r, f = macro(y_va, pipe.predict(X_va))
        trials.append({"model": name, "params": params, "val_macro_f1": round(f, 4), "val_accuracy": round(accuracy_score(y_va, pipe.predict(X_va)), 4)})
        print(f"  {name:20s} {str(params):14s} val macro-F1 {f:.4f}")

    best = max(trials, key=lambda t: t["val_macro_f1"])
    print(f"\nselected on validation: {best['model']} {best['params']}  (macro-F1 {best['val_macro_f1']})")

    # ── refit on train + validation, score once on test ────────────
    chosen = next(c for n, p_, c in candidates() if n == best["model"] and p_ == best["params"])
    # A raw SVM margin is not a probability. Wrapping the winner in sigmoid
    # calibration (5-fold, on train+validation only) gives the service a
    # confidence it can honestly show; calibration quality is measured below.
    if hasattr(chosen, "predict_proba"):
        clf = chosen
    else:
        clf = CalibratedClassifierCV(chosen, cv=5, method="sigmoid")
    final = Pipeline([("features", features()), ("clf", clf)])
    final.fit(np.concatenate([X_tr, X_va]), np.concatenate([y_tr, y_va]))
    y_hat = final.predict(X_te)
    proba = final.predict_proba(X_te)
    conf = proba.max(axis=1)
    correct = (y_hat == y_te).astype(float)
    # Expected calibration error, 10 equal-width bins.
    ece = 0.0
    for lo in np.arange(0.0, 1.0, 0.1):
        m = (conf > lo) & (conf <= lo + 0.1)
        if m.any():
            ece += m.mean() * abs(correct[m].mean() - conf[m].mean())
    print(f"calibration: mean confidence {conf.mean():.3f} vs accuracy {correct.mean():.3f}, ECE {ece:.3f}")

    labels = sorted(set(y))
    acc = float(accuracy_score(y_te, y_hat))
    mp, mr, mf = macro(y_te, y_hat)
    report = classification_report(y_te, y_hat, labels=labels, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_te, y_hat, labels=labels)

    print(f"\nTEST  accuracy {acc:.4f}  macro precision {mp:.4f}  macro recall {mr:.4f}  macro F1 {mf:.4f}")
    print(classification_report(y_te, y_hat, labels=labels, zero_division=0))
    print("confusion matrix (rows = true, cols = predicted):")
    print(pd.DataFrame(cm, index=labels, columns=labels).to_string())

    # The held-out names go to disk so the app's rule-based inferrer can be
    # scored on exactly the same rows (ml/evaluate_rules.ts).
    (OUT / "test_set.json").write_text(
        json.dumps([{"name": n, "label": l} for n, l in zip(X_te.tolist(), y_te.tolist())], ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    pd.DataFrame(cm, index=labels, columns=labels).to_csv(OUT / "confusion_matrix.csv")

    scope_counts = pd.read_json(RAW, lines=True)["scope"].value_counts().to_dict()
    metrics = {
        "model_version": MODEL_VERSION,
        "seed": SEED,
        "selected": best,
        "validation_trials": trials,
        "split": {"train": len(X_tr), "validation": len(X_va), "test": len(X_te)},
        "dataset": {
            "rows_after_dedupe": len(df),
            "class_counts": df["label"].value_counts().to_dict(),
            "source_scope_counts_before_dedupe": scope_counts,
        },
        "test": {
            "accuracy": round(acc, 4),
            "macro_precision": round(mp, 4),
            "macro_recall": round(mr, 4),
            "macro_f1": round(mf, 4),
            "mean_confidence": round(float(conf.mean()), 4),
            "expected_calibration_error": round(float(ece), 4),
            "per_class": {k: {m: round(v, 4) if isinstance(v, float) else v for m, v in d.items()} for k, d in report.items() if k in labels},
        },
        "labels": labels,
    }
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    joblib.dump({"pipeline": final, "labels": labels, "version": MODEL_VERSION}, OUT / f"{MODEL_VERSION}.joblib", compress=3)
    size_kb = (OUT / f"{MODEL_VERSION}.joblib").stat().st_size / 1024
    print(f"\nwrote {OUT / (MODEL_VERSION + '.joblib')}  ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

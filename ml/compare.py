"""Score the app's rule-based inferrer against the trained model on the same
held-out test names. Reads ml/artifacts/rule_predictions.json (written by
evaluate_rules.ts) and metrics.json (written by train.py)."""
import json
from pathlib import Path

from sklearn.metrics import accuracy_score, precision_recall_fscore_support

A = Path(__file__).parent / "artifacts"
rows = json.loads((A / "rule_predictions.json").read_text(encoding="utf-8"))
y, p = [r["label"] for r in rows], [r["predicted"] for r in rows]
labels = sorted(set(y))

acc = accuracy_score(y, p)
mp, mr, mf, _ = precision_recall_fscore_support(y, p, labels=labels, average="macro", zero_division=0)
pc = precision_recall_fscore_support(y, p, labels=labels, zero_division=0)
unknown = sum(1 for v in p if v == "unknown")
covered = [(a, b) for a, b in zip(y, p) if b != "unknown"]
acc_covered = sum(1 for a, b in covered if a == b) / len(covered) if covered else 0.0

model = json.loads((A / "metrics.json").read_text(encoding="utf-8"))["test"]
out = {
    "test_rows": len(rows),
    "rules": {
        "accuracy": round(acc, 4), "macro_precision": round(mp, 4), "macro_recall": round(mr, 4), "macro_f1": round(mf, 4),
        "fell_through_to_unknown": unknown, "unknown_rate": round(unknown / len(rows), 4),
        "accuracy_when_it_answers": round(acc_covered, 4), "answered": len(covered),
        "per_class_f1": {l: round(float(f), 4) for l, f in zip(labels, pc[2])},
    },
    "model": {k: model[k] for k in ("accuracy", "macro_precision", "macro_recall", "macro_f1")},
}
(A / "comparison.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
print(json.dumps(out, indent=2))

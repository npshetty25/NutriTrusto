"""Download labelled product names from Open Food Facts for the classifier.

Source:   Open Food Facts search-a-licious API (https://search.openfoodfacts.org)
Licence:  database under the Open Database Licence (ODbL) v1.0, individual
          contents under the Database Contents Licence (DbCL) v1.0.
          Attribution: (c) Open Food Facts contributors, openfoodfacts.org.
          Cite it and share-alike any derived database; this script's raw
          output is therefore kept out of git (see ml/.gitignore) and only the
          trained model plus aggregate metrics are committed.

Labels:   OFF carries a free-form category tree; the app has ten classes. Each
          class below is a set of OFF category tags. A product is kept only if
          its tags fall in EXACTLY ONE class, because a product tagged both
          dairy and snack (paneer is) has no single correct label and training
          on it would just add noise. How many were dropped is printed.

Scope:    India only (countries_tags = en:india), because the app is for
          Indian kitchens and Indian product names are the distribution that
          matters.

Run:      python ml/fetch_data.py            (writes ml/data/raw.jsonl)
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

API = "https://search.openfoodfacts.org/search"
UA = "NutriTrust-ML-research/0.1 (student project; contact via github.com/npshetty25/NutriTrusto)"
PAGE_SIZE = 100
MAX_PAGES_PER_CLASS = 8
PAUSE_SECONDS = 1.0
# A class with fewer Indian rows than this is topped up from global English.
MIN_PER_CLASS = 250

# class -> OFF category tags that mean it
CLASSES: dict[str, list[str]] = {
    "vegetable": ["en:vegetables", "en:fresh-vegetables", "en:leaf-vegetables", "en:root-vegetables"],
    "fruit": ["en:fruits", "en:fresh-fruits"],
    "dairy": ["en:dairies", "en:milks", "en:cheeses", "en:yogurts", "en:butters"],
    "meat": ["en:meats", "en:fishes-and-seafood", "en:eggs", "en:poultries"],
    "grain": ["en:rices", "en:pastas", "en:flours", "en:wheat-flours", "en:lentils", "en:pulses", "en:breakfast-cereals"],
    "beverage": ["en:beverages"],
    "bakery": ["en:breads", "en:biscuits", "en:cakes", "en:pastries"],
    "frozen": ["en:frozen-foods"],
    "snack": ["en:snacks", "en:salty-snacks", "en:chocolates", "en:chips-and-fries"],
    "pantry": ["en:condiments", "en:sauces", "en:spices", "en:vegetable-oils", "en:salts", "en:sugars"],
}


def query_for(tags: list[str], scope: str = "india") -> str:
    ors = " OR ".join(f'categories_tags:"{t}"' for t in tags)
    if scope == "india":
        return f'({ors}) AND countries_tags:"en:india"'
    # Top-up for classes the Indian subset cannot fill: English-named products
    # from anywhere. Fresh produce and meat rarely carry a barcode in India.
    return f'({ors}) AND lang:"en"'


def fetch_page(q: str, page: int) -> dict:
    params = urllib.parse.urlencode(
        {"q": q, "page": page, "page_size": PAGE_SIZE, "fields": "code,product_name,categories_tags,lang"}
    )
    req = urllib.request.Request(f"{API}?{params}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def main() -> int:
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)

    # code -> record, so a product returned for two classes is seen once.
    seen: dict[str, dict] = {}
    returned: Counter = Counter()

    def collect(label: str, scope: str, max_pages: int) -> None:
        q = query_for(CLASSES[label], scope)
        got = 0
        for page in range(1, max_pages + 1):
            try:
                data = fetch_page(q, page)
            except Exception as exc:  # network / API hiccup: report, do not invent data
                print(f"  {label} page {page}: {exc}", file=sys.stderr)
                break
            hits = data.get("hits", [])
            if not hits:
                break
            for h in hits:
                code = str(h.get("code", "")).strip()
                name = (h.get("product_name") or "").strip()
                if not code or not name:
                    continue
                rec = seen.setdefault(
                    code,
                    {"code": code, "name": name, "scope": scope, "tags": h.get("categories_tags") or []},
                )
                rec.setdefault("queried", [])
                if label not in rec["queried"]:
                    rec["queried"].append(label)
                got += 1
            time.sleep(PAUSE_SECONDS)
            if page >= int(data.get("page_count", page)):
                break
        returned[(label, scope)] += got
        print(f"{label:10s} {scope:7s} rows returned: {got}")

    for label in CLASSES:
        collect(label, "india", MAX_PAGES_PER_CLASS)
    for label in CLASSES:
        if returned[(label, "india")] < MIN_PER_CLASS:
            collect(label, "global", 6)

    # Keep only products whose own tags fall in exactly one class.
    tag_to_class = {t: c for c, ts in CLASSES.items() for t in ts}
    kept, dropped_ambiguous, dropped_unlabelled = [], 0, 0
    for rec in seen.values():
        classes = {tag_to_class[t] for t in rec["tags"] if t in tag_to_class}
        if len(classes) == 1:
            rec["label"] = next(iter(classes))
            kept.append(rec)
        elif len(classes) > 1:
            dropped_ambiguous += 1
        else:
            dropped_unlabelled += 1

    path = out_dir / "raw.jsonl"
    with path.open("w", encoding="utf-8") as fh:
        for rec in kept:
            fh.write(json.dumps({"code": rec["code"], "name": rec["name"], "label": rec["label"], "scope": rec["scope"]}, ensure_ascii=False) + "\n")

    print(f"\nunique products seen:        {len(seen)}")
    print(f"dropped, matched >1 class:   {dropped_ambiguous}")
    print(f"dropped, matched no class:   {dropped_unlabelled}")
    print(f"kept:                        {len(kept)}  -> {path}")
    for label, n in Counter(r["label"] for r in kept).most_common():
        print(f"  {label:10s} {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

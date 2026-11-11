#!/usr/bin/env python3
"""Validate the bilingual street-name CSV and prepare a manual review queue."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CORPUS = DATA / "hong_kong_street_names.csv"
CACHE = DATA / "official_road_names.json"
REPORT = DATA / "validation.json"
REVIEW_QUEUE = DATA / "manual_review_queue.csv"

REQUIRED = {
    "id",
    "source_text",
    "target_text",
    "source",
    "category",
    "human_checked",
}
CATEGORIES = {
    "phonetic_transliteration",
    "semantic_translation",
    "hybrid_phonetic_semantic",
    "conventional_or_indirect",
}


def sample_review_ids(ids: list[str], size: int = 50) -> list[str]:
    return sorted(
        ids,
        key=lambda value: hashlib.sha256(
            f"manual-review:{value}".encode("utf-8")
        ).hexdigest(),
    )[:size]


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"[\u2010-\u2015\u2212]", "-", value)
    value = re.sub(r"\s*-\s*", " - ", value)
    return re.sub(r"\s+", " ", value).strip()


def main() -> None:
    with CORPUS.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))

    errors: list[str] = []
    if len(rows) != 500:
        errors.append(f"Expected 500 rows, found {len(rows)}")
    if not rows:
        raise SystemExit("Corpus is empty")
    if not REQUIRED.issubset(rows[0]):
        errors.append(f"Missing required columns: {sorted(REQUIRED - rows[0].keys())}")

    ids = [row.get("id", "") for row in rows]
    if len(ids) != len(set(ids)):
        errors.append("Duplicate IDs found")

    pairs = [
        (row.get("source_text", ""), row.get("target_text", ""))
        for row in rows
    ]
    if len(pairs) != len(set(pairs)):
        errors.append("Duplicate bilingual name pairs found")

    for row in rows:
        for field in REQUIRED:
            if not row.get(field):
                errors.append(f"{row.get('id', '?')} has empty {field}")
        if row.get("category") not in CATEGORIES:
            errors.append(
                f"{row.get('id', '?')} has unknown category {row.get('category')}"
            )
        if row.get("human_checked") not in {"yes", "no"}:
            errors.append(
                f"{row.get('id', '?')} has invalid human_checked value"
            )
        source = row.get("source", "")
        if (
            f"OBJECTID {row.get('object_id', '')}" not in source
            or f"ST_CODE {row.get('street_code', '')}" not in source
        ):
            errors.append(f"{row.get('id', '?')} source IDs do not match fields")

    source_matches = None
    if CACHE.exists():
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
        official = {
            (normalize_name(item["chinese"]), normalize_name(item["english"])): item
            for item in cache["road_names"]
        }
        missing = [
            row["id"]
            for row in rows
            if (row["source_text"], row["target_text"]) not in official
        ]
        if missing:
            errors.append(f"Pairs not found in official cache: {missing[:10]}")
        source_matches = len(rows) - len(missing)

    review_ids = set(sample_review_ids(ids))
    previous_reviews: dict[str, dict[str, str]] = {}
    if REVIEW_QUEUE.exists():
        with REVIEW_QUEUE.open(encoding="utf-8-sig", newline="") as stream:
            previous_reviews = {
                row["id"]: row for row in csv.DictReader(stream)
            }
    review_rows = [row for row in rows if row["id"] in review_ids]
    with REVIEW_QUEUE.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=[
                "id",
                "source_text",
                "target_text",
                "source",
                "category",
                "reviewed_against_source",
                "review_notes",
            ],
        )
        writer.writeheader()
        for row in review_rows:
            writer.writerow(
                {
                    key: row[key]
                    for key in (
                        "id",
                        "source_text",
                        "target_text",
                        "source",
                        "category",
                    )
                }
                | {
                    "reviewed_against_source": previous_reviews.get(
                        row["id"], {}
                    ).get("reviewed_against_source", ""),
                    "review_notes": previous_reviews.get(row["id"], {}).get(
                        "review_notes", ""
                    ),
                }
            )

    report = {
        "result": "pass" if not errors else "fail",
        "rows": len(rows),
        "unique_ids": len(set(ids)),
        "unique_bilingual_pairs": len(set(pairs)),
        "required_columns_present": REQUIRED.issubset(rows[0]),
        "category_counts": dict(Counter(row["category"] for row in rows)),
        "human_checked_yes": sum(
            row["human_checked"] == "yes" for row in rows
        ),
        "source_pairs_matched": source_matches,
        "manual_review_queue_rows": len(review_rows),
        "errors": errors,
    }
    REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

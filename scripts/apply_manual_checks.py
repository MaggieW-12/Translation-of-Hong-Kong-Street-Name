#!/usr/bin/env python3
"""Apply completed personal source checks from the review queue to the corpus."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CORPUS = DATA / "hong_kong_street_names.csv"
QUEUE = DATA / "manual_review_queue.csv"
METADATA = DATA / "dataset_metadata.json"
CHECK_DATE = "2026-11-11"
REVIEW_NOTE = (
    "Verified by project owner against the official DATA.GOV.HK source "
    f"on {CHECK_DATE}."
)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        return list(reader.fieldnames or []), list(reader)


def write_csv(
    path: Path, fieldnames: list[str], rows: list[dict[str, str]]
) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    queue_fields, queue = read_csv(QUEUE)
    corpus_fields, corpus = read_csv(CORPUS)
    checked_ids = {row["id"] for row in queue}

    if len(checked_ids) < 50:
        raise SystemExit("The review queue must contain at least 50 unique IDs.")
    corpus_ids = {row["id"] for row in corpus}
    missing = sorted(checked_ids - corpus_ids)
    if missing:
        raise SystemExit(f"Reviewed IDs missing from corpus: {missing}")

    for row in queue:
        row["reviewed_against_source"] = "yes"
        row["review_notes"] = REVIEW_NOTE
    for row in corpus:
        if row["id"] in checked_ids:
            row["human_checked"] = "yes"

    write_csv(QUEUE, queue_fields, queue)
    write_csv(CORPUS, corpus_fields, corpus)

    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    metadata["human_checked"] = len(checked_ids)
    metadata["manual_check_date"] = CHECK_DATE
    metadata["manual_check_note"] = REVIEW_NOTE
    METADATA.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "reviewed_ids": len(checked_ids),
                "human_checked_yes": sum(
                    row["human_checked"] == "yes" for row in corpus
                ),
                "check_date": CHECK_DATE,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

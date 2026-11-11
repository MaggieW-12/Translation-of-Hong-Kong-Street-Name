#!/usr/bin/env python3
"""Convert the validated corpus CSV into the compact data file used by the site."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "hong_kong_street_names.csv"
META_PATH = ROOT / "data" / "dataset_metadata.json"
OUTPUT = ROOT / "site" / "data" / "street_names.js"

ROAD_TYPES = [
    "ROAD",
    "STREET",
    "AVENUE",
    "LANE",
    "DRIVE",
    "PATH",
    "CIRCUIT",
    "HIGHWAY",
    "BYPASS",
    "CORRIDOR",
    "TUNNEL",
    "FLYOVER",
    "INTERCHANGE",
    "SQUARE",
    "WALK",
    "WAY",
    "CRESCENT",
    "TERRACE",
    "RISE",
    "CLOSE",
    "COURT",
]

GENERIC_CHARS = set("道街路里巷徑坊段東西南北中上下新舊大正支圍臺台")


def road_type(english: str) -> str:
    tokens = set(re.findall(r"[A-Z]+", english.upper()))
    return next((item for item in ROAD_TYPES if item in tokens), "OTHER")


def score_band(value: float) -> str:
    if value < 0.25:
        return "0-.24"
    if value < 0.50:
        return ".25-.49"
    if value < 0.75:
        return ".50-.74"
    return ".75-1.00"


def main() -> None:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as stream:
        source_rows = list(csv.DictReader(stream))
    metadata = json.loads(META_PATH.read_text(encoding="utf-8"))

    rows = []
    for row in source_rows:
        chinese_characters = []
        for character in row["source_text"]:
            if (
                re.match(r"[\u3400-\u9fff]", character)
                and character not in GENERIC_CHARS
                and character not in chinese_characters
            ):
                chinese_characters.append(character)
        key_terms = [
            token
            for token in re.findall(r"[A-Z]+", row["key_term"])
            if len(token) >= 2
        ]
        score = float(row["phonetic_score"])
        rows.append(
            {
                "id": row["id"],
                "sourceText": row["source_text"],
                "targetText": row["target_text"],
                "source": row["source"],
                "category": row["category"],
                "humanChecked": row["human_checked"],
                "unit": row["unit"],
                "keyTerm": row["key_term"],
                "streetCode": row["street_code"],
                "objectId": row["object_id"],
                "segmentCount": int(row["segment_count"]),
                "phoneticScore": score,
                "scoreBand": score_band(score),
                "semanticEvidence": row["semantic_evidence"],
                "roadType": road_type(row["target_text"]),
                "characters": chinese_characters,
                "keyTerms": key_terms,
            }
        )

    metadata["browser_rows"] = len(rows)
    payload = (
        "window.STREET_META = "
        + json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.STREET_DATA = "
        + json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(payload, encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(OUTPUT),
                "rows": len(rows),
                "road_types": sorted({row["roadType"] for row in rows}),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

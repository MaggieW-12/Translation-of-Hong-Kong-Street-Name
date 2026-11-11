#!/usr/bin/env python3
"""Build a reproducible sample of official bilingual Hong Kong road names.

Source: Transport Department, Road Network (2nd Generation), Road centerline.
The large GML file is streamed and reduced to unique bilingual name pairs.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import hashlib
import json
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_CACHE = DATA_DIR / "official_road_names.json"
OUTPUT_CSV = DATA_DIR / "hong_kong_street_names.csv"
OUTPUT_METADATA = DATA_DIR / "dataset_metadata.json"

SOURCE_URL = (
    "https://static.data.gov.hk/td/road-network-v2/CENTERLINE.gml"
)
DATASET_URL = (
    "https://data.gov.hk/en-data/dataset/"
    "hk-td-tis_15-road-network-v2"
)
SCHEMA_URL = (
    "https://static.data.gov.hk/td/road-network-v2/CENTERLINE.gfs"
)
RETRIEVED = "2026-11-11"
SEED = "3620"
SAMPLE_SIZE = 500

CORE_NS = "http://www.opengis.net/citygml/2.0"
GEN_NS = "http://www.opengis.net/citygml/generics/2.0"
MEMBER_TAG = f"{{{CORE_NS}}}cityObjectMember"
STRING_ATTRIBUTE_TAG = f"{{{GEN_NS}}}stringAttribute"
INT_ATTRIBUTE_TAG = f"{{{GEN_NS}}}intAttribute"
VALUE_TAG = f"{{{GEN_NS}}}value"

ROAD_WORDS = {
    "AVENUE",
    "APPROACH",
    "BYPASS",
    "CIRCUIT",
    "CLOSE",
    "CORRIDOR",
    "COURT",
    "CRESCENT",
    "DRIVE",
    "FLYOVER",
    "HIGHWAY",
    "INTERCHANGE",
    "LANE",
    "PATH",
    "PLACE",
    "PROMENADE",
    "ROAD",
    "ROUNDABOUT",
    "RISE",
    "SQUARE",
    "STREET",
    "TERRACE",
    "TUNNEL",
    "WALK",
    "WAY",
}

SEMANTIC_GLOSSES: dict[str, tuple[str, ...]] = {
    "AIRPORT": ("機場",),
    "BAY": ("灣",),
    "BEACH": ("泳灘", "海灘"),
    "BIG": ("大",),
    "BLACK": ("黑",),
    "BLESSING": ("福",),
    "BLUE": ("藍", "青"),
    "BRIDGE": ("橋",),
    "BRIDE": ("新娘",),
    "CHURCH": ("教堂", "聖堂"),
    "CINEMA": ("戲院",),
    "CLINIC": ("診所",),
    "CONTAINER": ("貨櫃",),
    "COURT": ("法院",),
    "CREEK": ("溪", "涌"),
    "DOCK": ("船塢", "船澳", "碼頭"),
    "DRAGON": ("龍",),
    "EAST": ("東",),
    "EARL": ("伯爵",),
    "ELEGANCE": ("雅麗",),
    "ELM": ("榆樹", "榆"),
    "FERRY": ("渡船", "渡輪"),
    "FIELD": ("田",),
    "FIRE": ("消防",),
    "FLOWER": ("花",),
    "FORTUNE": ("福", "財"),
    "FRIENDSHIP": ("友",),
    "GARDEN": ("花園", "園"),
    "GARDENS": ("花園", "苑"),
    "GLASS": ("玻璃",),
    "GOLDEN": ("金",),
    "GOVERNMENT": ("政府",),
    "GREAT": ("大",),
    "GREEN": ("綠", "青"),
    "HARBOUR": ("海港", "海", "港"),
    "HEALTH": ("健康", "康"),
    "HEALTHY": ("健康",),
    "HIGH": ("高",),
    "HILL": ("山", "嶺"),
    "HOLY": ("聖",),
    "HORSE": ("馬",),
    "HOSPITAL": ("醫院",),
    "HOTEL": ("酒店",),
    "INNER": ("內",),
    "ISLAND": ("島",),
    "JADE": ("玉",),
    "KING": ("皇", "王"),
    "LAKE": ("湖",),
    "LEAF": ("葉",),
    "LIGHT": ("光",),
    "LITTLE": ("小",),
    "LONG": ("長",),
    "LOOKOUT": ("瞭望",),
    "LORD": ("勳爵",),
    "LOWER": ("下",),
    "MAIN": ("正", "大"),
    "MAPLE": ("楓",),
    "MARKET": ("市場", "街市", "墟", "市"),
    "MEMORIAL": ("紀念",),
    "MIDDLE": ("中",),
    "MILL": ("磨坊", "廠"),
    "MOON": ("月",),
    "MOUNT": ("山", "山頂"),
    "MUSEUM": ("博物館",),
    "NEW": ("新",),
    "NORTH": ("北",),
    "NULLAH": ("水渠", "渠"),
    "OIL": ("油",),
    "OLD": ("舊",),
    "OUTER": ("外",),
    "PARK": ("公園",),
    "PEACE": ("和平", "安"),
    "PEAK": ("山頂", "峰"),
    "PEAR": ("梨",),
    "PEARL": ("珠",),
    "PHOENIX": ("鳳",),
    "PIER": ("碼頭",),
    "PINE": ("松",),
    "POLICE": ("警署", "警察"),
    "POWER": ("強", "電力"),
    "PORT": ("港口", "港"),
    "PRAYA": ("海傍", "海旁"),
    "PRINCE": ("王子", "太子"),
    "PRINCESS": ("公主",),
    "QUEEN": ("皇后", "女王"),
    "RAILWAY": ("鐵路",),
    "RED": ("紅",),
    "RIVER": ("河",),
    "SAINT": ("聖",),
    "SCHOOL": ("學校", "書院"),
    "SCIENCE": ("科學",),
    "SEA": ("海",),
    "SECOND": ("第二",),
    "SEVENTH": ("第七",),
    "SHELL": ("蜆殼",),
    "SHOP": ("店", "舖"),
    "SHIPYARD": ("船塢",),
    "SILVER": ("銀",),
    "SKY": ("天",),
    "SMALL": ("小",),
    "SOUTH": ("南",),
    "SPRING": ("春",),
    "SQUARE": ("四方",),
    "ST": ("聖",),
    "STAR": ("星",),
    "STATION": ("站",),
    "STREAM": ("溪", "涌"),
    "SUN": ("日", "太陽"),
    "TEMPLE": ("廟", "寺"),
    "THEATRE": ("劇院", "戲院"),
    "TIGER": ("虎",),
    "TOWN": ("城", "鎮"),
    "TREE": ("樹",),
    "TRUE": ("真",),
    "TUNNEL": ("隧道",),
    "UNITED": ("聯合",),
    "UNITY": ("合",),
    "UNIVERSITY": ("大學",),
    "UPPER": ("上",),
    "VILLAGE": ("村",),
    "VICTORY": ("勝利", "捷"),
    "WATER": ("水",),
    "WEST": ("西",),
    "WHITE": ("白",),
    "WIND": ("風",),
    "WINTER": ("冬",),
    "ZOO": ("動物園",),
}

IGNORED_ENGLISH_TOKENS = {"AND", "OF", "THE"}

CHINESE_ROAD_SUFFIXES = (
    "大道",
    "公路",
    "交匯處",
    "迴旋處",
    "天橋",
    "隧道",
    "廣場",
    "長廊",
    "走廊",
    "道",
    "街",
    "路",
    "里",
    "巷",
    "徑",
    "坊",
)


@dataclass
class RoadName:
    english: str
    chinese: str
    object_id: int
    street_code: int
    segment_count: int = 1


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"[\u2010-\u2015\u2212]", "-", value)
    value = re.sub(r"\s*-\s*", " - ", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_member(member: ET.Element) -> dict[str, str]:
    values: dict[str, str] = {}
    for attribute in member.iter():
        if attribute.tag not in (STRING_ATTRIBUTE_TAG, INT_ATTRIBUTE_TAG):
            continue
        name = attribute.get("name")
        if not name:
            continue
        value = attribute.find(VALUE_TAG)
        values[name] = clean_text(value.text if value is not None else "")
    return values


def looks_like_road_name(english: str, chinese: str) -> bool:
    english_tokens = set(re.findall(r"[A-Z]+", english.upper()))
    return bool(english_tokens & ROAD_WORDS) or chinese.endswith(
        CHINESE_ROAD_SUFFIXES
    )


def merge_duplicate_names(rows: list[RoadName]) -> list[RoadName]:
    unique: dict[tuple[str, str], RoadName] = {}
    for row in rows:
        english = clean_text(row.english)
        chinese = clean_text(row.chinese)
        key = (english, chinese)
        if key in unique:
            unique[key].segment_count += row.segment_count
        else:
            unique[key] = RoadName(
                english=english,
                chinese=chinese,
                object_id=row.object_id,
                street_code=row.street_code,
                segment_count=row.segment_count,
            )
    return sorted(
        unique.values(), key=lambda item: (item.english, item.chinese)
    )


def load_road_names(cache_path: Path) -> list[RoadName]:
    if cache_path.exists():
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
        return merge_duplicate_names(
            [RoadName(**row) for row in payload["road_names"]]
        )

    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "CUHK-TRAN3620-corpus-builder/1.0"},
    )
    unique: dict[tuple[str, str], RoadName] = {}
    features_seen = 0
    rejected = {
        "empty_or_placeholder": 0,
        "script_filter": 0,
        "length_filter": 0,
        "not_road_name": 0,
    }

    with urllib.request.urlopen(request, timeout=300) as response:
        root = None
        for event, element in ET.iterparse(response, events=("start", "end")):
            if event == "start":
                if root is None:
                    root = element
                continue
            if element.tag != MEMBER_TAG:
                continue

            values = parse_member(element)
            features_seen += 1
            english = values.get("STREET_ENAME", "")
            chinese = values.get("STREET_CNAME", "")
            object_id = int(values.get("OBJECTID") or 0)
            street_code = int(values.get("ST_CODE") or 0)

            if (
                not english
                or not chinese
                or english in {"-99", "N/A", "NULL"}
                or chinese in {"–99", "-99", "不適用"}
            ):
                rejected["empty_or_placeholder"] += 1
            elif not re.search(r"[A-Za-z]", english) or not re.search(
                r"[\u3400-\u9fff]", chinese
            ) or re.search(r"[\ue000-\uf8ff]", chinese):
                rejected["script_filter"] += 1
            elif len(english) > 100 or len(chinese) > 50:
                rejected["length_filter"] += 1
            elif not looks_like_road_name(english, chinese):
                rejected["not_road_name"] += 1
            else:
                key = (english, chinese)
                if key in unique:
                    unique[key].segment_count += 1
                else:
                    unique[key] = RoadName(
                        english=english,
                        chinese=chinese,
                        object_id=object_id,
                        street_code=street_code,
                    )

            element.clear()
            if root is not None:
                root.clear()

    road_names = merge_duplicate_names(list(unique.values()))
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(
            {
                "dataset_url": DATASET_URL,
                "source_url": SOURCE_URL,
                "schema_url": SCHEMA_URL,
                "retrieved": RETRIEVED,
                "features_seen": features_seen,
                "rejected": rejected,
                "unique_road_names": len(road_names),
                "road_names": [asdict(row) for row in road_names],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return road_names


def sample_rows(rows: list[RoadName]) -> list[RoadName]:
    def sample_key(row: RoadName) -> str:
        value = f"{SEED}:{row.chinese}\t{row.english}"
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    return sorted(rows, key=sample_key)[:SAMPLE_SIZE]


def get_jyutping(value: str) -> list[str]:
    try:
        from ToJyutping import get_jyutping_list
    except ImportError as error:
        raise SystemExit(
            "Install ToJyutping first: python -m pip install ToJyutping==3.2.0"
        ) from error

    output: list[str] = []
    for character, syllable in get_jyutping_list(value):
        if not syllable or character.isspace():
            continue
        output.append(re.sub(r"\d", "", syllable.lower()))
    return output


def remove_road_suffix(value: str) -> str:
    for suffix in sorted(CHINESE_ROAD_SUFFIXES, key=len, reverse=True):
        if value.endswith(suffix):
            return value[: -len(suffix)]
    return value


def classify(row: RoadName) -> dict[str, str]:
    english_tokens = re.findall(r"[A-Z]+", row.english.upper())
    core_tokens = [
        token
        for token in english_tokens
        if token not in ROAD_WORDS and token not in IGNORED_ENGLISH_TOKENS
    ]
    core_english = " ".join(core_tokens)

    phonetic_target = remove_road_suffix(row.chinese)
    jyutping = "".join(get_jyutping(phonetic_target))
    english_letters = re.sub(r"[^a-z]", "", core_english.lower())
    phonetic_score = (
        difflib.SequenceMatcher(None, english_letters, jyutping).ratio()
        if english_letters and jyutping
        else 0.0
    )

    semantic_evidence: list[str] = []
    for token in english_tokens:
        glosses = SEMANTIC_GLOSSES.get(token, ())
        match = next((gloss for gloss in glosses if gloss in row.chinese), None)
        if match:
            semantic_evidence.append(f"{token}->{match}")

    is_phonetic = phonetic_score >= 0.50
    is_semantic = bool(semantic_evidence)
    if is_phonetic and is_semantic:
        category = "hybrid_phonetic_semantic"
        rule = "phonetic_score>=0.50 and semantic gloss matched"
    elif is_phonetic:
        category = "phonetic_transliteration"
        rule = "phonetic_score>=0.50 and no semantic gloss matched"
    elif is_semantic:
        category = "semantic_translation"
        rule = "semantic gloss matched and phonetic_score<0.50"
    else:
        category = "conventional_or_indirect"
        rule = "no rule-based phonetic or semantic match; review required"

    return {
        "key_term": core_english,
        "category": category,
        "phonetic_score": f"{phonetic_score:.3f}",
        "semantic_evidence": "; ".join(semantic_evidence),
        "classification_method": rule,
    }


def write_dataset(rows: list[RoadName]) -> dict[str, object]:
    fieldnames = [
        "id",
        "source_text",
        "target_text",
        "source",
        "category",
        "human_checked",
        "unit",
        "key_term",
        "street_code",
        "object_id",
        "segment_count",
        "phonetic_score",
        "semantic_evidence",
        "classification_method",
        "translation_direction",
        "retrieved_date",
        "source_dataset",
        "source_url",
        "license_note",
        "notes",
    ]
    category_counts: dict[str, int] = {}
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        for number, row in enumerate(rows, start=1):
            classification = classify(row)
            category = classification["category"]
            category_counts[category] = category_counts.get(category, 0) + 1
            writer.writerow(
                {
                    "id": f"HKSTN-{number:04d}",
                    "source_text": row.chinese,
                    "target_text": row.english,
                    "source": (
                        "DATA.GOV.HK / Transport Department, Road Network "
                        f"(2nd Generation), Road centerline, OBJECTID "
                        f"{row.object_id}, ST_CODE {row.street_code}, "
                        f"retrieved {RETRIEVED}"
                    ),
                    "category": category,
                    **classification,
                    "human_checked": "no",
                    "unit": "street name",
                    "street_code": row.street_code,
                    "object_id": row.object_id,
                    "segment_count": row.segment_count,
                    "translation_direction": "zh-Hant -> en",
                    "retrieved_date": RETRIEVED,
                    "source_dataset": "Road Network (2nd Generation)",
                    "source_url": SOURCE_URL,
                    "license_note": (
                        "DATA.GOV.HK open data; attribute DATA.GOV.HK and "
                        "the Transport Department."
                    ),
                    "notes": (
                        "Official bilingual name pair. The direction reflects "
                        "the analytic framing, not necessarily historical origin."
                    ),
                }
            )

    metadata = {
        "title": "Hong Kong bilingual street names",
        "dataset_url": DATASET_URL,
        "source_url": SOURCE_URL,
        "schema_url": SCHEMA_URL,
        "publisher": "Transport Department, Hong Kong SAR Government",
        "portal": "DATA.GOV.HK",
        "source_dataset": "Road Network (2nd Generation), Road centerline",
        "source_file_last_modified": "2026-10-30",
        "retrieved": RETRIEVED,
        "sample_size": len(rows),
        "seed": SEED,
        "sample_method": (
            "After the predeclared filters, sort unique bilingual name pairs "
            "by SHA-256('3620:' + Chinese + TAB + English) and retain the "
            "lowest 500 hashes."
        ),
        "filters": [
            "Both official names non-empty and not placeholders",
            "English contains Latin letters",
            "Chinese contains CJK characters but no private-use characters",
            "English length <=100 and Chinese length <=50",
            "At least one English road-type token or Chinese road-type suffix",
            "Duplicate bilingual pairs removed",
        ],
        "category_counts": category_counts,
        "human_checked": 0,
        "orientation": "Chinese source_text -> English target_text",
        "notes": (
            "The source is an official bilingual registry, not a parallel "
            "translation archive. Categories describe the observable "
            "relationship between the two official names."
        ),
    }
    OUTPUT_METADATA.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cache",
        type=Path,
        default=DEFAULT_CACHE,
        help="Path for the reduced official-name cache.",
    )
    parser.add_argument(
        "--extract-only",
        action="store_true",
        help="Extract and report candidate names without writing the sample.",
    )
    parser.add_argument(
        "--review-sample",
        action="store_true",
        help="Print all sampled bilingual names for classification review.",
    )
    args = parser.parse_args()

    rows = load_road_names(args.cache.resolve())
    sampled = sample_rows(rows)
    if args.review_sample:
        for number, row in enumerate(sampled, start=1):
            print(f"{number:03d}\t{row.english}\t{row.chinese}")
        return
    print(
        json.dumps(
            {
                "unique_road_names": len(rows),
                "sampled": len(sampled),
                "first_sampled": [asdict(row) for row in sampled[:5]],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if args.extract_only:
        return
    if len(sampled) < SAMPLE_SIZE:
        raise SystemExit("Fewer than 500 eligible road names found.")
    metadata = write_dataset(sampled)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

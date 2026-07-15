#!/usr/bin/env python3
"""Build a compact, current Guardian Nexus data artifact from Bungie's official manifest."""

from __future__ import annotations

import json
import sqlite3
import tempfile
import time
import urllib.request
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

API_ROOT = "https://www.bungie.net/Platform"
WEB_ROOT = "https://www.bungie.net"
OUTPUT = Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "data" / "manifest.json"
GEAR_OUTPUT = OUTPUT.with_name("gear-manifest.json")
ACTIVITY_OUTPUT = OUTPUT.with_name("activity-manifest.json")
ARMOR_STAT_HASHES = {"392767087", "4244567218", "1735777505", "144602215", "2996146975", "1943323491"}


def get_json(url: str) -> dict:
    for attempt in range(4):
        request = urllib.request.Request(url, headers={"User-Agent": "Guardian-Nexus-Manifest/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("Manifest request exhausted retries")


def table_rows(connection: sqlite3.Connection, table: str) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for identifier, payload in connection.execute(f'SELECT id, json FROM "{table}"'):
        try:
            value = json.loads(payload)
            result[str(value.get("hash", identifier & 0xFFFFFFFF))] = value
        except (TypeError, json.JSONDecodeError):
            continue
    return result


def display(definition: dict) -> dict:
    props = definition.get("displayProperties") or {}
    return {
        "name": props.get("name", ""),
        "description": props.get("description", ""),
        "icon": props.get("icon", ""),
        "hasIcon": bool(props.get("hasIcon")),
    }


def minimal_item(definition: dict) -> dict:
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": display(definition),
        "itemType": definition.get("itemType"),
        "itemTypeDisplayName": definition.get("itemTypeDisplayName", ""),
        "itemTypeAndTierDisplayName": definition.get("itemTypeAndTierDisplayName", ""),
        "classType": definition.get("classType"),
        "inventory": definition.get("inventory") or {},
        "objectives": definition.get("objectives") or {},
        "setData": definition.get("setData") or {},
        "value": definition.get("value") or {},
        "traitHashes": definition.get("traitHashes") or [],
        "sourceData": definition.get("sourceData") or {},
        "sockets": definition.get("sockets") or {},
        "investmentStats": definition.get("investmentStats") or [],
        "stats": definition.get("stats") or {},
        "perks": definition.get("perks") or [],
        "plug": {"plugCategoryIdentifier": (definition.get("plug") or {}).get("plugCategoryIdentifier", "")},
        "equippableItemSetHash": definition.get("equippableItemSetHash"),
    }


def minimal_gear_item(definition: dict) -> dict:
    inventory = definition.get("inventory") or {}
    props = definition.get("displayProperties") or {}
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": {"name": props.get("name", ""), "icon": props.get("icon", "")},
        "itemType": definition.get("itemType"),
        "itemTypeDisplayName": definition.get("itemTypeDisplayName", ""),
        "classType": definition.get("classType"),
        "inventory": {"tierTypeName": inventory.get("tierTypeName", "")},
    }


def minimal_plug(definition: dict) -> dict:
    props = definition.get("displayProperties") or {}
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": {"name": props.get("name", ""), "description": props.get("description", ""), "icon": props.get("icon", "")},
        "itemTypeDisplayName": definition.get("itemTypeDisplayName", ""),
        "investmentStats": [
            {"statTypeHash": stat.get("statTypeHash"), "value": stat.get("value", stat.get("statValue", 0))}
            for stat in definition.get("investmentStats") or [] if str(stat.get("statTypeHash") or "") in ARMOR_STAT_HASHES
        ],
        "plug": {"plugCategoryIdentifier": (definition.get("plug") or {}).get("plugCategoryIdentifier", "")},
    }


def relevant_armor_plug(definition: dict) -> bool:
    props = definition.get("displayProperties") or {}
    plug = definition.get("plug") or {}
    text = " ".join([
        str(props.get("name", "")), str(props.get("description", "")),
        str(definition.get("itemTypeDisplayName", "")), str(plug.get("plugCategoryIdentifier", "")),
    ]).lower()
    has_armor_stat = any(str(stat.get("statTypeHash") or "") in ARMOR_STAT_HASHES for stat in definition.get("investmentStats") or [])
    is_armor_ornament = ("ornament" in text or "skin" in text) and ("armor" in text or "universal ornament" in text or "armor_skins" in text)
    return has_armor_stat or is_armor_ornament or any(term in text for term in (
        "archetype", "tuning", "artifice", "set bonus", "piece bonus", "pieces equipped",
        "paragon", "grenadier", "specialist", "brawler", "bulwark", "gunner"
    ))


def main() -> None:
    envelope = get_json(f"{API_ROOT}/Destiny2/Manifest/")
    if int(envelope.get("ErrorCode", 0)) != 1:
        raise RuntimeError(envelope.get("Message") or "Bungie manifest lookup failed")
    manifest = envelope["Response"]
    content_path = manifest["mobileWorldContentPaths"]["en"]
    version = str(manifest.get("version") or "unknown")

    with tempfile.TemporaryDirectory(prefix="guardian-nexus-manifest-") as temp:
        bundle_path = Path(temp) / "world.content"
        database_path = Path(temp) / "world.sqlite"
        request = urllib.request.Request(f"{WEB_ROOT}{content_path}", headers={"User-Agent": "Guardian-Nexus-Manifest/1.0"})
        with urllib.request.urlopen(request, timeout=300) as response, bundle_path.open("wb") as output:
            while block := response.read(1024 * 1024):
                output.write(block)
        if zipfile.is_zipfile(bundle_path):
            with zipfile.ZipFile(bundle_path) as archive:
                candidates = [name for name in archive.namelist() if not name.endswith("/")]
                if not candidates:
                    raise RuntimeError("Bungie manifest bundle contained no database file")
                with archive.open(candidates[0]) as source, database_path.open("wb") as output:
                    while block := source.read(1024 * 1024):
                        output.write(block)
        else:
            bundle_path.replace(database_path)
        with closing(sqlite3.connect(database_path)) as connection:
            inventory = table_rows(connection, "DestinyInventoryItemDefinition")
            collectibles = table_rows(connection, "DestinyCollectibleDefinition")
            records = table_rows(connection, "DestinyRecordDefinition")
            objectives = table_rows(connection, "DestinyObjectiveDefinition")
            activities = table_rows(connection, "DestinyActivityDefinition")
            buckets = table_rows(connection, "DestinyInventoryBucketDefinition")
            damage_types = table_rows(connection, "DestinyDamageTypeDefinition")
            stat_definitions = table_rows(connection, "DestinyStatDefinition")

    catalyst_records = {
        key: value for key, value in records.items()
        if "catalyst" in (value.get("displayProperties") or {}).get("name", "").lower()
    }
    quest_defs = {key: value for key, value in inventory.items() if int(value.get("itemType", -1)) == 12}
    gear_defs = {key: value for key, value in inventory.items() if int(value.get("itemType", -1)) == 2 and not value.get("redacted")}
    plug_defs = {key: value for key, value in inventory.items() if value.get("plug") and (value.get("displayProperties") or {}).get("name") and relevant_armor_plug(value)}
    objective_hashes: set[str] = set()
    for definition in quest_defs.values():
        objective_hashes.update(str(value) for value in (definition.get("objectives") or {}).get("objectiveHashes", []))

    class_names = {0: "Titan", 1: "Hunter", 2: "Warlock"}
    items = []
    for item_hash, definition in inventory.items():
        props = definition.get("displayProperties") or {}
        inventory_data = definition.get("inventory") or {}
        item_type = int(definition.get("itemType", -1))
        if int(inventory_data.get("tierType", -1)) != 6 or item_type not in (2, 3):
            continue
        name = props.get("name", "").strip()
        if not name or definition.get("redacted") or not props.get("hasIcon"):
            continue
        collectible_hash = str(definition.get("collectibleHash") or "")
        collectible = collectibles.get(collectible_hash, {})
        source = collectible.get("sourceString") or (definition.get("sourceData") or {}).get("sourceName") or ""
        bucket_hash = str(inventory_data.get("bucketTypeHash") or "")
        damage_hash = str(definition.get("defaultDamageTypeHash") or "")
        lowered_name = name.lower()
        catalyst_hashes = [
            record_hash for record_hash, record in catalyst_records.items()
            if lowered_name in (record.get("displayProperties") or {}).get("name", "").lower()
        ]
        items.append({
            "itemHash": item_hash,
            "collectibleHash": collectible_hash or None,
            "name": name,
            "description": props.get("description", ""),
            "icon": props.get("icon", ""),
            "watermark": definition.get("iconWatermark") or definition.get("iconWatermarkShelved", ""),
            "kind": "weapon" if item_type == 3 else "armor",
            "className": class_names.get(int(definition.get("classType", 3))) if item_type == 2 else None,
            "slot": (buckets.get(bucket_hash, {}).get("displayProperties") or {}).get("name", "Unknown slot"),
            "itemType": definition.get("itemTypeDisplayName") or definition.get("itemTypeAndTierDisplayName", "Exotic"),
            "damageType": (damage_types.get(damage_hash, {}).get("displayProperties") or {}).get("name") or None,
            "source": source,
            "catalystRecordHashes": catalyst_hashes,
        })

    compact = {
        "version": version,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "items": sorted(items, key=lambda item: (item["kind"], item["slot"], item["name"])),
        "itemDefinitions": {key: minimal_item(value) for key, value in quest_defs.items()},
        "objectiveDefinitions": {
            key: {"hash": key, "displayProperties": display(value), "progressDescription": value.get("progressDescription", ""), "completionValue": value.get("completionValue", 0)}
            for key, value in objectives.items() if key in objective_hashes
        },
        "activityDefinitions": {
            key: {"hash": key, "displayProperties": display(value), "activityTypeHash": str(value.get("activityTypeHash") or "")}
            for key, value in activities.items()
        },
        "recordDefinitions": {
            key: {"hash": key, "displayProperties": display(value), "objectives": value.get("objectives") or []}
            for key, value in catalyst_records.items()
        },
    }
    gear_compact = {
        "version": version,
        "generatedAt": compact["generatedAt"],
        "gearItemDefinitions": {key: minimal_gear_item(value) for key, value in gear_defs.items()},
        "plugDefinitions": {key: minimal_plug(value) for key, value in plug_defs.items()},
        "statDefinitions": {key: {"hash": key, "displayProperties": display(value)} for key, value in stat_definitions.items() if key in {"392767087", "4244567218", "1735777505", "144602215", "2996146975", "1943323491"}},
    }
    activity_compact = {
        "version": version,
        "generatedAt": compact["generatedAt"],
        "items": [],
        "itemDefinitions": {},
        "objectiveDefinitions": {},
        "activityDefinitions": compact["activityDefinitions"],
        "recordDefinitions": {},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    GEAR_OUTPUT.write_text(json.dumps(gear_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    ACTIVITY_OUTPUT.write_text(json.dumps(activity_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(items)} Exotics, {len(gear_defs)} armor definitions, {len(plug_defs)} plug definitions, and {len(quest_defs)} quests for manifest {version}.")


if __name__ == "__main__":
    main()

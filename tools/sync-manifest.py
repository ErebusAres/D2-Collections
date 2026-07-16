#!/usr/bin/env python3
"""Build a compact, current Guardian Nexus data artifact from Bungie's official manifest."""

from __future__ import annotations

import argparse
import json
import re
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
FEATURE_OUTPUT = OUTPUT.with_name("collection-features.json")
PURSUIT_OUTPUT = OUTPUT.with_name("pursuit-manifest.json")
REWARDS_OUTPUT = OUTPUT.with_name("rewards-manifest.json")
COMPANION_OUTPUT = OUTPUT.with_name("companion-manifest.json")
REWARD_CODE_OUTPUT = OUTPUT.with_name("reward-code-manifest.json")
REWARD_CODE_CATALOG = OUTPUT.parents[2] / "src" / "modules" / "reward-codes" / "rewardCodesCatalog.json"
COMPANION_CHUNK_COUNT = 24
ARMOR_STAT_HASHES = {"392767087", "4244567218", "1735777505", "144602215", "2996146975", "1943323491"}
COLLECTION_FEATURE_PATTERN = re.compile(r"\b(?:stance|faction|lawless|crystal|form|combo|reversal|mode|catalyst)\b", re.IGNORECASE)


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


def minimal_pursuit_item(definition: dict) -> dict:
    inventory = definition.get("inventory") or {}
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": display(definition),
        "itemType": definition.get("itemType"),
        "itemTypeDisplayName": definition.get("itemTypeDisplayName", ""),
        "itemTypeAndTierDisplayName": definition.get("itemTypeAndTierDisplayName", ""),
        "inventory": {"tierType": inventory.get("tierType"), "tierTypeName": inventory.get("tierTypeName", "")},
        "objectives": definition.get("objectives") or {},
        "setData": definition.get("setData") or {},
        "value": definition.get("value") or {},
        "traitHashes": definition.get("traitHashes") or [],
        "sourceData": definition.get("sourceData") or {},
        "flavorText": definition.get("flavorText", ""),
    }


def minimal_reward_item(definition: dict) -> dict:
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": display(definition),
        "itemTypeDisplayName": definition.get("itemTypeDisplayName", ""),
    }


def minimal_reward_code_item(item_hash: str, definition: dict) -> dict:
    properties = definition.get("displayProperties") or {}
    return {
        "itemHash": item_hash,
        "collectibleHash": str(definition.get("collectibleHash") or ""),
        "name": properties.get("name", ""),
        "icon": properties.get("icon", ""),
        "itemType": definition.get("itemTypeDisplayName", ""),
    }


def reward_code_manifest(catalog: list[dict], inventory: dict[str, dict], version: str, generated_at: str) -> dict:
    inventory_by_name: dict[str, list[tuple[str, dict]]] = {}
    for item_hash, definition in inventory.items():
        name = str((definition.get("displayProperties") or {}).get("name", "")).strip().casefold()
        if name and not definition.get("redacted"):
            inventory_by_name.setdefault(name, []).append((item_hash, definition))
    definitions = {}
    for entry in catalog:
        matches = inventory_by_name.get(str(entry.get("reward", "")).strip().casefold(), [])
        definitions[str(entry.get("code", ""))] = {
            "reward": entry.get("reward", ""),
            "items": [
                minimal_reward_code_item(item_hash, definition)
                for item_hash, definition in matches
                if definition.get("collectibleHash")
            ],
        }
    return {"version": version, "generatedAt": generated_at, "definitions": definitions}


def minimal_companion_item(definition: dict, damage_types: dict[str, dict], buckets: dict[str, dict]) -> dict:
    inventory = definition.get("inventory") or {}
    properties = definition.get("displayProperties") or {}
    plug = definition.get("plug") or {}
    damage_hash = str(definition.get("defaultDamageTypeHash") or "")
    bucket_hash = str(inventory.get("bucketTypeHash") or "")
    return {
        "displayProperties": {
            "name": properties.get("name", ""),
            "icon": properties.get("icon", ""),
            **({"description": properties.get("description", "")} if plug else {}),
        },
        "itemType": definition.get("itemType"),
        "itemTypeDisplayName": definition.get("itemTypeDisplayName", ""),
        "inventory": {
            "tierTypeName": inventory.get("tierTypeName", ""),
            "bucketTypeHash": bucket_hash,
        },
        "equipmentSlot": (buckets.get(bucket_hash, {}).get("displayProperties") or {}).get("name", ""),
        "damageType": (damage_types.get(damage_hash, {}).get("displayProperties") or {}).get("name", ""),
        **({"plug": {"plugCategoryIdentifier": plug.get("plugCategoryIdentifier", "")}} if plug else {}),
    }


def minimal_bucket(definition: dict) -> dict:
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": display(definition),
        "scope": definition.get("scope"),
        "category": definition.get("category"),
        "itemCount": definition.get("itemCount", 0),
        "location": definition.get("location"),
        "enabled": bool(definition.get("enabled", True)),
    }


def minimal_loadout_name(definition: dict) -> dict:
    return {"name": definition.get("name", "")}


def minimal_loadout_icon(definition: dict) -> dict:
    return {"iconImagePath": definition.get("iconImagePath", "")}


def minimal_loadout_color(definition: dict) -> dict:
    return {"colorImagePath": definition.get("colorImagePath", "")}


def minimal_season_pass(definition: dict) -> dict:
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": display(definition),
        "rewardProgressionHash": str(definition.get("rewardProgressionHash") or ""),
        "prestigeProgressionHash": str(definition.get("prestigeProgressionHash") or ""),
        "linkRedirectPath": definition.get("linkRedirectPath", ""),
        "images": definition.get("images") or {},
    }


def minimal_progression(definition: dict) -> dict:
    return {
        "hash": str(definition.get("hash", "")),
        "displayProperties": display(definition),
        "repeatLastStep": bool(definition.get("repeatLastStep")),
        "rewardItems": definition.get("rewardItems") or [],
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
    parser = argparse.ArgumentParser(description="Build compact Guardian Nexus manifest artifacts.")
    parser.add_argument("--companion-only", action="store_true", help="Only write the mailbox/loadouts companion artifact.")
    parser.add_argument("--reward-codes-only", action="store_true", help="Only write the reward-code collectible mapping artifact.")
    args = parser.parse_args()
    reward_code_catalog = json.loads(REWARD_CODE_CATALOG.read_text(encoding="utf-8"))
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
            plug_sets = table_rows(connection, "DestinyPlugSetDefinition")
            season_passes = table_rows(connection, "DestinySeasonPassDefinition")
            progressions = table_rows(connection, "DestinyProgressionDefinition")
            loadout_names = table_rows(connection, "DestinyLoadoutNameDefinition")
            loadout_icons = table_rows(connection, "DestinyLoadoutIconDefinition")
            loadout_colors = table_rows(connection, "DestinyLoadoutColorDefinition")

    generated_at = datetime.now(timezone.utc).isoformat()
    reward_code_compact = reward_code_manifest(reward_code_catalog, inventory, version, generated_at)
    if args.reward_codes_only:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        REWARD_CODE_OUTPUT.write_text(json.dumps(reward_code_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        resolved_codes = sum(bool(value["items"]) for value in reward_code_compact["definitions"].values())
        print(f"Wrote {resolved_codes}/{len(reward_code_compact['definitions'])} reward-code mappings for manifest {version}.")
        return
    companion_items = {
        key: minimal_companion_item(value, damage_types, buckets)
        for key, value in inventory.items()
        if not value.get("redacted") and (value.get("displayProperties") or {}).get("name")
    }
    companion_chunks: list[dict[str, dict]] = [{} for _ in range(COMPANION_CHUNK_COUNT)]
    for key, value in companion_items.items():
        companion_chunks[int(key) % COMPANION_CHUNK_COUNT][key] = value
    companion_chunk_paths = [f"companion-manifest-{index:02d}.json" for index in range(COMPANION_CHUNK_COUNT)]
    companion_compact = {
        "version": version,
        "generatedAt": generated_at,
        "itemDefinitions": {},
        "itemDefinitionChunks": companion_chunk_paths,
        "bucketDefinitions": {key: minimal_bucket(value) for key, value in buckets.items() if not value.get("redacted")},
        "loadoutNameDefinitions": {key: minimal_loadout_name(value) for key, value in loadout_names.items()},
        "loadoutIconDefinitions": {key: minimal_loadout_icon(value) for key, value in loadout_icons.items()},
        "loadoutColorDefinitions": {key: minimal_loadout_color(value) for key, value in loadout_colors.items()},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    for chunk_path, chunk in zip(companion_chunk_paths, companion_chunks):
        COMPANION_OUTPUT.with_name(chunk_path).write_text(
            json.dumps({"itemDefinitions": chunk}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    COMPANION_OUTPUT.write_text(json.dumps(companion_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if args.companion_only:
        print(f"Wrote {len(companion_items)} item definitions and {len(buckets)} bucket definitions for companion manifest {version}.")
        return

    catalyst_records = {
        key: value for key, value in records.items()
        if "catalyst" in (value.get("displayProperties") or {}).get("name", "").lower()
    }
    quest_defs = {key: value for key, value in inventory.items() if int(value.get("itemType", -1)) == 12}
    pursuit_defs = {
        key: value for key, value in inventory.items()
        if int(value.get("itemType", -1)) != 12
        and any(term in str(value.get("itemTypeDisplayName") or value.get("itemTypeAndTierDisplayName") or "").lower() for term in ("quest", "mission", "pursuit", "bounty", "order"))
    }
    all_quest_defs = {**quest_defs, **pursuit_defs}
    gear_defs = {key: value for key, value in inventory.items() if int(value.get("itemType", -1)) == 2 and not value.get("redacted")}
    plug_defs = {key: value for key, value in inventory.items() if value.get("plug") and (value.get("displayProperties") or {}).get("name") and relevant_armor_plug(value)}
    base_objective_hashes = {
        str(value) for definition in quest_defs.values()
        for value in (definition.get("objectives") or {}).get("objectiveHashes", [])
    }
    pursuit_objective_hashes = {
        str(value) for definition in pursuit_defs.values()
        for value in (definition.get("objectives") or {}).get("objectiveHashes", [])
    }

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

    related_item_hashes: set[str] = set()
    for definition in all_quest_defs.values():
        related_item_hashes.update(
            str(value.get("itemHash") or "")
            for value in (definition.get("value") or {}).get("itemValue", [])
        )
    related_defs = {key: inventory[key] for key in related_item_hashes if key and key != "0" and key in inventory}
    collection_feature_definitions = {}
    for item in items:
        if item["kind"] != "weapon":
            continue
        definition = inventory.get(item["itemHash"], {})
        features = {}
        for socket in (definition.get("sockets") or {}).get("socketEntries", []):
            hashes = [str(socket.get("singleInitialItemHash") or "")]
            hashes.extend(str(plug.get("plugItemHash") or plug.get("itemHash") or "") for plug in socket.get("reusablePlugItems", []))
            for set_key in ("reusablePlugSetHash", "randomizedPlugSetHash"):
                plug_set = plug_sets.get(str(socket.get(set_key) or ""), {})
                hashes.extend(str(plug.get("plugItemHash") or plug.get("itemHash") or "") for plug in plug_set.get("reusablePlugItems", []))
            for feature_hash in hashes:
                feature = inventory.get(feature_hash, {})
                properties = feature.get("displayProperties") or {}
                text = " ".join((str(properties.get("name", "")), str(properties.get("description", "")), str((feature.get("plug") or {}).get("plugCategoryIdentifier", "")))).lower()
                name = str(properties.get("name", ""))
                if not feature_hash or feature_hash == "0" or not name or name.lower().startswith("empty ") or not COLLECTION_FEATURE_PATTERN.search(text):
                    continue
                features[feature_hash] = {
                    "itemHash": feature_hash,
                    "name": properties.get("name", ""),
                    "description": properties.get("description", ""),
                    "icon": properties.get("icon", ""),
                }
        if features:
            collection_feature_definitions[item["itemHash"]] = list(features.values())

    compact = {
        "version": version,
        "generatedAt": generated_at,
        "items": sorted(items, key=lambda item: (item["kind"], item["slot"], item["name"])),
        "itemDefinitions": {key: minimal_item(value) for key, value in quest_defs.items()},
        "objectiveDefinitions": {
            key: {"hash": key, "displayProperties": display(value), "progressDescription": value.get("progressDescription", ""), "completionValue": value.get("completionValue", 0)}
            for key, value in objectives.items() if key in base_objective_hashes
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
    feature_compact = {"version": version, "generatedAt": compact["generatedAt"], "collectionFeatureDefinitions": collection_feature_definitions}
    pursuit_compact = {
        "version": version,
        "generatedAt": compact["generatedAt"],
        "itemDefinitions": {
            **{key: minimal_pursuit_item(value) for key, value in pursuit_defs.items()},
            **{key: minimal_reward_item(value) for key, value in related_defs.items()},
        },
        "objectiveDefinitions": {
            key: {"hash": key, "displayProperties": display(value), "progressDescription": value.get("progressDescription", ""), "completionValue": value.get("completionValue", 0)}
            for key, value in objectives.items() if key in pursuit_objective_hashes
        },
    }
    gear_compact = {
        "version": version,
        "generatedAt": compact["generatedAt"],
        "gearItemDefinitions": {key: minimal_gear_item(value) for key, value in gear_defs.items()},
        "plugDefinitions": {key: minimal_plug(value) for key, value in plug_defs.items()},
        "statDefinitions": {key: {"hash": key, "displayProperties": display(value)} for key, value in stat_definitions.items() if key in {"392767087", "4244567218", "1735777505", "144602215", "2996146975", "1943323491"}},
    }
    reward_progression_hashes = {
        str(value.get(field) or "")
        for value in season_passes.values()
        for field in ("rewardProgressionHash", "prestigeProgressionHash")
        if value.get(field)
    }
    reward_progressions = {
        key: value for key, value in progressions.items()
        if key in reward_progression_hashes
    }
    reward_item_hashes = {
        str(reward.get("itemHash") or "")
        for progression in reward_progressions.values()
        for reward in progression.get("rewardItems") or []
        if reward.get("itemHash")
    }
    rewards_compact = {
        "version": version,
        "generatedAt": compact["generatedAt"],
        "seasonPassDefinitions": {
            key: minimal_season_pass(value)
            for key, value in season_passes.items()
            if not value.get("redacted") and str(value.get("rewardProgressionHash") or "") in reward_progressions
        },
        "progressionDefinitions": {key: minimal_progression(value) for key, value in reward_progressions.items()},
        "itemDefinitions": {
            key: minimal_reward_item(inventory[key])
            for key in reward_item_hashes
            if key in inventory and not inventory[key].get("redacted")
        },
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
    OUTPUT.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    GEAR_OUTPUT.write_text(json.dumps(gear_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    ACTIVITY_OUTPUT.write_text(json.dumps(activity_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    FEATURE_OUTPUT.write_text(json.dumps(feature_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    PURSUIT_OUTPUT.write_text(json.dumps(pursuit_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    REWARDS_OUTPUT.write_text(json.dumps(rewards_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    REWARD_CODE_OUTPUT.write_text(json.dumps(reward_code_compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    resolved_codes = sum(bool(value["items"]) for value in reward_code_compact["definitions"].values())
    print(f"Wrote {len(items)} Exotics, {len(gear_defs)} armor definitions, {len(plug_defs)} plug definitions, {len(quest_defs)} quests, {len(pursuit_defs)} compact pursuits, {len(reward_item_hashes)} Rewards Pass items, {resolved_codes}/{len(reward_code_compact['definitions'])} reward-code mappings, and {len(companion_items)} companion item definitions for manifest {version}.")


if __name__ == "__main__":
    main()

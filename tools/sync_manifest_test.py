from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("sync-manifest.py")
SPEC = importlib.util.spec_from_file_location("guardian_nexus_sync_manifest", MODULE_PATH)
assert SPEC and SPEC.loader
SYNC_MANIFEST = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SYNC_MANIFEST)


class BuildCatalogClassificationTests(unittest.TestCase):
    def test_quest_definitions_follow_the_official_inventory_bucket_after_type_changes(self) -> None:
        self.assertTrue(SYNC_MANIFEST.is_quest_definition({"itemType": 12, "inventory": {}}))
        self.assertTrue(SYNC_MANIFEST.is_quest_definition({"itemType": 26, "itemTypeDisplayName": "", "inventory": {"bucketTypeHash": 1345459588}}))
        self.assertFalse(SYNC_MANIFEST.is_quest_definition({"itemType": 26, "itemTypeDisplayName": "Tower Order", "inventory": {"bucketTypeHash": 635141261}}))

    def test_compact_pursuit_manifest_keeps_true_quests_and_temporary_orders(self) -> None:
        definitions = SYNC_MANIFEST.compact_pursuit_definitions(
            {"quest": {"hash": 1, "itemType": 12, "displayProperties": {"name": "Story Quest"}}},
            {"order": {"hash": 2, "itemType": 26, "itemTypeDisplayName": "Tower Order", "displayProperties": {"name": "Daily Order"}}},
            {"reward": {"hash": 3, "itemTypeDisplayName": "Currency", "displayProperties": {"name": "Reward"}}},
        )

        self.assertEqual(set(definitions), {"quest", "order", "reward"})
        self.assertEqual(definitions["quest"]["itemType"], 12)
        self.assertEqual(definitions["order"]["itemTypeDisplayName"], "Tower Order")

    def test_guardian_rank_manifest_follows_rank_nodes_to_categories_and_records(self) -> None:
        compact = SYNC_MANIFEST.guardian_rank_manifest(
            {"1": {"rankCount": 2, "guardianRankHashes": [1, 2], "rootNodeHash": 100}},
            {
                "1": {"hash": 1, "rankNumber": 1, "presentationNodeHash": 101, "displayProperties": {"name": "New Light"}},
                "2": {"hash": 2, "rankNumber": 2, "presentationNodeHash": 102, "displayProperties": {"name": "Explorer"}},
            },
            {
                "100": {"hash": 100, "children": {"presentationNodes": [{"presentationNodeHash": 101}, {"presentationNodeHash": 102}]}},
                "101": {"hash": 101, "completionRecordHash": 201, "children": {}},
                "102": {"hash": 102, "completionRecordHash": 202, "children": {"presentationNodes": [{"presentationNodeHash": 103}]}},
                "103": {"hash": 103, "isSeasonal": True, "displayProperties": {"name": "Ranking Up"}, "children": {"records": [{"recordHash": 203}]}},
            },
            {
                "201": {"hash": 201, "objectiveHashes": []},
                "202": {"hash": 202, "objectiveHashes": []},
                "203": {"hash": 203, "scope": 1, "objectiveHashes": [301], "displayProperties": {"name": "The Vanguard"}},
            },
            {"301": {"hash": 301, "progressDescription": "Complete the introduction", "completionValue": 1}},
            "test",
            "now",
        )

        self.assertEqual([rank["rankNumber"] for rank in compact["ranks"]], [1, 2])
        self.assertEqual(compact["maximumRank"], 3)
        self.assertEqual(compact["nodes"]["102"]["childNodeHashes"], ["103"])
        self.assertEqual(compact["nodes"]["103"]["recordHashes"], ["203"])
        self.assertEqual(compact["records"]["203"]["objectiveHashes"], ["301"])
        self.assertEqual(compact["objectives"]["301"]["name"], "Complete the introduction")

    def test_pvp_progressions_are_classified_from_manifest_and_faction_text(self) -> None:
        factions = {
            "10": {"displayProperties": {"name": "Crucible", "description": "Earn reputation with Lord Shaxx."}},
            "20": {"displayProperties": {"name": "Iron Banner"}},
        }

        self.assertEqual(SYNC_MANIFEST.pvp_progression_kind({"factionHash": 10, "displayProperties": {"name": "Rank"}}, factions), "crucible")
        self.assertEqual(SYNC_MANIFEST.pvp_progression_kind({"factionHash": 20, "displayProperties": {"name": "Seasonal Reputation"}}, factions), "iron-banner")
        self.assertEqual(SYNC_MANIFEST.pvp_progression_kind({"displayProperties": {"name": "Competitive Division Rank"}}, factions), "competitive")
        self.assertEqual(SYNC_MANIFEST.pvp_progression_kind({"displayProperties": {"name": "Trials of Osiris Rank"}}, factions), "trials")
        self.assertIsNone(SYNC_MANIFEST.pvp_progression_kind({"displayProperties": {"name": "Vanguard Rank"}}, factions))

    def test_minimal_pvp_progression_keeps_rank_labels_and_thresholds(self) -> None:
        value = SYNC_MANIFEST.minimal_pvp_progression({
            "hash": 123,
            "displayProperties": {"name": "Crucible Rank"},
            "steps": [{"stepName": "Brave II", "progressTotal": 375, "icon": "/rank.png"}],
        }, "crucible")

        self.assertEqual(value["kind"], "crucible")
        self.assertEqual(value["steps"], [{"stepName": "Brave II", "progressTotal": 375, "icon": "/rank.png"}])

    def test_stasis_aspect_uses_manifest_trait_when_plug_is_legacy_totem(self) -> None:
        definition = item_definition(
            name="Bleak Watcher",
            item_type="Stasis Aspect",
            plug="warlock.stasis.totems",
            trait_id="item.plug.aspect",
        )

        self.assertEqual(SYNC_MANIFEST.build_catalog_kind(definition), "aspect")
        self.assertEqual(SYNC_MANIFEST.build_subclass(definition, "warlock"), "stasis")

    def test_stasis_fragment_uses_manifest_trait_when_plug_is_legacy_trinket(self) -> None:
        definition = item_definition(
            name="Whisper of Fissures",
            item_type="Stasis Fragment",
            plug="shared.stasis.trinkets",
            trait_id="item.plug.fragment",
        )

        self.assertEqual(SYNC_MANIFEST.build_catalog_kind(definition), "fragment")
        self.assertEqual(SYNC_MANIFEST.build_subclass(definition, None), "stasis")

    def test_grenade_launcher_language_is_not_classified_as_a_subclass_grenade(self) -> None:
        definition = item_definition(
            name="Achronal Festival Flight",
            item_type="Weapon Ornament",
            plug="v490_new_grenade_launcher0_skins",
        )

        self.assertNotEqual(SYNC_MANIFEST.build_catalog_kind(definition), "grenade")

    def test_prismatic_transcendence_is_a_searchable_ability(self) -> None:
        definition = item_definition(
            name="Transcendence",
            item_type="Utility Ability",
            plug="hunter.prism.transcendence",
        )

        self.assertEqual(SYNC_MANIFEST.build_catalog_kind(definition), "transcendence")
        self.assertEqual(SYNC_MANIFEST.build_subclass(definition, "hunter"), "prismatic")

    def test_catalog_writer_prefers_playable_subclass_icons(self) -> None:
        banner = {"hash": "banner", "kind": "subclass", "classType": "warlock", "subclass": "solar", "slot": "", "rarity": "", "icon": "https://www.bungie.net/dawnblade.jpg"}
        playable = {"hash": "playable", "kind": "subclass", "classType": "warlock", "subclass": "solar", "slot": "Subclass", "rarity": "Common", "icon": "https://www.bungie.net/dawnblade.png"}

        self.assertEqual(SYNC_MANIFEST.canonical_subclass_entries([banner, playable]), [playable])

    def test_class_catalog_uses_the_in_game_glyph_when_manifest_icon_is_missing(self) -> None:
        entry = SYNC_MANIFEST.build_class_catalog_entry("671679327", {
            "classType": 1,
            "displayProperties": {"name": "Hunter", "description": ""},
        })

        self.assertIsNotNone(entry)
        self.assertEqual(entry["icon"], "/icons/destiny/class-hunter.svg")
        self.assertEqual(entry["classType"], "hunter")

    def test_every_exotic_class_item_has_two_complete_spirit_columns(self) -> None:
        self.assertEqual(set(SYNC_MANIFEST.EXOTIC_SPIRIT_POOLS), {"relativism", "stoicism", "solipsism"})
        for class_item, rows in SYNC_MANIFEST.EXOTIC_SPIRIT_POOLS.items():
            with self.subTest(class_item=class_item):
                self.assertEqual(len(rows["row1"]), 8)
                self.assertEqual(len(rows["row2"]), 8)
                self.assertEqual(len(set(rows["row1"])), 8)
                self.assertEqual(len(set(rows["row2"])), 8)

    def test_artifact_two_uses_two_three_two_slots(self) -> None:
        inventory = {str(value): item_definition(name=f"Perk {value}", item_type="Artifact Perk", plug="artifact_perks") for value in range(10, 16)}
        plug_sets = {
            "a": {"reusablePlugItems": [{"plugItemHash": 10}, {"plugItemHash": 11}]},
            "b": {"reusablePlugItems": [{"plugItemHash": 12}, {"plugItemHash": 13}]},
            "c": {"reusablePlugItems": [{"plugItemHash": 14}, {"plugItemHash": 15}]},
        }
        definition = {"sockets": {"socketEntries": [
            {"reusablePlugSetHash": "a"}, {"reusablePlugSetHash": "a"},
            {"reusablePlugSetHash": "b"}, {"reusablePlugSetHash": "b"}, {"reusablePlugSetHash": "b"},
            {"reusablePlugSetHash": "c"}, {"reusablePlugSetHash": "c"},
        ]}}

        self.assertEqual(SYNC_MANIFEST.artifact_perk_pool(definition, inventory, plug_sets), {
            "tiers": {"1": ["10", "11"], "2": ["12", "13"], "3": ["14", "15"]},
            "slots": {"1": 2, "2": 3, "3": 2},
        })

    def test_artifact_two_removes_perks_repeated_by_cumulative_plug_sets(self) -> None:
        inventory = {str(value): item_definition(name=f"Perk {value}", item_type="Artifact Perk", plug="artifact_perks") for value in range(10, 16)}
        plug_sets = {
            "a": {"reusablePlugItems": [{"plugItemHash": 10}, {"plugItemHash": 11}]},
            "b": {"reusablePlugItems": [{"plugItemHash": value} for value in range(10, 14)]},
            "c": {"reusablePlugItems": [{"plugItemHash": value} for value in range(10, 16)]},
        }
        definition = {"sockets": {"socketEntries": [
            {"reusablePlugSetHash": "a"}, {"reusablePlugSetHash": "a"},
            {"reusablePlugSetHash": "b"}, {"reusablePlugSetHash": "b"}, {"reusablePlugSetHash": "b"},
            {"reusablePlugSetHash": "c"}, {"reusablePlugSetHash": "c"},
        ]}}

        self.assertEqual(SYNC_MANIFEST.artifact_perk_pool(definition, inventory, plug_sets), {
            "tiers": {"1": ["10", "11"], "2": ["12", "13"], "3": ["14", "15"]},
            "slots": {"1": 2, "2": 3, "3": 2},
        })


def item_definition(*, name: str, item_type: str, plug: str, trait_id: str | None = None) -> dict:
    return {
        "displayProperties": {"name": name},
        "itemTypeDisplayName": item_type,
        "plug": {"plugCategoryIdentifier": plug},
        "traitIds": [trait_id] if trait_id else [],
    }


if __name__ == "__main__":
    unittest.main()

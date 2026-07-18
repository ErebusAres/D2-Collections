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


def item_definition(*, name: str, item_type: str, plug: str, trait_id: str | None = None) -> dict:
    return {
        "displayProperties": {"name": name},
        "itemTypeDisplayName": item_type,
        "plug": {"plugCategoryIdentifier": plug},
        "traitIds": [trait_id] if trait_id else [],
    }


if __name__ == "__main__":
    unittest.main()

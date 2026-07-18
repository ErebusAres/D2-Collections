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

    def test_every_exotic_class_item_has_two_complete_spirit_columns(self) -> None:
        self.assertEqual(set(SYNC_MANIFEST.EXOTIC_SPIRIT_POOLS), {"relativism", "stoicism", "solipsism"})
        for class_item, rows in SYNC_MANIFEST.EXOTIC_SPIRIT_POOLS.items():
            with self.subTest(class_item=class_item):
                self.assertEqual(len(rows["row1"]), 8)
                self.assertEqual(len(rows["row2"]), 8)
                self.assertEqual(len(set(rows["row1"])), 8)
                self.assertEqual(len(set(rows["row2"])), 8)


def item_definition(*, name: str, item_type: str, plug: str, trait_id: str | None = None) -> dict:
    return {
        "displayProperties": {"name": name},
        "itemTypeDisplayName": item_type,
        "plug": {"plugCategoryIdentifier": plug},
        "traitIds": [trait_id] if trait_id else [],
    }


if __name__ == "__main__":
    unittest.main()

import assert from "node:assert/strict";
import test from "node:test";
import { compileWeaponRatings } from "./sync-weapon-ratings.mjs";

const manifest = { gearItemDefinitions: {
  "100": { hash: "100", itemType: 3, itemTypeDisplayName: "Test Rifle" },
  "200": { hash: "200", itemType: 3, itemTypeDisplayName: "Test Rifle" },
  "300": { hash: "300", itemType: 2, itemTypeDisplayName: "Helmet" }
} };
const source = `
//notes:Curated PvE recommendation |tags:PvE
dimwishlist:item=100&perks=1,2,3,4
//notes:Curated PvP recommendation |tags:PvP
dimwishlist:item=100&perks=5,6,7,8
//notes:Traits-only PvE recommendation |tags:PvE
dimwishlist:item=200&perks=3,4
dimwishlist:item=300&perks=1,2,3,4
// divider closes the preceding block notes
dimwishlist:item=100&perks=9,9,9,9
`;

test("compiles column-aware item records and type fallbacks", () => {
  const result = compileWeaponRatings(manifest, source, "2026-08-08");
  assert.deepEqual(result.coverage, { manifestWeapons: 2, reviewedWeapons: 2, supportedTypes: 1, reviewedTypes: 1 });
  assert.deepEqual(result.items["100"].pve.columns, [["1"], ["2"], ["3"], ["4"]]);
  assert.deepEqual(result.items["100"].pve.traitPairs, ["3,4"]);
  assert.equal(result.items["100"].pve.recommendations, 1);
  assert.deepEqual(result.items["200"].pve.columns, [[], [], ["3"], ["4"]]);
  assert.equal(result.types["Test Rifle"].pve.weapons, 2);
  assert.equal(result.types["Test Rifle"].pve.columns[2]["3"], 100);
  assert.equal(result.items["300"], undefined);
  assert.equal(result.schemaVersion, 4);
});

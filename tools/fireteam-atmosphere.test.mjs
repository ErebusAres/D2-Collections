import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesheetPath = new URL(
  "../apps/web/src/styles/destination-atmospheres.css",
  import.meta.url,
);

const destinationCss = await readFile(stylesheetPath, "utf8");

test("Fireteam destination identity stays on rails, frames, and tracked-item borders", () => {
  assert.match(destinationCss, /width:\s*clamp\(16px,\s*2\.4vw,\s*38px\)/);
  assert.match(destinationCss, /\[data-location-theme\]::before/);
  assert.match(destinationCss, /\[data-location-theme\]\s+\[data-tracking-state\]/);
});

test("Fireteam destination themes do not create a page-wide scene or tint", () => {
  assert.doesNotMatch(destinationCss, /--destination-scene/);
  assert.doesNotMatch(destinationCss, /--destination-card\s*:/);
  assert.doesNotMatch(destinationCss, /background:\s*var\(--destination-scene/);
  assert.doesNotMatch(destinationCss, /inset:\s*118px\s+0\s+0/);
});

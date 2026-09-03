import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [
  appSource,
  optionsSource,
  feedSource,
  feedStyles,
  fanfareStyles,
  fireteamSource,
  mainSource,
  packageSource
] = await Promise.all([
  readFile(new URL("apps/web/src/App.tsx", root), "utf8"),
  readFile(new URL("apps/web/src/components/layout/OptionsPanel.tsx", root), "utf8"),
  readFile(new URL("apps/web/src/components/notifications/GuardianFeed.tsx", root), "utf8"),
  readFile(new URL("apps/web/src/styles/notifications/GuardianFeed.module.css", root), "utf8"),
  readFile(new URL("apps/web/src/styles/guardian-fanfare.css", root), "utf8"),
  readFile(new URL("apps/web/src/pages/FireteamPage.tsx", root), "utf8"),
  readFile(new URL("apps/web/src/main.tsx", root), "utf8"),
  readFile(new URL("package.json", root), "utf8")
]);

test("notification fanfare stays inside the banner and plays once", () => {
  assert.match(feedStyles, /\.feed\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(feedStyles, /\.feed\s*\{[^}]*contain:\s*paint;/s);
  assert.doesNotMatch(`${feedSource}\n${fanfareStyles}`, /data-notification-atmosphere|guardian-fanfare-polish/);
  assert.doesNotMatch(`${feedStyles}\n${fanfareStyles}`, /\binfinite\b/);
  assert.doesNotMatch(feedStyles, /@keyframes\s+scroll/);
});

test("every notification category has a distinct contained entrance", () => {
  for (const animation of [
    "distortion",
    "crucible",
    "trials",
    "ironBanner",
    "gambit",
    "vanguard",
    "exotic",
    "legendary",
    "seasonal",
    "eververse",
    "bungieNews",
    "completion",
    "warning",
    "outage",
    "redemptionCode",
    "system"
  ]) {
    assert.match(fanfareStyles, new RegExp(`data-guardian-animation="${animation}"`));
  }

  for (const keyframe of [
    "gn-disruption-wave",
    "gn-crucible-sword",
    "gn-banner-unfurl",
    "gn-trials-sunrise",
    "gn-gambit-coil",
    "gn-vanguard-command",
    "gn-exotic-decrypt",
    "gn-legendary-assemble",
    "gn-season-dial",
    "gn-eververse-crystal",
    "gn-news-transmission",
    "gn-completion-check",
    "gn-warning-sweep",
    "gn-signal-break",
    "gn-code-decrypt",
    "gn-system-orbit"
  ]) {
    assert.match(fanfareStyles, new RegExp(`@keyframes ${keyframe}\\b`));
  }
});

test("Theme Testing and Fireteam destination experiments are removed", () => {
  assert.doesNotMatch(`${appSource}\n${optionsSource}`, /ThemeTesting|theme-testing|Theme Testing/);
  assert.doesNotMatch(fireteamSource, /fireteamLocationTheme|gn-fireteam-location|data-location-theme|data-fireteam-location-theme/);
  assert.doesNotMatch(mainSource, /destination-atmospheres|destinationAtmospheres/);
  assert.doesNotMatch(packageSource, /theme-testing\.test|fireteam-atmosphere\.test/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataSource = await readFile(new URL("../apps/web/src/pages/themeTestingData.ts", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../apps/web/src/pages/ThemeTestingPage.tsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../apps/web/src/pages/ThemeTestingPage.module.css", import.meta.url), "utf8");
const appSource = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
const optionsSource = await readFile(new URL("../apps/web/src/components/layout/OptionsPanel.tsx", import.meta.url), "utf8");

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Theme Testing offers eight numbered choices for both independent systems", () => {
  const notificationOptions = section(dataSource, "export const notificationThemeOptions", "export const fireteamThemeOptions");
  const fireteamOptions = section(dataSource, "export const fireteamThemeOptions", "export const notificationThemeDefinitions");
  assert.equal((notificationOptions.match(/number:\s*[1-8]/g) || []).length, 8);
  assert.equal((fireteamOptions.match(/number:\s*[1-8]/g) || []).length, 8);
  for (let option = 1; option <= 8; option += 1) {
    assert.match(notificationOptions, new RegExp(`number:\\s*${option}\\b`));
    assert.match(fireteamOptions, new RegExp(`number:\\s*${option}\\b`));
  }
});

test("Theme Testing covers every current notification and Fireteam family", () => {
  const notificationDefinitions = section(dataSource, "export const notificationThemeDefinitions", "export const fireteamThemeDefinitions");
  const fireteamDefinitions = dataSource.slice(dataSource.indexOf("export const fireteamThemeDefinitions"));
  assert.equal((notificationDefinitions.match(/\{ id:/g) || []).length, 16);
  assert.equal((fireteamDefinitions.match(/\{ id:/g) || []).length, 16);
});

test("Theme Testing stays isolated from production notification and Fireteam selectors", () => {
  assert.match(pageSource, /data-notification-motif/);
  assert.match(pageSource, /data-fireteam-motif/);
  assert.doesNotMatch(styleSource, /data-notification-atmosphere/);
  assert.doesNotMatch(styleSource, /gn-fireteam-location/);
  assert.doesNotMatch(styleSource, /data-location-theme/);
});

test("Theme Testing is lazy-routed and developer-admin gated", () => {
  assert.match(appSource, /lazy\(\(\) => import\("\.\/pages\/ThemeTestingPage"\)/);
  assert.match(appSource, /path="admin\/theme-testing"/);
  assert.match(optionsSource, /session\?\.roles\.dev.*Theme Testing/s);
  assert.match(pageSource, /session\?\.authenticated && !session\.roles\.dev/);
});

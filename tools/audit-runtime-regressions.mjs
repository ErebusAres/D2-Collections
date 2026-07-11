import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const app = read("assets/app.js");
const armor = read("assets/armor-columns.js");
const auth = read("assets/bungie-collection-dump.js");
const fireteam = read("assets/fireteam.js");
const styles = read("assets/styles.css");
const worker = read("worker/src/index.js");

assert.match(styles, /--status-glyph:\s*url\("dim-icons\/dim_check\.svg"\)/, "Owned status must retain the check glyph.");
assert.match(styles, /--status-glyph:\s*url\("dim-icons\/dim_times\.svg"\)/, "Missing status must retain the X glyph.");
assert.doesNotMatch(app, /status-mark[^`]*dimIcon\("dim_(?:check|times|times_circle)\.svg"/, "Collection status cells must not recreate repeated icon images.");
assert.doesNotMatch(armor, /status-mark[^`]*dimIcon\("dim_(?:check|times)\.svg"/, "Armor status cells must not recreate repeated icon images.");
assert.match(auth, /navigator\.locks\?\.request/, "OAuth refresh must prefer an atomic browser lock.");
assert.match(auth, /waitForTokenRotation\(usedRefreshToken, timeoutMs = 10000\)/, "Refresh-token rotation must allow time for another tab to finish.");
assert.match(fireteam, /function reusableDefinition\(entry\)/, "Unresolved manifest definitions must use the retry policy.");
assert.match(fireteam, /function mapWithConcurrency\(values, limit, mapper\)/, "Fireteam manifest loading must use bounded concurrency.");
assert.match(fireteam, /mapWithConcurrency\(items, 6, async item/, "Quest items must resolve with the bounded loader.");
assert.match(fireteam, /quest\.unresolved \|\| \/\^Item/, "Hash-only unresolved quest cards must stay hidden.");
assert.match(auth, /\/api\/auth\/exchange/, "Browser OAuth must prefer the persistent Worker exchange.");
assert.match(auth, /server_session_token/, "Browser session storage must support opaque Worker sessions.");
assert.match(worker, /AES-GCM/, "Stored Bungie refresh tokens must be encrypted.");
assert.match(worker, /sha256Hex\(sessionToken\)/, "Worker browser sessions must be stored by hash.");
assert.match(worker, /BUNGIE_CLIENT_SECRET/, "Worker OAuth must require the confidential Bungie client secret.");

console.log("runtime regression audit passed");

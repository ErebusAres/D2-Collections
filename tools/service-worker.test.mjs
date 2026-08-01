import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const workerPath = new URL("../apps/web/service-worker.ts", import.meta.url);
const manifestPath = new URL("../apps/web/public/manifest.webmanifest", import.meta.url);
const indexPath = new URL("../apps/web/index.html", import.meta.url);

test("the install surface exposes mobile priorities and safe-area metadata", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const shortcutUrls = manifest.shortcuts.map((shortcut) => shortcut.url);
  const html = await readFile(indexPath, "utf8");
  const worker = await readFile(workerPath, "utf8");

  assert.deepEqual(shortcutUrls, ["/director", "/watchlists", "/xur", "/next", "/mailbox", "/fireteam"]);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(worker, /guardian-nexus-core-v3/);
});

test("navigation responses are cloned before the browser can consume them", async () => {
  const sourceText = await readFile(workerPath, "utf8");
  const source = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
    fileName: "service-worker.ts"
  }).outputText;
  const listeners = new Map();
  const cachedBodies = [];
  let releaseCache;

  const cacheReady = new Promise((resolve) => {
    releaseCache = () => resolve({
      put: async (_key, response) => {
        cachedBodies.push(await response.text());
      },
    });
  });

  const worker = {
    location: { origin: "https://guardian-nexus.pages.dev" },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  const caches = {
    open: () => cacheReady,
    match: async () => undefined,
  };
  const fetch = async () => new Response("<main>Build Advisor</main>", {
    headers: { "Content-Type": "text/html" },
    status: 200,
  });

  Function("self", "caches", "fetch", "Response", "URL", source)(
    worker,
    caches,
    fetch,
    Response,
    URL,
  );

  let responsePromise;
  let cachePromise;
  listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://guardian-nexus.pages.dev/build-advisor",
    },
    respondWith(promise) {
      responsePromise = promise;
    },
    waitUntil(promise) {
      cachePromise = promise;
    },
  });

  const response = await responsePromise;
  assert.equal(await response.text(), "<main>Build Advisor</main>");
  assert.ok(cachePromise, "the cache write should extend the fetch event lifetime");

  releaseCache();
  await cachePromise;

  assert.deepEqual(cachedBodies, ["<main>Build Advisor</main>"]);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerPath = new URL("../apps/web/public/sw.js", import.meta.url);

test("navigation responses are cloned before the browser can consume them", async () => {
  const source = await readFile(workerPath, "utf8");
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

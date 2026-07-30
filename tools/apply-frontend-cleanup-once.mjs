import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), content);
}

function replaceOnce(content, search, replacement, label) {
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Expected source not found: ${label}`);
  if (content.indexOf(search, index + search.length) >= 0) throw new Error(`Expected one source occurrence: ${label}`);
  return `${content.slice(0, index)}${replacement}${content.slice(index + search.length)}`;
}

function removeFireteamInlineTheme() {
  const file = "apps/web/src/pages/FireteamPage.tsx";
  let source = read(file);
  const start = source.indexOf("const FIRETEAM_LOCATION_CSS = String.raw`");
  if (start < 0) throw new Error("Fireteam inline destination CSS start not found");
  const end = source.indexOf("`;\n\nexport function FireteamPage", start);
  if (end < 0) throw new Error("Fireteam inline destination CSS end not found");
  source = `${source.slice(0, start)}export function FireteamPage${source.slice(end + "`;\n\nexport function FireteamPage".length)}`;
  source = replaceOnce(source, "    <style>{FIRETEAM_LOCATION_CSS}</style>\n", "", "Fireteam inline style element");
  write(file, source);
}

function moveFanfareStylesheet() {
  const from = absolute("apps/web/public/guardian-fanfare.css");
  const to = absolute("apps/web/src/styles/guardian-fanfare.css");
  if (!fs.existsSync(from)) throw new Error("Public guardian fanfare stylesheet not found");
  if (fs.existsSync(to)) throw new Error("Vite guardian fanfare stylesheet already exists");
  fs.renameSync(from, to);
}

function addStylesheetLoader() {
  write("apps/web/src/styles/loadStylesheet.ts", `const stylesheetLinks = new Map<string, HTMLLinkElement>();

export function ensureStylesheet(name: string, href: string): HTMLLinkElement | undefined {
  if (typeof document === "undefined") return undefined;

  const cached = stylesheetLinks.get(name);
  if (cached?.isConnected) {
    if (cached.href !== new URL(href, document.baseURI).href) cached.href = href;
    return cached;
  }

  const existing = [...document.head.querySelectorAll<HTMLLinkElement>("link[data-guardian-stylesheet]")]
    .find((link) => link.dataset.guardianStylesheet === name);
  if (existing) {
    if (existing.href !== new URL(href, document.baseURI).href) existing.href = href;
    stylesheetLinks.set(name, existing);
    return existing;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.guardianStylesheet = name;
  document.head.appendChild(link);
  stylesheetLinks.set(name, link);
  return link;
}
`);
}

function updateMainEntry() {
  const file = "apps/web/src/main.tsx";
  let source = read(file);
  source = replaceOnce(
    source,
    'import destinationAtmospheresUrl from "./styles/destination-atmospheres.css?url";\nimport "./styles/theme.css";',
    'import destinationAtmospheresUrl from "./styles/destination-atmospheres.css?url";\nimport { ensureStylesheet } from "./styles/loadStylesheet";\nimport "./styles/theme.css";',
    "main stylesheet imports",
  );
  source = replaceOnce(
    source,
    'const destinationAtmospheres = document.createElement("link");\ndestinationAtmospheres.rel = "stylesheet";\ndestinationAtmospheres.href = destinationAtmospheresUrl;\ndestinationAtmospheres.dataset.guardianDestinationAtmospheres = "true";\ndocument.head.appendChild(destinationAtmospheres);',
    'ensureStylesheet("destination-atmospheres", destinationAtmospheresUrl);',
    "main manual stylesheet injection",
  );
  source = replaceOnce(
    source,
    'queries: { staleTime: 45_000, retry: (attempt, error: any) => error?.status !== 401 && attempt < 2, refetchOnWindowFocus: true },',
    'queries: { staleTime: 45_000, retry: shouldRetryQuery, refetchOnWindowFocus: true },',
    "query retry callback",
  );
  source = source.replace(
    "createRoot(document.getElementById(\"root\")!).render(",
    `function shouldRetryQuery(attempt: number, error: unknown): boolean {
  const status = typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: unknown }).status
    : undefined;
  return status !== 401 && attempt < 2;
}

createRoot(document.getElementById("root")!).render(`,
  );
  write(file, source);
}

function updateGuardianFeed() {
  const file = "apps/web/src/components/notifications/GuardianFeed.tsx";
  let source = read(file);
  source = replaceOnce(
    source,
    'import styles from "./GuardianFeed.module.css";',
    'import guardianFanfareUrl from "../../styles/guardian-fanfare.css?url";\nimport { ensureStylesheet } from "../../styles/loadStylesheet";\nimport styles from "./GuardianFeed.module.css";',
    "GuardianFeed stylesheet imports",
  );
  source = replaceOnce(
    source,
    'export function GuardianFeed({ controller }: { controller: GuardianNotificationsController }) {\n  const { feed, preferences } = controller;',
    'export function GuardianFeed({ controller }: { controller: GuardianNotificationsController }) {\n  useEffect(() => {\n    ensureStylesheet("notification-fanfare", guardianFanfareUrl);\n  }, []);\n  const { feed, preferences } = controller;',
    "GuardianFeed stylesheet hook",
  );
  source = replaceOnce(source, '        <link rel="stylesheet" href="/guardian-fanfare.css" />\n', "", "GuardianFeed body stylesheet link");
  write(file, source);
}

function addDestinationStructuralStyles() {
  const file = "apps/web/src/styles/destination-atmospheres.css";
  let source = read(file);
  const marker = "html body .gn-fireteam-location[data-fireteam-location-theme]::before,";
  if (!source.includes(marker)) throw new Error("Destination stylesheet base marker not found");
  if (source.includes("html body .gn-fireteam-location {")) throw new Error("Destination structural styles already present");
  const structural = `html body .gn-fireteam-location {
  position: relative;
  isolation: isolate;
}

html body .gn-fireteam-location > * {
  position: relative;
  z-index: 1;
}

html body .gn-fireteam-location::before,
html body .gn-fireteam-location::after {
  content: "";
  position: fixed;
  z-index: 0;
}

`;
  source = source.replace(marker, `${structural}${marker}`);
  write(file, source);
}

function convertServiceWorker() {
  const oldFile = "apps/web/public/sw.js";
  if (!fs.existsSync(absolute(oldFile))) throw new Error("Legacy service worker not found");
  fs.unlinkSync(absolute(oldFile));
  write("apps/web/service-worker.ts", `const CORE_CACHE = "guardian-nexus-core-v1";
const RUNTIME_CACHE = "guardian-nexus-runtime-v1";
const CACHE_PREFIX = "guardian-nexus-";
const RUNTIME_LIMIT = 300;
const worker = self as unknown as ServiceWorkerGlobalScope;

worker.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(["/", "/index.html"]))
      .then(() => worker.skipWaiting()),
  );
});

worker.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CORE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener("fetch", (event: FetchEvent) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === worker.location.origin && url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseForCache = response.clone();
            event.waitUntil(
              caches.open(CORE_CACHE)
                .then((cache) => cache.put("/index.html", responseForCache))
                .catch(() => undefined),
            );
          }
          return response;
        })
        .catch(async () => (await caches.match("/index.html")) || Response.error()),
    );
    return;
  }

  const isLocalAsset = url.origin === worker.location.origin
    && (/^\\/assets\\//.test(url.pathname)
      || /^\\/data\\//.test(url.pathname)
      || /\\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname));
  const isBungieImage = url.hostname.endsWith("bungie.net")
    && /\\/common\\/destiny2_content\\//.test(url.pathname);
  if (isLocalAsset || isBungieImage) event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        await trimCache(cache, RUNTIME_LIMIT);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || refresh;
}

async function trimCache(cache: Cache, limit: number): Promise<void> {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}
`);
  write("apps/web/tsconfig.service-worker.json", `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "lib": ["ES2022", "WebWorker"],
    "types": []
  },
  "include": ["service-worker.ts"]
}
`);
}

function updateViteConfig() {
  write("apps/web/vite.config.ts", `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } }
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      input: {
        index: "index.html",
        sw: "service-worker.ts"
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js"
      }
    }
  }
});
`);
}

function updateWebPackage() {
  const file = "apps/web/package.json";
  const pkg = JSON.parse(read(file));
  pkg.scripts.build = "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.service-worker.json --noEmit && tsc -p functions/tsconfig.json --noEmit && vite build";
  pkg.scripts.typecheck = "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.service-worker.json --noEmit && tsc -p functions/tsconfig.json --noEmit";
  write(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

function updateServiceWorkerTest() {
  const file = "tools/service-worker.test.mjs";
  let source = read(file);
  source = replaceOnce(source, 'import test from "node:test";', 'import test from "node:test";\nimport ts from "typescript";', "service worker test TypeScript import");
  source = replaceOnce(source, 'const workerPath = new URL("../apps/web/public/sw.js", import.meta.url);', 'const workerPath = new URL("../apps/web/service-worker.ts", import.meta.url);', "service worker test source path");
  source = replaceOnce(
    source,
    '  const source = await readFile(workerPath, "utf8");',
    '  const sourceText = await readFile(workerPath, "utf8");\n  const source = ts.transpileModule(sourceText, {\n    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },\n    fileName: "service-worker.ts"\n  }).outputText;',
    "service worker test transpilation",
  );
  write(file, source);
}

function mergeAdjacentIdenticalRules(css) {
  const pattern = /([^{}]+)\{([^{}]*)\}(\s*)([^{}]+)\{([^{}]*)\}/g;
  const normalize = (value) => value.trim().replace(/\s+/g, " ").replace(/\s*([:;,])\s*/g, "$1");
  const isSelector = (value) => {
    const selector = value.trim();
    return selector.length > 0
      && !selector.startsWith("@")
      && !/^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,|$)/.test(selector);
  };
  let output = css;
  let changed = true;
  while (changed) {
    changed = false;
    output = output.replace(pattern, (whole, firstSelector, firstBody, spacing, secondSelector, secondBody) => {
      if (!isSelector(firstSelector) || !isSelector(secondSelector)) return whole;
      if (normalize(firstBody) !== normalize(secondBody)) return whole;
      changed = true;
      return `${firstSelector.trim()},${secondSelector.trim()}{${firstBody}}${spacing}`;
    });
  }
  return output;
}

function consolidateAdjacentCssRules() {
  const roots = [absolute("apps/web/src"), absolute("apps/web/public")];
  const stack = [...roots.filter((directory) => fs.existsSync(directory))];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile() && entry.name.endsWith(".css")) {
        const before = fs.readFileSync(target, "utf8");
        const after = mergeAdjacentIdenticalRules(before);
        if (after !== before) fs.writeFileSync(target, after);
      }
    }
  }
}

removeFireteamInlineTheme();
moveFanfareStylesheet();
addStylesheetLoader();
updateMainEntry();
updateGuardianFeed();
addDestinationStructuralStyles();
convertServiceWorker();
updateViteConfig();
updateWebPackage();
updateServiceWorkerTest();
consolidateAdjacentCssRules();

console.log("Applied controlled frontend cleanup transformation.");

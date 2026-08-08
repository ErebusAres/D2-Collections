import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { env: Record<string, string | undefined> };

const buildCommit = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "unknown";
const buildTimestamp = process.env.CF_PAGES_BUILD_ID ? new Date().toISOString() : process.env.VITE_BUILD_TIMESTAMP || "unknown";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version || "0.1.0"),
    "import.meta.env.VITE_GIT_COMMIT": JSON.stringify(buildCommit),
    "import.meta.env.VITE_BUILD_TIMESTAMP": JSON.stringify(buildTimestamp)
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } }
  },
  build: { target: "es2022", sourcemap: true }
});

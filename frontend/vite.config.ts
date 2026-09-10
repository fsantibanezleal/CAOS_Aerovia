import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from 'node:fs';
import { defaultClientConditions } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: "/",
  // ORT publishes an external-WASM export for applications that host the runtime.
  // Keep one first-party binary under public/data/ort instead of emitting a second bundle copy.
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions] },
  define:{__APP_VERSION__:JSON.stringify(readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim())},
  test: { include: ["src/**/*.test.ts"] },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/three/")) return "three";
        },
      },
    },
  },
});

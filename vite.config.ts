import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Big libraries in their own files: they download in parallel and stay cached between deploys. */
const VENDOR_CHUNKS: Record<string, RegExp> = {
  maplibre: /node_modules[\/]maplibre-gl/,
  three: /node_modules[\/]three/,
  turf: /node_modules[\/](@turf|polygon-clipping|robust-predicates|splaytree|rbush|earcut)/,
  draw: /node_modules[\/]terra-draw/,
  react: /node_modules[\/](react|react-dom|scheduler|@base-ui)/,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // CSS stays with whoever imports it (else a CSS import drags in the whole library).
          if (id.endsWith(".css")) return undefined;
          for (const [name, re] of Object.entries(VENDOR_CHUNKS)) if (re.test(id)) return name;
          return undefined;
        },
      },
    },
  },
});

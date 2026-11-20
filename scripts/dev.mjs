// Local dev server. The project folder name contains "#", which breaks
// Vite's dev server, so instead we rebuild on every save and serve dist/.
//
// The build is unminified, so the code in the browser is readable as it is.
// No source maps: Vite's build pipeline cannot produce them for CSS (only for
// JS), so asking for them makes every rebuild warn "SOURCEMAP_BROKEN".
// Unminified files are about twice their production size, so the size warning
// limit is raised to match here; `npm run build` keeps the real limit.
// `npm run build` makes the small production files that Vercel serves.
import { build, preview } from "vite";

/** About twice the production limit in vite.config.ts, for unminified files. */
const DEV_CHUNK_WARNING_KB = 2500;

await build({ build: { watch: {}, minify: false, chunkSizeWarningLimit: DEV_CHUNK_WARNING_KB } });
const server = await preview({ preview: { port: 5173, strictPort: true } });
server.printUrls();

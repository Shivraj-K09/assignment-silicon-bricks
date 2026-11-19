// Local dev server. The project folder name contains "#", which breaks
// Vite's dev server, so instead we rebuild on every save and serve dist/.
import { build, preview } from "vite";

await build({ build: { watch: {}, sourcemap: true, minify: false } });
const server = await preview({ preview: { port: 5173, strictPort: true } });
server.printUrls();

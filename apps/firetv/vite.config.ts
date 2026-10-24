import { defineConfig, type Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
const videoPath = new URL(
  "../../docs/media/curiolab-demo.webm",
  import.meta.url,
);
const mp4Path = new URL(
  "../../docs/media/curiolab-demo.mp4",
  import.meta.url,
);
const narrationPath = new URL(
  "../../docs/media/curiolab-narration.mp3",
  import.meta.url,
);
function walkthroughMedia(): Plugin {
  return {
    name: "curiolab-walkthrough-media",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "media/curiolab-demo.webm",
        source: readFileSync(videoPath),
      });
      if (existsSync(mp4Path)) {
        this.emitFile({
          type: "asset",
          fileName: "media/curiolab-demo.mp4",
          source: readFileSync(mp4Path),
        });
      }
      if (existsSync(narrationPath)) {
        this.emitFile({
          type: "asset",
          fileName: "media/curiolab-narration.mp3",
          source: readFileSync(narrationPath),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (
          ![
            "/curiolab/media/curiolab-demo.webm",
            "/media/curiolab-demo.webm",
          ].includes(req.url?.split("?")[0] ?? "")
        )
          return next();
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const bytes = readFileSync(videoPath);
        res.setHeader("Content-Type", "video/webm");
        res.setHeader("Content-Length", bytes.length);
        res.end(req.method === "HEAD" ? undefined : bytes);
      });
    },
  };
}
export default defineConfig({
  base: "/curiolab/",
  plugins: [walkthroughMedia()],
  build: { outDir: "../../build/pages", emptyOutDir: true },
  server: { host: "0.0.0.0", allowedHosts: true },
  preview: { host: "0.0.0.0", allowedHosts: true },
});

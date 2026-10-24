import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
const videoPath = new URL(
  "../../docs/media/curiolab-demo.webm",
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

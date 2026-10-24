import { expect, it } from "vitest";
import { build } from "vite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
it("builds both the base-aware simulator and the exact original recording into the Pages artifact", async () => {
  const result = await build({
    root: "apps/firetv",
    configFile: "apps/firetv/vite.config.ts",
    mode: "pages",
    logLevel: "silent",
    build: { write: false },
  });
  if (Array.isArray(result) || !("output" in result))
    throw new Error("expected_single_build");
  const video = result.output.find(
    (file) => file.fileName === "media/curiolab-demo.webm",
  );
  if (!video || video.type !== "asset")
    throw new Error("missing_recording_asset");
  const hash = (bytes: string | Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  expect(hash(video.source)).toBe(
    hash(readFileSync("docs/media/curiolab-demo.webm")),
  );
  const html = result.output.find((file) => file.fileName === "index.html");
  if (!html || html.type !== "asset") throw new Error("missing_simulator");
  expect(String(html.source)).toContain("/curiolab/assets/");
  expect(String(html.source)).toContain("/curiolab/media/curiolab-demo.webm");
  const workflow = readFileSync(".github/workflows/pages.yml", "utf8");
  expect(workflow).toContain("test -s build/pages/media/curiolab-demo.webm");
  expect(workflow).toContain("path: build/pages");
  const ignore = readFileSync(".dockerignore", "utf8");
  expect(ignore).toContain("!docs/media/curiolab-demo.webm");
  expect(ignore).toContain("!docs/media/curiolab-demo.json");
}, 30000);

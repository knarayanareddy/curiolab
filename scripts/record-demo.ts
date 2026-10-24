import { chromium } from "playwright";
import { mkdir, stat, writeFile, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { demoWalkthrough } from "./demo-walkthrough.js";
const url = new URL(process.env.DEMO_URL ?? "http://127.0.0.1:5173/curiolab/");
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
  throw new Error("invalid_demo_url");
const output = resolve("docs/media/curiolab-demo.webm");
await mkdir(dirname(output), { recursive: true });
const temporary = resolve("build/demo-recordings");
await mkdir(temporary, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: temporary, size: { width: 1280, height: 720 } },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const video = page.video()!;
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(url.href, { waitUntil: "networkidle", timeout: 30000 });
  const engine = await page.locator(".pill").textContent();
  const result = await demoWalkthrough(page, 1800);
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  await context.close(); // Flush the actual browser capture before publishing.
  await video.saveAs(`${output}.pending.webm`);
  if ((await stat(`${output}.pending.webm`)).size < 1000)
    throw new Error("empty_demo_video");
  const { rename } = await import("node:fs/promises");
  await rename(`${output}.pending.webm`, output);
  await writeFile(
    resolve("docs/media/curiolab-demo.json"),
    JSON.stringify(
      {
        provenance: "synthetic-browser-demo-not-Fire-OS-or-physical-evidence",
        recorded_at: new Date().toISOString(),
        browser: browser.version(),
        engine,
        viewport: "1920x1080",
        video: "1280x720",
        ...result,
        sha256: createHash("sha256")
          .update(await readFile(output))
          .digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Recorded ${output} — synthetic input, actual browser rendering, no physical/device claims.`,
  );
} finally {
  await context.close();
  await browser.close();
  await rm(`${output}.pending.webm`, { force: true });
  await rm(temporary, { recursive: true, force: true });
}

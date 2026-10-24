import assert from "node:assert/strict";
import { chromium } from "playwright";
import { demoWalkthrough } from "./demo-walkthrough.js";
const url = new URL(process.env.PAGES_URL ?? "http://127.0.0.1:4173/curiolab/");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  for (const [flat, folded, mode] of [
    [3, 7, "standard"],
    [4, 4, "reduced_motion"],
    [6, 2, "no_timing"],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      reducedMotion: mode === "reduced_motion" ? "reduce" : "no-preference",
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      const forbidden: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const request = new URL(route.request().url());
        if (
          request.origin !== url.origin ||
          request.pathname.startsWith("/api/") ||
          route.request().resourceType() === "websocket"
        ) {
          forbidden.push(request.pathname);
          return route.abort();
        }
        return route.continue();
      });
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page
        .locator('#episode-canvas[data-stage="SAFETY_AND_CONSENT"]')
        .waitFor();
      assert.match(await page.locator(".pill").innerText(), /KOTLIN\/JS/);
      // Cache-free proof for already loaded modules, not a signed/offline content release gate.
      await context.setOffline(true);
      const result = await demoWalkthrough(page, 30, flat, folded, mode);
      assert.equal(
        result.branch,
        folded > flat ? "GREATER" : folded < flat ? "LOWER" : "EQUAL",
      );
      if (mode !== "standard")
        assert.equal(
          await page
            .locator(".branch-symbol")
            .evaluate((element) => getComputedStyle(element).animationName),
          "none",
        );
      assert.deepEqual(errors, []);
      assert.deepEqual(forbidden, []);
      console.log(
        `PASS: built Pages assets, offline synthetic ${flat}/${folded} ${result.branch}, ${mode}, no API/cloud calls.`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

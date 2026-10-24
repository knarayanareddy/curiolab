import type { Page } from "playwright";
/** Synthetic demo: each load is stopped and family-confirmed BEFORE story choreography. */
export async function demoWalkthrough(
  page: Page,
  holdMs = 1200,
  flat = 3,
  folded = 7,
  mode: "standard" | "reduced_motion" | "no_timing" = "standard",
  voiceoverSynced = false,
) {
  const stages: { stage: string; at_ms: number }[] = [];
  const start = Date.now();
  const wait = async (stage: string, scene = false) => {
    await page.locator(`#episode-canvas[data-stage="${stage}"]`).waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector("#app")?.getAttribute("aria-busy") === "false",
    );
    if (scene) await page.locator("#episode-canvas").scrollIntoViewIfNeeded();
    stages.push({ stage, at_ms: Date.now() - start });
    if (!voiceoverSynced) {
      await page.waitForTimeout(holdMs); // Presentation pacing only; never drives application state.
    }
  };
  const click = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();

  await wait("SAFETY_AND_CONSENT");
  if (voiceoverSynced) {
    // 0s to 59s: Introduction & architectural context on initial canvas
    await page.waitForTimeout(59_000);
  }
  for (const id of ["adult", "privacy", "safety", "objects"])
    await page.locator(`#${id}`).check();
  await page.locator("#camera").selectOption("COMPANION");
  await page.locator("#permission").selectOption("GRANTED");
  await page.locator("#accessibility").selectOption(mode);
  if (voiceoverSynced) {
    await page.waitForTimeout(14_000);
  }
  await click("All set — begin our mission →");

  await wait("FLAT_PREDICTION");
  if (voiceoverSynced) {
    await page.waitForTimeout(11_000);
  }
  await click("Folded paper");

  await wait("FLAT_LAB");
  const observe = async (coins: number, isFolded = false) => {
    for (let i = 0; i < coins; i++) {
      await click("+");
      await page.waitForTimeout(voiceoverSynced ? 1200 : Math.min(holdMs, 100));
    }
    await click("Fixture: aligned + stable");
    await page.waitForFunction(
      (expected) =>
        document
          .querySelector("#content .note")
          ?.textContent?.includes(`observed ${expected}`),
      coins,
    );
    await page.waitForTimeout(
      voiceoverSynced ? (isFolded ? 4000 : 5000) : holdMs,
    );
    await click("Adult: mark stop →");
  };
  await observe(flat, false);
  await wait("FLAT_CONFIRMATION");
  if (voiceoverSynced) {
    await page.waitForTimeout(3000);
  }
  await click("Confirm our measurement →");

  await wait("FOLDED_PREDICTION", true); // Film flat deflection/collapse.
  if (voiceoverSynced) {
    await page.waitForTimeout(5000);
  }
  await click("More coins");

  await wait("FOLDED_LAB");
  await observe(folded, true);
  await wait("FOLDED_CONFIRMATION");
  if (voiceoverSynced) {
    await page.waitForTimeout(3000);
  }
  await click("Confirm our measurement →");

  await wait("COMPARISON", true); // Folded load and resolution.
  const expected =
    folded > flat ? "GREATER" : folded < flat ? "LOWER" : "EQUAL";
  if (
    (await page.locator("#episode-canvas").getAttribute("data-branch")) !==
    expected
  )
    throw new Error("incorrect_demo_branch");
  if (voiceoverSynced) {
    await page.waitForTimeout(4000);
  }
  await click("Reflect on our experiment →");

  await wait("REFLECTION");
  if (voiceoverSynced) {
    await page.waitForTimeout(3000);
  }
  await click("Shape can make a difference");

  await wait("COMPLETE", true);
  if (voiceoverSynced) {
    await page.waitForTimeout(5000);
  }
  return { flat, folded, branch: expected, stages };
}

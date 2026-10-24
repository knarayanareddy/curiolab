import type { Page } from "playwright";
/** Synthetic demo: each load is stopped and family-confirmed BEFORE story choreography. */
export async function demoWalkthrough(
  page: Page,
  holdMs = 1200,
  flat = 3,
  folded = 7,
  mode: "standard" | "reduced_motion" | "no_timing" = "standard",
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
    await page.waitForTimeout(holdMs); // Presentation pacing only; never drives application state.
  };
  const click = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  await wait("SAFETY_AND_CONSENT");
  for (const id of ["adult", "privacy", "safety", "objects"])
    await page.locator(`#${id}`).check();
  await page.locator("#camera").selectOption("COMPANION");
  await page.locator("#permission").selectOption("GRANTED");
  await page.locator("#accessibility").selectOption(mode);
  await click("All set — begin our mission →");
  await wait("FLAT_PREDICTION");
  await click("Folded paper");
  await wait("FLAT_LAB");
  const observe = async (coins: number) => {
    for (let i = 0; i < coins; i++) {
      await click("+");
      await page.waitForTimeout(Math.min(holdMs, 100));
    }
    await click("Fixture: aligned + stable");
    await page.waitForFunction(
      (expected) =>
        document
          .querySelector("#content .note")
          ?.textContent?.includes(`observed ${expected}`),
      coins,
    );
    await page.waitForTimeout(holdMs);
    await click("Adult: mark stop →");
  };
  await observe(flat);
  await wait("FLAT_CONFIRMATION");
  await click("Confirm our measurement →");
  await wait("FOLDED_PREDICTION", true); // Film flat deflection/collapse.
  await click("More coins");
  await wait("FOLDED_LAB");
  await observe(folded);
  await wait("FOLDED_CONFIRMATION");
  await click("Confirm our measurement →");
  await wait("COMPARISON", true); // Folded load and resolution.
  const expected =
    folded > flat ? "GREATER" : folded < flat ? "LOWER" : "EQUAL";
  if (
    (await page.locator("#episode-canvas").getAttribute("data-branch")) !==
    expected
  )
    throw new Error("incorrect_demo_branch");
  await click("Reflect on our experiment →");
  await wait("REFLECTION");
  await click("Shape can make a difference");
  await wait("COMPLETE", true);
  return { flat, folded, branch: expected, stages };
}

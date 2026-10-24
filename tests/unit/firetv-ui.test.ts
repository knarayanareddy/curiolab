// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
const initial = {
  stage: "SAFETY_AND_CONSENT",
  sequence: 0,
  flat: null,
  folded: null,
  stopped: null,
  comparison: null,
  perception: "NONE",
  observed: 0,
};
let disposeUI: (() => void) | undefined;
async function mount(state: object = initial) {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(state));
  vi.stubGlobal("fetch", fetcher);
  disposeUI = (await import("../../apps/firetv/src/main.js")).disposeEpisodeUI;
  await vi.waitFor(() =>
    expect(document.querySelector("#screen-title")?.textContent).not.toBe(""),
  );
  // Allow the initial asynchronous state response to render.
  await vi.waitFor(() =>
    expect(document.querySelector("#app")?.getAttribute("aria-busy")).toBe(
      "false",
    ),
  );
  return fetcher;
}
afterEach(() => {
  disposeUI?.();
  disposeUI = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("shows separate privacy/safety consent and sends explicit adult choices, with analytics off", async () => {
  const fetcher = await mount();
  for (const id of ["adult", "privacy", "safety", "objects"])
    expect((document.getElementById(id) as HTMLInputElement).checked).toBe(
      false,
    );
  (document.getElementById("adult") as HTMLInputElement).checked = true;
  const begin = Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("begin our mission"),
  )!;
  begin.click();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const body = JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body));
  expect(body.command).toBe("begin");
  expect(body.args).toEqual([
    "true",
    "false",
    "false",
    "false",
    "false",
    "MANUAL",
    "NOT_REQUESTED",
    "standard",
  ]);
});
it.each([
  [3, 7, "GREATER", "more"],
  [4, 4, "EQUAL", "same number"],
  [6, 2, "LOWER", "fewer"],
])(
  "renders exact confirmed %s/%s measurements and %s branch",
  async (flat, folded, comparison, title) => {
    await mount({ ...initial, stage: "COMPARISON", flat, folded, comparison });
    expect(document.getElementById("screen-title")?.textContent).toContain(
      String(title),
    );
    expect(document.querySelector(".result")?.textContent).toContain(
      `${flat} coins`,
    );
    expect(document.querySelector(".result")?.textContent).toContain(
      `${folded} coins`,
    );
    expect(document.getElementById("content")?.textContent).toContain(
      "not a universal scientific law",
    );
  },
);
it("exposes recoverable API errors without inventing a measurement", async () => {
  const fetcher = await mount({
    ...initial,
    stage: "FLAT_CONFIRMATION",
    stopped: 5,
  });
  const plus = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "+",
  )!;
  plus.click();
  expect(document.querySelector("output")?.textContent).toBe("6 coins");
  fetcher.mockImplementationOnce(async () =>
    Response.json({ error: "Stale step. Reload." }),
  );
  Array.from(document.querySelectorAll("button"))
    .find((button) => button.textContent?.includes("Confirm our measurement"))!
    .click();
  await vi.waitFor(() =>
    expect(document.getElementById("error")?.textContent).toContain(
      "Stale step",
    ),
  );
  expect(document.querySelector(".result")).toBeNull();
  expect(document.getElementById("retry")).not.toBeNull();
});
it("Back opens a recoverable pause sheet without discarding committed measurements", async () => {
  await mount({
    ...initial,
    stage: "COMPARISON",
    flat: 3,
    folded: 7,
    comparison: "GREATER",
  });
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect((document.getElementById("back-sheet") as HTMLElement).hidden).toBe(
    false,
  );
  expect(document.querySelector("main")?.hasAttribute("inert")).toBe(true);
  (document.getElementById("back-continue") as HTMLButtonElement).click();
  expect((document.getElementById("back-sheet") as HTMLElement).hidden).toBe(
    true,
  );
  expect(document.querySelector(".result")?.textContent).toContain("7 coins");
});

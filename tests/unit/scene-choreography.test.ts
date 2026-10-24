// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  episodeScene,
  renderEpisodeScene,
} from "../../apps/firetv/src/scene.js";
import type { SimulatorState } from "../../packages/session-contracts/src/simulator-state.js";
const base: SimulatorState = {
  stage: "FLAT_LAB",
  sequence: 2,
  flat: null,
  folded: null,
  stopped: null,
  comparison: null,
  observed: 9,
  perception: "OBSERVING",
};
it("never drives scene load or resolution from observed, stopped or editable draft counts", () => {
  expect(
    episodeScene({ ...base, stage: "FLAT_CONFIRMATION", stopped: 9, flat: 9 })
      .bridges[0]?.count,
  ).toBeNull();
  const scene = episodeScene({
    ...base,
    stage: "FOLDED_CONFIRMATION",
    flat: 4,
    stopped: 9,
    folded: 9,
  });
  expect(scene.bridges.map((bridge) => bridge.count)).toEqual([4, null]);
  expect(scene.branch).toBeNull();
  expect(scene.quiet).toBe(true);
});
it.each([
  [3, 7, "GREATER"],
  [4, 4, "EQUAL"],
  [6, 2, "LOWER"],
] as const)(
  "renders coordinator branch %s/%s → %s with exact counts and appropriate graphical feedback",
  (flat, folded, comparison) => {
    const host = document.createElement("figure");
    renderEpisodeScene(host, {
      ...base,
      stage: "COMPARISON",
      flat,
      folded,
      comparison,
    });
    expect(host.dataset.branch).toBe(comparison);
    expect(host.querySelectorAll("svg")).toHaveLength(2);
    expect(host.querySelector(".branch-feedback")?.textContent).toContain(
      `${flat} coins · folded ${folded} coins`,
    );
    expect(
      host.querySelector(".accordion-paper")?.getAttribute("points"),
    ).toContain("120,198");
    expect(host.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 600 320",
    );
  },
);
it("caps graphic crates, not confirmed numbers; handles zero without inventing collapse", () => {
  const host = document.createElement("figure");
  renderEpisodeScene(host, {
    ...base,
    stage: "COMPARISON",
    flat: 0,
    folded: 30,
    comparison: "GREATER",
  });
  expect(
    host
      .querySelector('[data-trial="flat"]')
      ?.classList.contains("is-collapsed"),
  ).toBe(false);
  expect(
    host.querySelectorAll('[data-trial="folded"] [data-crate]'),
  ).toHaveLength(12);
  expect(host.textContent).toContain("30 confirmed coins");
  expect(host.textContent).toContain("not a physics simulation");
});
it("refreshes and later stages never replay unchanged load choreography or mutate confirmed values", () => {
  const host = document.createElement("figure");
  const state: SimulatorState = {
    ...base,
    stage: "FOLDED_PREDICTION",
    flat: 4,
  };
  renderEpisodeScene(host, state);
  const svg = host.querySelector("svg");
  expect(
    host.querySelector('[data-trial="flat"]')?.getAttribute("data-animate"),
  ).toBe("true");
  renderEpisodeScene(host, state);
  expect(host.querySelector("svg")).toBe(svg);
  renderEpisodeScene(host, { ...state, stage: "FOLDED_LAB" });
  expect(
    host.querySelector('[data-trial="flat"]')?.getAttribute("data-animate"),
  ).toBe("false");
  expect(state.flat).toBe(4);
});
it("rejects inconsistent branches and invalid confirmed values rather than showing canned success", () => {
  expect(() =>
    episodeScene({
      ...base,
      stage: "COMPARISON",
      flat: 6,
      folded: 2,
      comparison: "GREATER",
    }),
  ).toThrow("inconsistent");
  expect(() =>
    episodeScene({ ...base, stage: "FOLDED_PREDICTION", flat: 31 }),
  ).toThrow("invalid_confirmed");
});
it("provides static end states for reduced-motion/no-timing and visible programmatic D-pad focus", () => {
  const css = readFileSync("apps/firetv/src/style.css", "utf8");
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).toContain('[data-motion="reduced_motion"]');
  expect(css).toContain('[data-motion="no_timing"]');
  expect(css).toContain("button:focus");
  expect(css).toContain("outline: 4px solid var(--focus)");
  expect(css).not.toContain("infinite");
  const host = document.createElement("figure");
  renderEpisodeScene(host, {
    ...base,
    stage: "COMPARISON",
    flat: 4,
    folded: 4,
    comparison: "EQUAL",
    accessibility_mode: "reduced_motion",
  });
  expect(host.querySelector(".branch-symbol")?.textContent).toBe("="); // No animation event/timer required.
});

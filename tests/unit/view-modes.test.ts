// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { mountViewModes } from "../../apps/firetv/src/view-modes.js";
import recording from "../../docs/media/curiolab-demo.json";
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function mount() {
  document.body.innerHTML =
    '<div id="app"><button id="unchanged">Existing confirmed episode</button></div>';
  const app = document.getElementById("app")!;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  dispose = mountViewModes(app, "/curiolab/");
  return {
    app,
    video: document.querySelector<HTMLVideoElement>("video")!,
    record: document.getElementById("view-recording")!,
    simulator: document.getElementById("view-simulator")!,
  };
}
it("defaults to the interactive session without downloading or playing video", () => {
  const { app, video, simulator } = mount();
  expect(app.hidden).toBe(false);
  expect(video.hasAttribute("src")).toBe(false);
  expect(video.preload).toBe("none");
  expect(simulator.getAttribute("aria-pressed")).toBe("true");
  expect(video.play).not.toHaveBeenCalled();
});
it("switches presentation without replacing the episode DOM, pauses on return, and describes encoding honestly", () => {
  const { app, video, record, simulator } = mount();
  const original = document.getElementById("unchanged");
  record.click();
  expect(app.hidden).toBe(true);
  expect(video.getAttribute("src")).toBe("/curiolab/media/curiolab-demo.webm");
  expect(record.getAttribute("aria-pressed")).toBe("true");
  expect(video.play).toHaveBeenCalledOnce();
  expect(document.getElementById("recorded-view")?.textContent).toContain(
    "1280×720 (720p)",
  );
  simulator.click();
  expect(app.hidden).toBe(false);
  expect(document.getElementById("unchanged")).toBe(original);
  expect(video.pause).toHaveBeenCalledOnce();
});
it.each(["1", "1.25", "1.5"])("sets playback rate %s", (rate) => {
  const { video } = mount();
  const speed = document.getElementById("video-speed") as HTMLSelectElement;
  speed.value = rate;
  speed.dispatchEvent(new Event("change"));
  expect(video.playbackRate).toBe(Number(rate));
});
it("seeks to each recorded scene, including a link clicked before metadata loads", () => {
  const { video, record } = mount();
  record.click();
  document.getElementById("scene-flat")!.click();
  expect(video.currentTime).toBe(0);
  Object.defineProperty(video, "readyState", { configurable: true, value: 1 });
  Object.defineProperty(video, "duration", { configurable: true, value: 50 });
  video.dispatchEvent(new Event("loadedmetadata"));
  const expectedFlat =
    recording.stages.find((item) => item.stage === "FLAT_LAB")!.at_ms / 1000;
  const expectedFolded =
    recording.stages.find((item) => item.stage === "FOLDED_LAB")!.at_ms / 1000;
  expect(video.currentTime).toBeCloseTo(expectedFlat);
  document.getElementById("scene-folded")!.click();
  expect(video.currentTime).toBeCloseTo(expectedFolded);
});
it("offers a recovery when playback is blocked or the file is unsupported", async () => {
  const { video, record } = mount();
  vi.mocked(video.play).mockRejectedValue(new Error("blocked"));
  record.click();
  await Promise.resolve();
  expect(document.getElementById("video-status")?.textContent).toContain(
    "Press Play",
  );
  video.dispatchEvent(new Event("error"));
  expect(document.getElementById("video-status")?.textContent).toContain(
    "switch to the interactive simulator",
  );
  expect(document.getElementById("video-download")?.getAttribute("href")).toBe(
    "/curiolab/media/curiolab-demo.webm",
  );
});
it("supports directional navigation of the banner without implicitly changing modes", () => {
  const { app, record, simulator } = mount();
  record.focus();
  record.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(document.activeElement).toBe(simulator);
  expect(app.hidden).toBe(false);
});

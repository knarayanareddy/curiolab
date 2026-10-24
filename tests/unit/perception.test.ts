import { describe, expect, it } from "vitest";
import {
  evaluateCalibration,
  StableCoinCounter,
  type CoinDetection,
  type ObservationFrame,
} from "../../packages/perception/src/index.js";

function calibration(
  overrides: Partial<Parameters<typeof evaluateCalibration>[0]> = {},
) {
  return evaluateCalibration({
    markerIds: ["0", "1", "2", "3"],
    reprojectionErrorPx: 8,
    loadZoneOccludedMs: 1000,
    ...overrides,
  });
}

function detection(
  detectionId = "coin-1",
  x = 100,
  confidence = 0.65,
): CoinDetection {
  return { detectionId, center: { x, y: 100 }, confidence };
}

function frame(
  frameSequence: number,
  timestampMs: number,
  detections = [detection()],
  flags: Partial<
    Pick<ObservationFrame, "overlap" | "motionBlur" | "trackerLost">
  > = {},
): ObservationFrame {
  return { frameSequence, timestampMs, detections, ...flags };
}

describe("CurioLab fixture calibration and stable coin observations", () => {
  it("blocks missing markers, excessive reprojection error, and over-one-second occlusion", () => {
    const invalid = calibration({
      markerIds: ["0", "1", "2"],
      reprojectionErrorPx: 8.01,
      loadZoneOccludedMs: 1001,
    });
    expect(invalid.status).toBe("needs_calibration");
    expect(invalid.camera_counting_allowed).toBe(false);
    expect(invalid.reason_codes).toEqual([
      "missing_marker:3",
      "reprojection_error_exceeded",
      "load_zone_occluded",
    ]);
    expect(calibration().camera_counting_allowed).toBe(true);
    const counter = new StableCoinCounter("flat", invalid);
    expect(counter.observe(frame(0, 0)).status).toBe("needs_calibration");
    expect(counter.observe(frame(1, 500)).stable_count).toBe(0);
    expect(() => counter.markStop("adult_marked_stop")).toThrow(
      "calibration_required_before_camera_stop",
    );
    counter.calibrate({
      markerIds: ["0", "1", "2", "3"],
      reprojectionErrorPx: 8,
      loadZoneOccludedMs: 1000,
    });
    expect(counter.observe(frame(2, 500)).status).toBe("observing");
  });

  it("requires a continuous 500 ms stable observation and ignores duplicate frames", () => {
    const counter = new StableCoinCounter("flat", calibration());
    expect(counter.observe(frame(0, 0)).stable_count).toBe(0);
    expect(counter.observe(frame(1, 499)).stable_count).toBe(0);
    const stable = counter.observe(frame(2, 500));
    expect(stable.status).toBe("observing");
    expect(stable.stable_count).toBe(1);
    const duplicate = counter.observe(frame(2, 500));
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.stable_count).toBe(1);
    expect(counter.snapshotState().stable_count).toBe(1);
  });

  it("does not silently compensate for drift, overlap, blur, or count decrease", () => {
    const counter = new StableCoinCounter("flat", calibration());
    counter.observe(frame(0, 0));
    counter.observe(frame(1, 500));
    const drift = counter.observe(frame(2, 1000, [detection("coin-1", 113)]));
    expect(drift.status).toBe("needs_review");
    expect(drift.reason_codes).toEqual(["tracker_loss"]);
    expect(drift.stable_count).toBe(1);
    const overlap = counter.observe(
      frame(3, 1100, [detection()], { overlap: true }),
    );
    expect(overlap.reason_codes).toEqual(["overlap"]);
    const blur = counter.observe(
      frame(4, 1200, [detection()], { motionBlur: true }),
    );
    expect(blur.reason_codes).toEqual(["motion_blur"]);
    const decrease = counter.observe(frame(5, 1300, []));
    expect(decrease.status).toBe("needs_review");
    expect(decrease.reason_codes).toEqual(["sudden_count_decrease"]);
    expect(decrease.stable_count).toBe(1);
  });

  it("rejects low confidence and freezes a structured count for family confirmation", () => {
    const counter = new StableCoinCounter("folded", calibration());
    expect(
      counter.observe(frame(0, 0, [detection("coin-1", 100, 0.64)]))
        .reason_codes,
    ).toEqual(["low_confidence"]);
    counter.observe(frame(1, 0));
    counter.observe(frame(2, 500));
    const frozen = counter.markStop("adult_marked_stop");
    expect(frozen).toMatchObject({
      trial: "folded",
      status: "awaiting_family_confirmation",
      last_stable_count: 1,
      stop_reason: "adult_marked_stop",
      raw_media_persisted: false,
    });
    expect(JSON.stringify(frozen)).not.toMatch(
      /center|detections|frame_buffer/,
    );
    expect(counter.markStop("adult_marked_stop")).toEqual(frozen);
    expect(() => counter.markStop("bridge_collapsed")).toThrow(
      "conflicting_observation_stop",
    );
    expect(() => counter.observe(frame(3, 600))).toThrow(
      "observation_already_stopped",
    );
  });

  it("tracks multiple coins and rejects malformed or regressive structured input", () => {
    const counter = new StableCoinCounter("flat", calibration());
    const twoCoins = [detection("coin-1", 100), detection("coin-2", 200)];
    counter.observe(frame(0, 0, twoCoins));
    const result = counter.observe(frame(1, 500, twoCoins));
    expect(result.stable_count).toBe(2);
    expect(JSON.stringify(result)).not.toMatch(/center|detections/);
    expect(() => counter.observe(frame(0, 600, twoCoins))).not.toThrow();
    expect(() =>
      counter.observe({ ...frame(2, 500, twoCoins), timestampMs: 499 }),
    ).toThrow("observation_timestamp_regression");
    expect(() =>
      counter.observe(frame(3, 600, [{ ...detection(), confidence: 2 }])),
    ).toThrow("invalid_structured_observation");
  });
});

it("serializes actual tracker/calibration states to the Kotlin coordinator without committing them", async () => {
  const { kotlinObservationArgs } = await import(
    "../../packages/perception/src/kotlin-observation.js"
  );
  const counter = new StableCoinCounter("flat", calibration());
  const pending = counter.observe(frame(0, 0));
  expect(kotlinObservationArgs(pending).slice(2, 5)).toEqual([
    "0",
    "0.65",
    "0",
  ]);
  const stable = counter.observe(frame(1, 500));
  expect(kotlinObservationArgs(stable)).toEqual([
    "FLAT",
    "1",
    "1",
    "0.65",
    "500",
    "0,1,2,3",
    "8",
    "1000",
    "OBSERVING",
  ]);
  const review = counter.observe(
    frame(2, 600, [detection()], { overlap: true }),
  );
  expect(kotlinObservationArgs(review).at(-1)).toBe("NEEDS_REVIEW");
  counter.markStop("adult_marked_stop");
  const invalid = new StableCoinCounter(
    "flat",
    calibration({ markerIds: ["0", "1"] }),
  );
  expect(kotlinObservationArgs(invalid.observe(frame(0, 0))).at(-1)).toBe(
    "NEEDS_CALIBRATION",
  );
});

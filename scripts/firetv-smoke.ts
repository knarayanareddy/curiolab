import {
  evaluateCalibration,
  StableCoinCounter,
} from "../packages/perception/src/index.js";
import { kotlinObservationArgs } from "../packages/perception/src/kotlin-observation.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin = process.env.SIMULATOR_ORIGIN ?? "http://127.0.0.1:5173";
async function send(session: string, command: string, args: string[] = []) {
  const response = await fetch(`${origin}/api/episode`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ session, command, args }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as {
    error?: string;
    stage: string;
    flat: number;
    folded: number;
    comparison: string;
  };
}
for (const [flat, folded, branch] of [
  [3, 7, "GREATER"],
  [4, 4, "EQUAL"],
  [6, 2, "LOWER"],
] as const) {
  const session = randomUUID();
  assert.ok((await send(session, "predict", ["FLAT", "unsure"])).error);
  assert.ok(
    (
      await send(session, "begin", [
        "true",
        "false",
        "true",
        "true",
        "false",
        "MANUAL",
        "DENIED",
        "standard",
      ])
    ).error,
  );
  assert.equal(
    (
      await send(session, "begin", [
        "true",
        "true",
        "true",
        "true",
        "false",
        "MANUAL",
        "DENIED",
        "reduced_motion",
      ])
    ).stage,
    "FLAT_PREDICTION",
  );
  await send(session, "predict", ["FLAT", "unsure"]);
  assert.ok((await send(session, "confirm", ["FLAT", String(flat)])).error);
  await send(session, "stop", ["FLAT", String(flat + 1)]);
  await send(session, "confirm", ["FLAT", String(flat)]);
  await send(session, "predict", ["FOLDED", "unsure"]);
  await send(session, "stop", ["FOLDED", String(folded)]);
  const state = await send(session, "confirm", ["FOLDED", String(folded)]);
  assert.equal(state.flat, flat);
  assert.equal(state.folded, folded);
  assert.equal(state.comparison, branch);
  await send(session, "compare");
  assert.equal(
    (await send(session, "reflect", ["shape_can_matter"])).stage,
    "COMPLETE",
  );
  await send(session, "delete");
}
const cameraSession = randomUUID();
await send(cameraSession, "begin", [
  "true",
  "true",
  "true",
  "true",
  "false",
  "COMPANION",
  "GRANTED",
  "standard",
]);
await send(cameraSession, "predict", ["FLAT", "unsure"]);
const detectors = Array.from({ length: 5 }, (_, i) => ({
  detectionId: `fixture-${i}`,
  center: { x: i * 40, y: 100 },
  confidence: 0.9,
}));
const calibration = {
  markerIds: ["0", "1", "2", "3"],
  reprojectionErrorPx: 2,
  loadZoneOccludedMs: 0,
};
const tracker = new StableCoinCounter("flat", evaluateCalibration(calibration));
await send(
  cameraSession,
  "observe",
  kotlinObservationArgs(
    tracker.observe({
      frameSequence: 0,
      timestampMs: 0,
      detections: detectors,
    }),
  ),
);
assert.ok((await send(cameraSession, "stop", ["FLAT", "9"])).error);
await send(
  cameraSession,
  "observe",
  kotlinObservationArgs(
    tracker.observe({
      frameSequence: 1,
      timestampMs: 500,
      detections: detectors,
    }),
  ),
);
assert.equal(
  (await send(cameraSession, "stop", ["FLAT", "9"])).stage,
  "FLAT_CONFIRMATION",
);
assert.equal((await send(cameraSession, "confirm", ["FLAT", "4"])).flat, 4);
await send(cameraSession, "delete");
const denied = await fetch(`${origin}/api/episode`, {
  method: "POST",
  headers: { origin: "https://untrusted.example" },
  body: "{}",
});
assert.equal(denied.status, 403);
console.log(
  "PASS: live local HTTP → Kotlin: consent gating, correction, greater/equal/lower, real structured tracker → Kotlin stop/confirm, reflection, deletion and cross-origin rejection (not browser/device evidence)",
);

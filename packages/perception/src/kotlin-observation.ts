import { STABLE_DURATION_MS, type ObservationSnapshot } from "./index.js";
/** Local bridge serialization of on-device structured states; never accepts raw frames/media. */
export function kotlinObservationArgs(snapshot: ObservationSnapshot): string[] {
  if (
    snapshot.status === "stopped" ||
    snapshot.frame_sequence < 0 ||
    !Number.isSafeInteger(snapshot.frame_sequence) ||
    !Number.isInteger(snapshot.stable_count) ||
    snapshot.stable_count < 0 ||
    snapshot.stable_count > 30
  )
    throw new Error("invalid_active_observation");
  const calibration = snapshot.calibration;
  const calibrated =
    calibration.camera_counting_allowed &&
    calibration.marker_count === 4 &&
    calibration.reason_codes.length === 0;
  const status = !calibrated
    ? "NEEDS_CALIBRATION"
    : snapshot.status === "needs_review"
      ? "NEEDS_REVIEW"
      : "OBSERVING";
  // The tracker adds stable coins only after 500 ms. Pending candidates remain ineligible.
  const stableMs =
    snapshot.status === "observing" &&
    snapshot.candidate_count === snapshot.stable_count
      ? STABLE_DURATION_MS
      : 0;
  return [
    snapshot.trial.toUpperCase(),
    String(snapshot.frame_sequence),
    String(snapshot.stable_count),
    String(snapshot.confidence),
    String(stableMs),
    calibrated ? "0,1,2,3" : "",
    String(calibration.reprojection_error_px),
    String(calibration.load_zone_occluded_ms),
    status,
  ];
}

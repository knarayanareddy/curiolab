export const REQUIRED_MAT_MARKERS = ["0", "1", "2", "3"] as const;
export const MINIMUM_DETECTOR_CONFIDENCE = 0.65;
export const STABLE_DURATION_MS = 500;
export const MAXIMUM_CENTER_DRIFT_PX = 12;
export const MAXIMUM_REPROJECTION_ERROR_PX = 8;
export const MAXIMUM_OCCLUSION_MS = 1000;

export interface CalibrationInput {
  markerIds: string[];
  reprojectionErrorPx: number;
  loadZoneOccludedMs: number;
}

export interface CalibrationResult {
  status: "calibrated" | "needs_calibration";
  reason_codes: string[];
  marker_count: number;
  reprojection_error_px: number;
  load_zone_occluded_ms: number;
  camera_counting_allowed: boolean;
}

export function evaluateCalibration(
  input: CalibrationInput,
): CalibrationResult {
  if (
    !Array.isArray(input.markerIds) ||
    !Number.isFinite(input.reprojectionErrorPx) ||
    input.reprojectionErrorPx < 0 ||
    !Number.isFinite(input.loadZoneOccludedMs) ||
    input.loadZoneOccludedMs < 0
  ) {
    throw new Error("invalid_calibration_input");
  }
  const reasons: string[] = [];
  const markers = new Set(input.markerIds);
  if (markers.size !== input.markerIds.length) reasons.push("duplicate_marker");
  for (const marker of REQUIRED_MAT_MARKERS) {
    if (!markers.has(marker)) reasons.push(`missing_marker:${marker}`);
  }
  if (input.reprojectionErrorPx > MAXIMUM_REPROJECTION_ERROR_PX) {
    reasons.push("reprojection_error_exceeded");
  }
  if (input.loadZoneOccludedMs > MAXIMUM_OCCLUSION_MS) {
    reasons.push("load_zone_occluded");
  }
  return {
    status: reasons.length === 0 ? "calibrated" : "needs_calibration",
    reason_codes: reasons,
    marker_count: markers.size,
    reprojection_error_px: input.reprojectionErrorPx,
    load_zone_occluded_ms: input.loadZoneOccludedMs,
    camera_counting_allowed: reasons.length === 0,
  };
}

export interface CoinDetection {
  detectionId: string;
  center: { x: number; y: number };
  confidence: number;
}

export interface ObservationFrame {
  frameSequence: number;
  timestampMs: number;
  detections: CoinDetection[];
  overlap?: boolean;
  motionBlur?: boolean;
  trackerLost?: boolean;
}

export interface ObservationSnapshot {
  trial: "flat" | "folded";
  status: "needs_calibration" | "observing" | "needs_review" | "stopped";
  frame_sequence: number;
  stable_count: number;
  candidate_count: number;
  confidence: number;
  reason_codes: string[];
  duplicate: boolean;
  calibration: CalibrationResult;
}

export interface FrozenObservation {
  trial: "flat" | "folded";
  status: "awaiting_family_confirmation";
  last_stable_count: number;
  confidence: number;
  stop_reason: "adult_marked_stop" | "bridge_collapsed";
  frame_sequence: number;
  review_required: boolean;
  raw_media_persisted: false;
}

interface Track {
  anchor: { x: number; y: number };
  detectionId: string;
  firstSeenMs: number;
  lastSeenMs: number;
  lastFrameSequence: number;
  lastConfidence: number;
  stable: boolean;
}

function distance(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function validDetection(detection: CoinDetection): boolean {
  return (
    detection.detectionId.trim().length > 0 &&
    Number.isFinite(detection.center.x) &&
    Number.isFinite(detection.center.y) &&
    Number.isFinite(detection.confidence) &&
    detection.confidence >= 0 &&
    detection.confidence <= 1
  );
}

/** In-memory structured tracker only; frame buffers and images never enter this API. */
export class StableCoinCounter {
  private calibrationResult: CalibrationResult;
  private tracks: Track[] = [];
  private lastFrameSequence = -1;
  private lastTimestampMs = 0;
  private current: ObservationSnapshot;
  private stopped: FrozenObservation | undefined;

  constructor(
    private readonly trial: "flat" | "folded",
    calibration: CalibrationResult,
  ) {
    this.calibrationResult = structuredClone(calibration);
    this.current = this.snapshot("observing", [], 0, 0, false);
    if (!calibration.camera_counting_allowed) {
      this.current = this.snapshot(
        "needs_calibration",
        calibration.reason_codes,
        0,
        0,
        false,
      );
    }
  }

  calibrate(input: CalibrationInput): CalibrationResult {
    if (this.stopped) throw new Error("observation_already_stopped");
    this.calibrationResult = evaluateCalibration(input);
    this.tracks = [];
    this.lastFrameSequence = -1;
    this.lastTimestampMs = 0;
    this.current = this.snapshot(
      this.calibrationResult.camera_counting_allowed
        ? "observing"
        : "needs_calibration",
      this.calibrationResult.reason_codes,
      0,
      0,
      false,
    );
    return structuredClone(this.calibrationResult);
  }

  private snapshot(
    status: ObservationSnapshot["status"],
    reasons: string[],
    candidateCount: number,
    confidence: number,
    duplicate: boolean,
  ): ObservationSnapshot {
    return {
      trial: this.trial,
      status,
      frame_sequence: Math.max(0, this.lastFrameSequence),
      stable_count: this.tracks.filter((track) => track.stable).length,
      candidate_count: candidateCount,
      confidence,
      reason_codes: [...reasons],
      duplicate,
      calibration: structuredClone(this.calibrationResult),
    };
  }

  observe(frame: ObservationFrame): ObservationSnapshot {
    if (this.stopped) throw new Error("observation_already_stopped");
    if (
      !Number.isSafeInteger(frame.frameSequence) ||
      frame.frameSequence < 0 ||
      !Number.isFinite(frame.timestampMs) ||
      frame.timestampMs < 0 ||
      frame.detections.length > 30 ||
      frame.detections.some((detection) => !validDetection(detection))
    ) {
      throw new Error("invalid_structured_observation");
    }
    if (frame.frameSequence <= this.lastFrameSequence) {
      return { ...structuredClone(this.current), duplicate: true };
    }
    if (frame.timestampMs < this.lastTimestampMs) {
      throw new Error("observation_timestamp_regression");
    }
    this.lastFrameSequence = frame.frameSequence;
    this.lastTimestampMs = frame.timestampMs;
    if (!this.calibrationResult.camera_counting_allowed) {
      this.current = this.snapshot(
        "needs_calibration",
        this.calibrationResult.reason_codes,
        0,
        0,
        false,
      );
      return structuredClone(this.current);
    }
    const reasons: string[] = [];
    if (frame.overlap) reasons.push("overlap");
    if (frame.motionBlur) reasons.push("motion_blur");
    if (frame.trackerLost) reasons.push("tracker_loss");
    if (
      frame.detections.some(
        (detection) => detection.confidence < MINIMUM_DETECTOR_CONFIDENCE,
      )
    ) {
      reasons.push("low_confidence");
    }
    if (frame.detections.length < this.stableCount) {
      reasons.push("sudden_count_decrease");
    }
    if (reasons.length > 0) {
      this.current = this.snapshot(
        "needs_review",
        reasons,
        frame.detections.length,
        this.confidence(frame.detections),
        false,
      );
      return structuredClone(this.current);
    }

    const working = this.tracks.map((track) => structuredClone(track));
    const used = new Set<Track>();
    for (const detection of frame.detections) {
      const candidates = working
        .filter((track) => !used.has(track))
        .map((track) => ({
          track,
          drift: distance(track.anchor, detection.center),
        }))
        .filter((candidate) => candidate.drift <= MAXIMUM_CENTER_DRIFT_PX)
        .sort((left, right) => left.drift - right.drift);
      const track = candidates[0]?.track;
      if (!track) {
        const created: Track = {
          anchor: { ...detection.center },
          detectionId: detection.detectionId,
          firstSeenMs: frame.timestampMs,
          lastSeenMs: frame.timestampMs,
          lastFrameSequence: frame.frameSequence,
          lastConfidence: detection.confidence,
          stable: false,
        };
        working.push(created);
        used.add(created);
        continue;
      }
      if (!track.stable && frame.frameSequence > track.lastFrameSequence + 1) {
        track.firstSeenMs = frame.timestampMs;
      }
      track.detectionId = detection.detectionId;
      track.lastSeenMs = frame.timestampMs;
      track.lastFrameSequence = frame.frameSequence;
      track.lastConfidence = detection.confidence;
      used.add(track);
    }
    if (working.some((track) => track.stable && !used.has(track))) {
      this.current = this.snapshot(
        "needs_review",
        ["tracker_loss"],
        frame.detections.length,
        this.confidence(frame.detections),
        false,
      );
      return structuredClone(this.current);
    }
    for (const track of used) {
      if (
        !track.stable &&
        track.lastSeenMs - track.firstSeenMs >= STABLE_DURATION_MS &&
        track.lastConfidence >= MINIMUM_DETECTOR_CONFIDENCE
      ) {
        track.stable = true;
      }
    }
    this.tracks = working;
    this.current = this.snapshot(
      "observing",
      [],
      frame.detections.length,
      this.confidence(frame.detections),
      false,
    );
    return structuredClone(this.current);
  }

  private confidence(detections: CoinDetection[]): number {
    return detections.length === 0
      ? 0
      : Math.min(...detections.map((detection) => detection.confidence));
  }

  private get stableCount(): number {
    return this.tracks.filter((track) => track.stable).length;
  }

  markStop(stopReason: FrozenObservation["stop_reason"]): FrozenObservation {
    if (this.stopped) {
      if (this.stopped.stop_reason !== stopReason) {
        throw new Error("conflicting_observation_stop");
      }
      return structuredClone(this.stopped);
    }
    if (!this.calibrationResult.camera_counting_allowed) {
      throw new Error("calibration_required_before_camera_stop");
    }
    this.stopped = {
      trial: this.trial,
      status: "awaiting_family_confirmation",
      last_stable_count: this.stableCount,
      confidence: this.current.confidence,
      stop_reason: stopReason,
      frame_sequence: Math.max(0, this.lastFrameSequence),
      review_required: this.current.status === "needs_review",
      raw_media_persisted: false,
    };
    this.current = this.snapshot(
      "stopped",
      this.current.reason_codes,
      this.current.candidate_count,
      this.current.confidence,
      false,
    );
    return structuredClone(this.stopped);
  }

  snapshotState(): ObservationSnapshot {
    return structuredClone(this.current);
  }
}

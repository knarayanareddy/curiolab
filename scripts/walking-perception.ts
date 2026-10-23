import {
  evaluateCalibration,
  StableCoinCounter,
  type CoinDetection,
} from "../packages/perception/src/index.js";
import { FixturePairingService } from "../services/pairing/src/fixture-pairing-service.js";

const blocked = evaluateCalibration({
  markerIds: ["0", "1", "2"],
  reprojectionErrorPx: 8.5,
  loadZoneOccludedMs: 1001,
});
const calibrated = evaluateCalibration({
  markerIds: ["0", "1", "2", "3"],
  reprojectionErrorPx: 4,
  loadZoneOccludedMs: 0,
});
const detections: CoinDetection[] = [
  {
    detectionId: "fixture-coin-1",
    center: { x: 100, y: 100 },
    confidence: 0.9,
  },
  {
    detectionId: "fixture-coin-2",
    center: { x: 200, y: 100 },
    confidence: 0.9,
  },
];
const counter = new StableCoinCounter("flat", calibrated);
const candidate = counter.observe({
  frameSequence: 0,
  timestampMs: 0,
  detections,
});
const stable = counter.observe({
  frameSequence: 1,
  timestampMs: 500,
  detections,
});
const duplicate = counter.observe({
  frameSequence: 1,
  timestampMs: 500,
  detections,
});
const stopped = counter.markStop("adult_marked_stop");
const pairing = new FixturePairingService({
  clock: () => new Date("2026-10-23T12:00:00.000Z"),
  codeGenerator: () => "ABCD23",
  idGenerator: () => "fixture-walking-session",
  credentialGenerator: () => "fixture-walking-scoped-credential",
});
const createdSession = pairing.createSession({
  tvDeviceId: "fixture-walking-tv",
  parentApproved: true,
});
const paired = pairing.exchange({
  code: createdSession.pairing_code,
  deviceNonce: "fixture-walking-nonce-0001",
  companionDeviceId: "fixture-walking-companion",
  ipAddress: "fixture-walking-ip",
});
const claims = pairing.authorize({
  sessionId: paired.session.session_id,
  deviceId: paired.credential.device_id,
  credential: paired.credential.credential,
  requiredScope: "observation:write",
});
let oneTimeUseDenied = false;
try {
  pairing.exchange({
    code: createdSession.pairing_code,
    deviceNonce: "fixture-second-nonce-0001",
    companionDeviceId: "fixture-second-companion",
    ipAddress: "fixture-second-ip",
  });
} catch (error) {
  oneTimeUseDenied =
    error instanceof Error && error.message === "pairing_code_consumed";
}
pairing.revoke({
  sessionId: paired.session.session_id,
  actorRole: "adult",
  adultConfirmed: true,
});
let revokedCredentialDenied = false;
try {
  pairing.authorize({
    sessionId: paired.session.session_id,
    deviceId: paired.credential.device_id,
    credential: paired.credential.credential,
    requiredScope: "session:read",
  });
} catch (error) {
  revokedCredentialDenied =
    error instanceof Error && error.message === "scoped_credential_rejected";
}
console.log(
  JSON.stringify(
    {
      mode: "FIXTURE ONLY — structured perception; no CameraX, TFLite, Fire TV, or media",
      blocked_calibration: blocked,
      candidate_observation: {
        status: candidate.status,
        stable_count: candidate.stable_count,
      },
      stable_observation: {
        status: stable.status,
        stable_count: stable.stable_count,
        confidence: stable.confidence,
      },
      duplicate_frame_ignored: duplicate.duplicate,
      stopped_observation: stopped,
      pairing_session_state: paired.session.state,
      pairing_code_expires_at: createdSession.session.pairing_code_expires_at,
      pairing_scopes: claims.scopes,
      pairing_one_time_use_enforced: oneTimeUseDenied,
      pairing_revocation_invalidates_credential: revokedCredentialDenied,
      pairing_live_relay: false,
      tv_measurement_committed: false,
      raw_media_persisted: false,
      notice:
        "Synthetic detections and in-memory pairing only; the frozen count still requires family confirmation and authoritative TV session handling. No REST, WebSocket, AWS, or companion connection is claimed.",
    },
    null,
    2,
  ),
);

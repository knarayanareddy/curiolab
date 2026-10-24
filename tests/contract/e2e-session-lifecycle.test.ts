// @vitest-environment jsdom
/** Local E2E: real DOM, pairing/client/broker/tracker and actual Kotlin coordinator.
 * TV/pairing HTTP boundaries, relay transport/store and camera frames are fixtures.
 * No AWS, Android, physical-collapse or device evidence is implied.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, afterAll, afterEach, expect, it, vi } from "vitest";
import { KotlinSimulatorEngine } from "../../services/simulator/src/kotlin-engine.js";
import {
  SimulatorCompanionInput,
  committedRelaySnapshot,
} from "../../services/simulator/src/companion-input.js";
import { FixturePairingService } from "../../services/pairing/src/fixture-pairing-service.js";
import { PairingClient } from "../../packages/session-contracts/src/pairing-client.js";
import {
  WebSocketRelayClient,
  type RelaySocket,
  type RelayMessage,
} from "../../packages/session-contracts/src/relay-client.js";
import {
  ObservationBroker,
  credentialHash,
} from "../../services/session-relay/src/broker.js";
import { fixtureStore } from "../../packages/testkit/src/backend-fixture.js";
import {
  evaluateCalibration,
  StableCoinCounter,
  type ObservationSnapshot,
} from "../../packages/perception/src/index.js";
import { AUTHORED_HINTS } from "../../packages/model-gateway/src/index.js";
import type { SimulatorState } from "../../packages/session-contracts/src/simulator-state.js";
let engine: KotlinSimulatorEngine;
let disposeUI: (() => void) | undefined;
beforeAll(async () => {
  // Build from source even on a clean checkout: never use a stale or simulated engine.
  await promisify(execFile)("bash", ["scripts/kotlin.sh", "build"], {
    timeout: 90000,
  });
  engine = new KotlinSimulatorEngine();
}, 100000);
afterAll(() => engine?.close());
afterEach(() => {
  disposeUI?.();
  disposeUI = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function click(label: string) {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((element) => element.textContent === label);
  expect(button, `Missing action: ${label}`).toBeDefined();
  expect(button!.disabled).toBe(false);
  button!.click();
}
it.each([
  [3, 7, "GREATER", "standard"],
  [4, 4, "EQUAL", "reduced_motion"],
  [6, 2, "LOWER", "no_timing"],
] as const)(
  "complete local paired lifecycle: flat=%s folded=%s → %s (%s)",
  async (flat, folded, branch, mode) => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    let session = "";
    let state: SimulatorState | undefined;
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe("/api/episode");
      const request = JSON.parse(String(init?.body)) as {
        session: string;
        command: string;
        args: string[];
      };
      session = request.session;
      const reply = await engine.request(
        session,
        request.command,
        request.args,
      );
      if ("stage" in reply) state = reply;
      return Response.json(reply);
    });
    vi.stubGlobal("fetch", fetcher);
    const app = await import("../../apps/firetv/src/main.js");
    disposeUI = app.disposeEpisodeUI;
    const waitStage = async (stage: SimulatorState["stage"]) =>
      vi.waitFor(() => {
        expect(state?.stage).toBe(stage);
        expect(document.getElementById("app")?.getAttribute("aria-busy")).toBe(
          "false",
        );
        expect(document.getElementById("episode-canvas")?.dataset.stage).toBe(
          stage,
        );
      });
    await waitStage("SAFETY_AND_CONSENT");
    expect(
      await engine.request(session, "predict", ["FLAT", "folded"]),
    ).toHaveProperty("error");
    click("All set — begin our mission →");
    await vi.waitFor(() =>
      expect(document.getElementById("error")?.textContent).toContain(
        "Action rejected",
      ),
    );
    expect(state?.stage).toBe("SAFETY_AND_CONSENT");
    for (const id of ["adult", "privacy", "safety", "objects"])
      (document.getElementById(id) as HTMLInputElement).checked = true;
    (document.getElementById("camera") as HTMLSelectElement).value =
      "COMPANION";
    (document.getElementById("permission") as HTMLSelectElement).value =
      "GRANTED";
    (document.getElementById("accessibility") as HTMLSelectElement).value =
      mode;
    click("All set — begin our mission →");
    await waitStage("FLAT_PREDICTION");
    // Begin at the prediction controls (header links are also legitimate focus targets).
    document.querySelector<HTMLButtonElement>("#actions button")!.focus();
    expect(document.activeElement?.textContent).toBe("Flat paper");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement?.textContent).toBe("Folded paper");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "BrowserBack", bubbles: true }),
    );
    expect(document.activeElement?.textContent).toBe("Return to episode");
    click("Return to episode");
    expect(document.activeElement?.textContent).toBe("Folded paper");
    expect(state?.stage).toBe("FLAT_PREDICTION");
    expect(state?.accessibility_mode).toBe(mode);
    expect(document.documentElement.dataset.motion).toBe(mode);

    const clock = () => new Date("2026-10-24T12:00:00Z");
    const pairing = new FixturePairingService({
      clock,
      idGenerator: () => session,
      codeGenerator: () => "ABC234",
      credentialGenerator: () => "fixture-scoped-phone-credential",
    });
    const created = pairing.createSession({
      tvDeviceId: "tv1",
      parentApproved: state?.stage === "FLAT_PREDICTION",
    });
    const exchange = new PairingClient(
      async (url, init) => {
        expect(url).toBe("/v1/pairings/exchange");
        const payload = JSON.parse(String(init?.body));
        const result = pairing.exchange({
          code: payload.code,
          deviceNonce: payload.device_nonce,
          companionDeviceId: "phone1",
          ipAddress: "192.0.2.1",
        });
        return Response.json({
          credential: result.credential.credential,
          session_id: result.credential.session_id,
          device_id: result.credential.device_id,
          expires_at: result.credential.expires_at,
        });
      },
      () => clock().getTime(),
    );
    const credential = await exchange.exchange(
      created.pairing_code,
      "fixture-device-nonce-123",
    );
    expect(credential.session_id).toBe(session);
    expect(() =>
      pairing.exchange({
        code: created.pairing_code,
        deviceNonce: "other-fixture-nonce-123",
        companionDeviceId: "other",
        ipAddress: "192.0.2.2",
      }),
    ).toThrow("consumed");
    pairing.authorize({
      sessionId: session,
      deviceId: "phone1",
      credential: credential.credential,
      requiredScope: "observation:write",
    });

    const fixture = fixtureStore();
    fixture.mutate((data) => {
      data.id = session;
      data.ttl = Math.floor(clock().getTime() / 1000) + 7 * 86400;
      for (const grant of data.grants)
        grant.expiresAt = Math.floor(Date.parse(credential.expires_at) / 1000);
      data.grants[1]!.tokenHash = credentialHash(credential.credential);
    });
    const sockets = new Map<string, RelaySocket>();
    const errors: unknown[] = [];
    const tasks: Promise<unknown>[] = [];
    const broker = new ObservationBroker(fixture.store, fixture.delivery, () =>
      Math.floor(clock().getTime() / 1000),
    );
    // Fixture-only metadata port: the v1 status-only wire does NOT carry calibration
    // geometry/stability duration. Supply real tracker snapshots, never guessed metrics.
    const frames = new Map<string, ObservationSnapshot>();
    const input = new SimulatorCompanionInput(engine, session, (trial, frame) =>
      frames.get(`${trial}:${frame}`),
    );
    const companionMessages: RelayMessage[] = [];
    const tvMessages: RelayMessage[] = [];
    const makeSocket = (id: string): RelaySocket => {
      const socket: RelaySocket = {
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        send: (bytes) => {
          tasks.push(
            broker.receive(id, bytes).catch((error) => {
              errors.push(error);
            }),
          );
        },
        close: () => {},
      };
      sockets.set(id, socket);
      return socket;
    };
    fixture.delivery.post.mockImplementation(async (id, value) => {
      sockets.get(id)?.onmessage?.({ data: JSON.stringify(value) });
    });
    const tv = new WebSocketRelayClient(
      () => makeSocket("tvconnection"),
      (message) => {
        tvMessages.push(message);
        if (message.type.startsWith("observation."))
          tasks.push(
            input
              .receive(message)
              .then((reply) => {
                if (reply && "error" in reply) throw new Error(reply.error);
              })
              .catch((error) => {
                errors.push(error);
              }),
          );
      },
      clock,
    );
    const phone = new WebSocketRelayClient(
      () => makeSocket("phoneconnection"),
      (message) => companionMessages.push(message),
      clock,
    );
    const flush = async () => {
      while (tasks.length) await Promise.all(tasks.splice(0));
      expect(errors).toEqual([]);
    };
    try {
      tv.connect("wss://relay.example/test", {
        sessionId: session,
        deviceId: "tv1",
        credential: "fictional-tv-credential",
      });
      sockets.get("tvconnection")?.onopen?.();
      await flush();
      phone.connect("wss://relay.example/test", {
        sessionId: session,
        deviceId: credential.device_id,
        credential: credential.credential,
      });
      sockets.get("phoneconnection")?.onopen?.();
      await flush();
      expect(tvMessages[0]?.type).toBe("session.hello");
      expect(companionMessages[0]?.type).toBe("session.hello");
      click("Need a hint?");
      await vi.waitFor(() =>
        expect(document.getElementById("hint-text")?.textContent).toBe(
          `Authored hint · ${AUTHORED_HINTS.FLAT_PREDICTION}`,
        ),
      );
      expect(document.getElementById("hint-text")?.hidden).toBe(false);
      expect(fetcher.mock.calls.every(([url]) => url === "/api/episode")).toBe(
        true,
      ); // No Bedrock request at all.

      let persistedSequence = -1;
      const publish = async () => {
        tv.send("state.snapshot", {
          state: committedRelaySnapshot(state!),
          expected_state_sequence: persistedSequence,
        });
        await flush();
        persistedSequence = state!.sequence;
        expect(fixture.data().snapshot?.state_sequence).toBe(persistedSequence);
      };
      click("Folded paper");
      await waitStage("FLAT_LAB");
      await publish();
      expect(fixture.data().snapshot?.predictions.flat_winner).toBe("folded");
      const observeAndStop = async (
        trial: "flat" | "folded",
        coins: number,
      ) => {
        const counter = new StableCoinCounter(
          trial,
          evaluateCalibration({
            markerIds: ["0", "1", "2", "3"],
            reprojectionErrorPx: 2,
            loadZoneOccludedMs: 0,
          }),
        );
        const detections = Array.from({ length: coins }, (_, i) => ({
          detectionId: `fixture-coin-${i}`,
          center: { x: i * 40, y: 100 },
          confidence: 0.9,
        }));
        const sendFrame = async (snapshot: ObservationSnapshot) => {
          frames.set(`${trial}:${snapshot.frame_sequence}`, snapshot);
          phone.send("observation.candidate", {
            trial,
            observed_count: snapshot.stable_count,
            confidence: snapshot.confidence,
            calibration:
              snapshot.status === "observing" ? "calibrated" : snapshot.status,
            frame_sequence: snapshot.frame_sequence,
          });
          await flush();
          await app.refreshEpisode();
        };
        const uncalibrated = new StableCoinCounter(
          trial,
          evaluateCalibration({
            markerIds: ["0", "1", "2"],
            reprojectionErrorPx: 2,
            loadZoneOccludedMs: 0,
          }),
        );
        await sendFrame(
          uncalibrated.observe({
            frameSequence: 0,
            timestampMs: 0,
            detections,
          }),
        );
        expect(state?.perception).toBe("NEEDS_CALIBRATION");
        expect(
          await engine.request(session, "stop", [trial.toUpperCase(), "9"]),
        ).toHaveProperty("error");
        for (const [frameSequence, timestampMs] of [
          [1, 0],
          [2, 500],
        ]) {
          const snapshot = counter.observe({
            frameSequence: frameSequence!,
            timestampMs: timestampMs!,
            detections,
          });
          await sendFrame(snapshot);
          expect(state?.[trial === "flat" ? "flat" : "folded"]).toBeNull();
          expect(
            document.querySelector(`[data-trial="${trial}"] [data-crate]`),
          ).toBeNull();
          if (frameSequence === 1)
            expect(
              await engine.request(session, "stop", [trial.toUpperCase(), "9"]),
            ).toHaveProperty("error");
        }
        const beforeStale = state!.sequence;
        await sendFrame(frames.get(`${trial}:1`)!); // New envelope, stale camera frame.
        expect(state?.observed).toBe(coins);
        expect(state?.sequence).toBe(beforeStale);
        const stopped = counter.markStop("adult_marked_stop");
        phone.send("observation.stopped", {
          trial,
          last_stable_count: stopped.last_stable_count,
          confidence: stopped.confidence,
          stop_reason: stopped.stop_reason,
        });
        await flush();
        await app.refreshEpisode();
        expect(state?.stage).toBe(
          trial === "flat" ? "FLAT_CONFIRMATION" : "FOLDED_CONFIRMATION",
        );
        expect(state?.stopped).toBe(coins);
        expect(document.getElementById("episode-canvas")?.dataset.quiet).toBe(
          "true",
        );
        expect(
          document.querySelector(`[data-trial="${trial}"] [data-crate]`),
        ).toBeNull();
      };
      await observeAndStop("flat", flat + 1);
      click("−");
      expect(document.querySelector("output")?.textContent).toBe(
        `${flat} coins`,
      );
      click("Confirm our measurement →");
      await waitStage("FOLDED_PREDICTION");
      await publish();
      expect(state?.flat).toBe(flat);
      expect(fixture.data().snapshot?.measurements.flat_load).toBe(flat);
      expect(
        document.querySelector('[data-trial="flat"]')?.textContent,
      ).toContain(`${flat} confirmed coins`);
      expect(document.getElementById("episode-canvas")?.dataset.branch).toBe(
        "PENDING",
      );
      click("More coins");
      await waitStage("FOLDED_LAB");
      await publish();
      await observeAndStop("folded", folded);
      click("Confirm our measurement →");
      await waitStage("COMPARISON");
      await publish();
      expect(state?.comparison).toBe(branch);
      expect(state?.folded).toBe(folded);
      expect(document.getElementById("episode-canvas")?.dataset.branch).toBe(
        branch,
      );
      expect(document.querySelector(".branch-feedback")?.textContent).toContain(
        `flat ${flat} coins · folded ${folded} coins`,
      );
      expect(companionMessages.at(-1)?.payload.state).toMatchObject({
        measurements: { flat_load: flat, folded_load: folded },
      });
      click("Reflect on our experiment →");
      await waitStage("REFLECTION");
      click("Shape can make a difference");
      await waitStage("COMPLETE");
      await publish();
      expect(document.querySelector(".branch-feedback")?.textContent).toContain(
        "not a universal law",
      );
      const sequence = state!.sequence;
      expect(
        await engine.request(session, "confirm", ["FOLDED", String(folded)]),
      ).toMatchObject({ sequence, comparison: branch });
      pairing.complete({ sessionId: session, tvDeviceId: "tv1" });
      expect(pairing.credentialCount).toBe(0);
      fixture.mutate((data) => {
        data.completed = true;
        for (const grant of data.grants) grant.revoked = true;
      });
      await expect(
        broker.receive(
          "phoneconnection",
          JSON.stringify({
            schema_version: 1,
            message_id: "after-completion",
            session_id: session,
            device_id: "phone1",
            sequence: 100,
            sent_at: clock().toISOString(),
            type: "observation.candidate",
            payload: {
              trial: "folded",
              observed_count: 9,
              confidence: 0.9,
              calibration: "calibrated",
              frame_sequence: 100,
            },
          }),
        ),
      ).rejects.toThrow("unauthorized");
      vi.spyOn(window, "confirm").mockReturnValue(true);
      click("Clear this session");
      await waitStage("SAFETY_AND_CONSENT");
      expect(document.querySelector("[data-crate]")).toBeNull();
    } finally {
      tv.disconnect();
      phone.disconnect();
      await engine.request(session, "delete");
    }
  },
  20000,
);

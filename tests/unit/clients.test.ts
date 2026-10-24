import { describe, expect, it, vi } from "vitest";
import {
  ModelGateway,
  HttpHintTransport,
  AUTHORED_HINTS,
} from "../../packages/model-gateway/src/index.js";
import {
  WebSocketRelayClient,
  type RelaySocket,
} from "../../packages/session-contracts/src/relay-client.js";
const context = { nodeId: "FLAT_LAB", attempt: 0 };
describe("deterministic hint gateway", () => {
  it("works disabled and accepts bounded structured plain text", async () => {
    expect((await new ModelGateway().hint(context)).text).toBe(
      AUTHORED_HINTS.FLAT_LAB,
    );
    expect(
      await new ModelGateway({
        request: async () => ({
          hint_id: "hint1",
          hint_level: 1,
          uses_fallback: false,
          text: AUTHORED_HINTS.FLAT_LAB,
        }),
      }).hint(context),
    ).toEqual({
      source: "gateway",
      text: AUTHORED_HINTS.FLAT_LAB,
      hintLevel: 1,
      reason: "validated",
    });
  });
  it.each([
    null,
    {},
    { schema_version: 2, text: "Hi" },
    { schema_version: 1, text: "<script>unsafe</script>" },
    { schema_version: 1, text: "x".repeat(241) },
    { schema_version: 1, text: "" },
    { schema_version: 1, text: "ok", command: "overwrite_count" },
  ])("falls back for invalid output %j", async (value) => {
    expect(
      (await new ModelGateway({ request: async () => value }).hint(context))
        .source,
    ).toBe("authored");
  });
  it("bounds non-cooperative providers and handles HTTP failure", async () => {
    vi.useFakeTimers();
    try {
      const pending = new ModelGateway({
        request: () => new Promise(() => {}),
      }).hint(context);
      await vi.advanceTimersByTimeAsync(1500);
      expect((await pending).reason).toBe("unavailable");
    } finally {
      vi.useRealTimers();
    }
    const transport = new HttpHintTransport(
      async () => new Response("denied", { status: 403 }),
    );
    expect((await new ModelGateway(transport).hint(context)).source).toBe(
      "authored",
    );
    await expect(
      new ModelGateway().hint({ nodeId: "unknown", attempt: 0 }),
    ).rejects.toThrow();
  });
});
function socket(): RelaySocket & { sent: string[] } {
  return {
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    sent: [],
    send(data) {
      this.sent.push(data);
    },
    close: vi.fn(),
  };
}
const scope = {
  sessionId: "session1",
  deviceId: "tv1",
  credential: "scoped-fixture-credential",
};
function observation(sequence: number, payload: object = {}) {
  return JSON.stringify({
    schema_version: 1,
    session_id: "session1",
    device_id: "phone1",
    message_id: `msg${sequence}`,
    sequence,
    sent_at: "2026-10-24T12:00:00Z",
    type: "observation.candidate",
    payload: {
      trial: "flat",
      observed_count: 5,
      confidence: 0.9,
      calibration: "calibrated",
      frame_sequence: sequence,
      ...payload,
    },
  });
}
describe("scoped WebSocket relay client", () => {
  it("authenticates in hello, filters replay/out-of-order and reconnects without reusing stale sockets", () => {
    const first = socket();
    const second = socket();
    const receive = vi.fn();
    let n = 0;
    const client = new WebSocketRelayClient(
      () => (n++ === 0 ? first : second),
      receive,
    );
    client.connect("wss://relay.example/", scope);
    first.onopen?.();
    expect(JSON.parse(first.sent[0]!).payload.credential).toBe(
      scope.credential,
    );
    first.onmessage?.({ data: observation(2) });
    first.onmessage?.({ data: observation(1) });
    first.onmessage?.({ data: observation(2) });
    expect(receive).toHaveBeenCalledTimes(1);
    client.connect("wss://relay.example/", scope);
    second.onopen?.();
    expect(JSON.parse(second.sent[0]!).payload.last_acknowledged_sequence).toBe(
      2,
    );
    first.onmessage?.({ data: observation(3) });
    expect(receive).toHaveBeenCalledTimes(1);
    second.onmessage?.({ data: observation(3) });
    expect(receive).toHaveBeenCalledTimes(2);
    client.disconnect();
    expect(client.status).toBe("offline");
  });
  it("rejects media, bad counts, wrong sessions, oversize and unsafe endpoints", () => {
    const ws = socket();
    const receive = vi.fn();
    const client = new WebSocketRelayClient(() => ws, receive);
    expect(() => client.connect("ws://relay.example/", scope)).toThrow();
    expect(() =>
      client.connect("wss://relay.example/?token=secret", scope),
    ).toThrow();
    client.connect("wss://relay.example/", scope);
    for (const data of [
      observation(1, { raw_frame: "private" }),
      observation(2, { observed_count: 31 }),
      observation(3).replace("session1", "other"),
      "x".repeat(16385),
      "not json",
    ])
      ws.onmessage?.({ data });
    expect(receive).not.toHaveBeenCalled();
    expect(client.status).toBe("invalid_message");
  });
  it("revocation stops the connection, errors preserve offline fallback", () => {
    const ws = socket();
    const client = new WebSocketRelayClient(() => ws, vi.fn());
    client.connect("wss://relay.example/", scope);
    const error = JSON.parse(observation(1));
    error.type = "session.error";
    error.payload = { code: "revoked", recoverable: false };
    ws.onmessage?.({ data: JSON.stringify(error) });
    expect(client.status).toBe("denied");
    expect(ws.close).toHaveBeenCalled();
  });
});
it("times out an unopened relay connection without blocking manual play", async () => {
  vi.useFakeTimers();
  try {
    const ws = socket();
    const client = new WebSocketRelayClient(() => ws, vi.fn());
    client.connect("wss://relay.example/", scope);
    await vi.advanceTimersByTimeAsync(5000);
    expect(client.status).toBe("offline");
    expect(ws.close).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it("bounds valid-schema hint text and retains same-level authored error recovery", async () => {
  for (const text of [
    "<b>Check all four markers before trying again.</b>",
    "x".repeat(241),
    "Hi",
    "Try a heavy glass object on the bridge instead.",
  ]) {
    const result = await new ModelGateway({
      request: async () => ({
        hint_id: "hint1",
        hint_level: 2,
        uses_fallback: false,
        text,
      }),
    }).hint({ ...context, attempt: 1, lastError: "occluded" });
    expect(result.source).toBe("authored");
    expect(result.hintLevel).toBe(2);
    expect(result.text).toContain("all four markers");
  }
});

import { expect, it, vi } from "vitest";
import {
  WebSocketRelayClient,
  type RelaySocket,
  type RelayMessage,
} from "../../packages/session-contracts/src/relay-client.js";
import { fixtureStore } from "../../packages/testkit/src/backend-fixture.js";
it("interoperates bidirectionally: real clients authenticate, send typed observations/snapshots, and resume safely", async () => {
  const f = fixtureStore();
  const sockets = new Map<string, RelaySocket>();
  const errors: unknown[] = [];
  const makeSocket = (id: string): RelaySocket => {
    const socket: RelaySocket = {
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      send: (bytes) => {
        void f.broker.receive(id, bytes).catch((error) => errors.push(error));
      },
      close: () => {},
    };
    sockets.set(id, socket);
    return socket;
  };
  f.delivery.post.mockImplementation(async (id, value) => {
    sockets.get(id)?.onmessage?.({ data: JSON.stringify(value) });
  });
  const tvMessages: RelayMessage[] = [];
  const phoneMessages: RelayMessage[] = [];
  const tv = new WebSocketRelayClient(
    () => makeSocket("tvconnection"),
    (message) => tvMessages.push(message),
  );
  const phone = new WebSocketRelayClient(
    () => makeSocket("phoneconnection"),
    (message) => phoneMessages.push(message),
  );
  const tvScope = {
    sessionId: "session1",
    deviceId: "tv1",
    credential: "fictional-tv-credential",
  };
  const phoneScope = {
    sessionId: "session1",
    deviceId: "phone1",
    credential: "fictional-phone-credential",
  };
  tv.connect("wss://relay.example/test", tvScope);
  expect(() => tv.send("state.snapshot", {})).toThrow(
    "relay_not_authenticated",
  );
  sockets.get("tvconnection")?.onopen?.();
  await vi.waitFor(() => expect(tvMessages[0]?.type).toBe("session.hello"));
  phone.connect("wss://relay.example/test", phoneScope);
  sockets.get("phoneconnection")?.onopen?.();
  await vi.waitFor(() => expect(phoneMessages[0]?.type).toBe("session.hello"));
  phone.send("observation.candidate", {
    trial: "flat",
    observed_count: 5,
    confidence: 0.9,
    calibration: "calibrated",
    frame_sequence: 1,
  });
  await vi.waitFor(() =>
    expect(tvMessages.at(-1)?.payload.observed_count).toBe(5),
  );
  expect(() =>
    phone.send("observation.candidate", { raw_frame: "secret" }),
  ).toThrow();
  tv.send("state.snapshot", {
    state: {
      current_node_id: "node_flat_lab",
      content_version: "0.1.0",
      state_sequence: 1,
      predictions: { flat_winner: "unsure" },
      measurements: {},
    },
    expected_state_sequence: -1,
  });
  await vi.waitFor(() =>
    expect(phoneMessages.at(-1)?.type).toBe("state.snapshot"),
  );
  phone.disconnect();
  phone.connect("wss://relay.example/test", phoneScope);
  sockets.get("phoneconnection")?.onopen?.();
  await vi.waitFor(() =>
    expect(phoneMessages.at(-1)?.type).toBe("session.hello"),
  );
  expect(phoneMessages.at(-1)?.payload.snapshot).toMatchObject({
    current_node_id: "node_flat_lab",
  });
  expect(errors).toEqual([]);
  tv.disconnect();
  phone.disconnect();
});

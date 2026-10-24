import { vi } from "vitest";
import {
  ObservationBroker,
  credentialHash,
  type RelaySession,
  type RelayStore,
} from "../../../services/session-relay/src/broker.js";
export function fixtureStore() {
  let data: RelaySession = {
    id: "session1",
    version: 0,
    ttl: 10000,
    completed: false,
    snapshot: null,
    stopped: null,
    rateWindow: 0,
    rateCount: 0,
    grants: [
      {
        deviceId: "tv1",
        role: "tv",
        tokenHash: credentialHash("fictional-tv-credential"),
        expiresAt: 9000,
        revoked: false,
        sequence: -1,
        recentIds: [],
      },
      {
        deviceId: "phone1",
        role: "companion",
        tokenHash: credentialHash("fictional-phone-credential"),
        expiresAt: 9000,
        revoked: false,
        sequence: -1,
        recentIds: [],
      },
    ],
  };
  const bindings = new Map<string, string>();
  const store: RelayStore = {
    get: async (id) => (id === data.id ? structuredClone(data) : undefined),
    save: vi.fn(async (next, expected) => {
      if (expected !== data.version) return false;
      data = structuredClone(next);
      return true;
    }),
    bind: async (id, session) => {
      bindings.set(id, session);
    },
    lookup: async (id) => bindings.get(id),
    unbind: async (id) => {
      bindings.delete(id);
    },
  };
  const delivery = {
    post: vi.fn(async (connectionId: string, value: object) => {
      void connectionId;
      void value;
    }),
    disconnect: vi.fn(async () => {}),
  };
  const broker = new ObservationBroker(store, delivery, () => 100);
  const mutate = (change: (value: RelaySession) => void) => {
    change(data);
    data.version++;
  };
  return { store, delivery, broker, data: () => structuredClone(data), mutate };
}
export function wire(
  device: string,
  type: string,
  sequence: number,
  payload: object,
  messageId = `msg_${device}_${sequence}`,
): string {
  return JSON.stringify({
    schema_version: 1,
    message_id: messageId,
    session_id: "session1",
    device_id: device,
    sequence,
    sent_at: "2026-10-24T10:00:00Z",
    type,
    payload,
  });
}
export async function pair(f: ReturnType<typeof fixtureStore>) {
  await f.broker.receive(
    "tvconnection",
    wire("tv1", "session.hello", 0, {
      credential: "fictional-tv-credential",
      last_acknowledged_sequence: -1,
    }),
  );
  await f.broker.receive(
    "phoneconnection",
    wire("phone1", "session.hello", 0, {
      credential: "fictional-phone-credential",
      last_acknowledged_sequence: -1,
    }),
  );
}

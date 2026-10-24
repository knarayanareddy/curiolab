import { createHash, randomUUID } from "node:crypto";
import {
  parseRelayMessage as checkRelayMessage,
  type RelayMessage,
} from "../../../packages/session-contracts/src/relay-client.js";
import {
  exactKeys as checkExactKeys,
  validateSnapshot as checkSnapshot,
  type CommittedSnapshot,
} from "../../../packages/session-contracts/src/session-state.js";
export type DeviceRole = "tv" | "companion";
export interface Grant {
  deviceId: string;
  role: DeviceRole;
  tokenHash: string;
  expiresAt: number;
  revoked: boolean;
  connectionId?: string;
  sequence: number;
  recentIds: string[];
}
export interface RelaySession {
  id: string;
  version: number;
  ttl: number;
  completed: boolean;
  grants: Grant[];
  snapshot: CommittedSnapshot | null;
  stopped: RelayMessage | null;
  rateWindow: number;
  rateCount: number;
  hintWindow?: number;
  hintCount?: number;
}
export interface RelayStore {
  get(sessionId: string): Promise<RelaySession | undefined>;
  save(value: RelaySession, expectedVersion: number): Promise<boolean>;
  bind(connectionId: string, sessionId: string, ttl: number): Promise<void>;
  lookup(connectionId: string): Promise<string | undefined>;
  unbind(connectionId: string): Promise<void>;
}
export interface RelayDelivery {
  post(connectionId: string, value: object): Promise<void>;
  disconnect(connectionId: string): Promise<void>;
}
export const credentialHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class BrokerError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "unauthorized"
      | "stale"
      | "rate_limited"
      | "unavailable",
  ) {
    super(code);
  }
}
function exactKeys(
  value: unknown,
  required: string[],
  optional: string[] = [],
): asserts value is Record<string, unknown> {
  try {
    checkExactKeys(value, required, optional);
  } catch {
    throw new BrokerError("invalid");
  }
}
function validateSnapshot(value: unknown): asserts value is CommittedSnapshot {
  try {
    checkSnapshot(value);
  } catch {
    throw new BrokerError("invalid");
  }
}
function parseRelayMessage(body: string, sessionId: string): RelayMessage {
  try {
    return checkRelayMessage(body, sessionId);
  } catch {
    throw new BrokerError("invalid");
  }
}
export function authorize(
  session: RelaySession | undefined,
  deviceId: string,
  token: string,
  now: number,
): Grant {
  if (
    !session ||
    session.completed ||
    session.ttl <= now ||
    typeof token !== "string" ||
    token.length < 16 ||
    token.length > 512
  )
    throw new BrokerError("unauthorized");
  const grant = session.grants.find(
    (g) =>
      g.deviceId === deviceId &&
      g.tokenHash === credentialHash(token) &&
      !g.revoked &&
      g.expiresAt > now,
  );
  if (!grant) throw new BrokerError("unauthorized");
  return grant;
}
function envelope(body: string) {
  if (Buffer.byteLength(body) > 16384) throw new BrokerError("invalid");
  const value = JSON.parse(body) as Record<string, unknown>;
  exactKeys(value, [
    "schema_version",
    "message_id",
    "session_id",
    "device_id",
    "sequence",
    "sent_at",
    "type",
    "payload",
  ]);
  if (
    value.schema_version !== 1 ||
    ![value.message_id, value.session_id, value.device_id].every(
      (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id),
    ) ||
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 0 ||
    typeof value.sent_at !== "string" ||
    !Number.isFinite(Date.parse(value.sent_at))
  )
    throw new BrokerError("invalid");
  return value as unknown as RelayMessage;
}
/** Durable CAS protects scope, cursor, snapshot and last adult stop across concurrent Lambdas. */
export class ObservationBroker {
  constructor(
    private readonly store: RelayStore,
    private readonly delivery: RelayDelivery,
    private readonly now = () => Math.floor(Date.now() / 1000),
  ) {}
  async receive(connectionId: string, body: string): Promise<void> {
    let message: RelayMessage;
    try {
      message = envelope(body);
    } catch {
      throw new BrokerError("invalid");
    }
    const hello = String(message.type) === "session.hello";
    let token = "";
    if (hello) {
      exactKeys(message.payload, ["credential", "last_acknowledged_sequence"]);
      if (
        typeof message.payload.credential !== "string" ||
        !Number.isSafeInteger(message.payload.last_acknowledged_sequence) ||
        Number(message.payload.last_acknowledged_sequence) < -1
      )
        throw new BrokerError("invalid");
      token = message.payload.credential;
    } else if ((await this.store.lookup(connectionId)) !== message.session_id)
      throw new BrokerError("unauthorized");
    for (let attempt = 0; attempt < 3; attempt++) {
      const stored = await this.store.get(message.session_id);
      if (!stored) throw new BrokerError("unauthorized");
      const session = structuredClone(stored);
      const grant = hello
        ? authorize(session, message.device_id, token, this.now())
        : session.grants.find(
            (g) =>
              g.deviceId === message.device_id &&
              g.connectionId === connectionId &&
              !g.revoked &&
              g.expiresAt > this.now(),
          );
      if (!grant || session.completed || session.ttl <= this.now())
        throw new BrokerError("unauthorized");
      // Application rate cap is durable; API Gateway independently throttles ingress.
      if (session.rateWindow !== this.now()) {
        session.rateWindow = this.now();
        session.rateCount = 0;
      }
      if (++session.rateCount > 40) throw new BrokerError("rate_limited");
      let outbound: object | undefined;
      if (hello) {
        grant.connectionId = connectionId;
      } else {
        if (grant.recentIds.includes(message.message_id)) return;
        if (message.sequence <= grant.sequence) throw new BrokerError("stale");
        if (String(message.type) === "state.snapshot") {
          if (grant.role !== "tv") throw new BrokerError("unauthorized");
          exactKeys(message.payload, ["state", "expected_state_sequence"]);
          validateSnapshot(message.payload.state);
          const current = session.snapshot;
          if (
            message.payload.expected_state_sequence !==
              (current?.state_sequence ?? -1) ||
            message.payload.state.state_sequence <=
              (current?.state_sequence ?? -1)
          )
            throw new BrokerError("stale");
          // Existing predictions/measurements are immutable; new confirmed values originate only on TV.
          for (const field of ["predictions", "measurements"] as const) {
            for (const [key, value] of Object.entries(current?.[field] ?? {}))
              if (
                (message.payload.state[field] as Record<string, unknown>)[
                  key
                ] !== value
              )
                throw new BrokerError("invalid");
          }
          session.snapshot = message.payload.state;
          session.stopped = null;
          outbound = message;
        } else {
          if (grant.role !== "companion") throw new BrokerError("unauthorized");
          if (String(message.type) === "voice.transcript") {
            exactKeys(message.payload, [
              "transcript",
              "confidence",
              "push_to_talk_session",
            ]);
            const p = message.payload;
            if (
              typeof p.transcript !== "string" ||
              p.transcript.length > 160 ||
              typeof p.confidence !== "number" ||
              !Number.isFinite(p.confidence) ||
              p.confidence < 0 ||
              p.confidence > 1 ||
              typeof p.push_to_talk_session !== "string" ||
              !/^[A-Za-z0-9_-]{1,80}$/.test(p.push_to_talk_session)
            )
              throw new BrokerError("invalid");
          } else {
            parseRelayMessage(body, session.id);
            if (
              !["observation.candidate", "observation.stopped"].includes(
                message.type,
              )
            )
              throw new BrokerError("invalid");
          }
          if (message.type === "observation.stopped") session.stopped = message;
          outbound = message;
        }
        grant.sequence = message.sequence;
        grant.recentIds = [...grant.recentIds.slice(-63), message.message_id];
      }
      session.version++;
      if (!(await this.store.save(session, stored.version))) continue;
      if (hello) {
        await this.store.bind(
          connectionId,
          session.id,
          Math.min(grant.expiresAt, session.ttl),
        );
        await this.delivery.post(connectionId, {
          schema_version: 1,
          message_id: randomUUID(),
          session_id: session.id,
          device_id: "relay",
          sequence: session.version,
          sent_at: new Date(this.now() * 1000).toISOString(),
          type: "session.hello",
          payload: {
            resume_sequence: grant.sequence,
            snapshot: session.snapshot,
            stopped: session.stopped,
          },
        });
      } else if (outbound) {
        const peer = session.grants.find(
          (g) =>
            g.role !== grant.role && !g.revoked && g.expiresAt > this.now(),
        );
        if (peer?.connectionId) {
          try {
            await this.delivery.post(peer.connectionId, outbound);
          } catch {
            throw new BrokerError("unavailable");
          }
        }
      }
      return;
    }
    throw new BrokerError("unavailable");
  }
  async disconnected(connectionId: string): Promise<void> {
    // Stale connections cannot act even if a reconnect's binding has replaced them.
    await this.store.unbind(connectionId);
  }
}

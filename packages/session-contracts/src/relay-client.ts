import { exactKeys, validateSnapshot } from "./session-state.js";
export interface RelaySocket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}
export interface RelayMessage {
  schema_version: 1;
  message_id: string;
  session_id: string;
  device_id: string;
  sequence: number;
  sent_at: string;
  type:
    | "observation.candidate"
    | "observation.stopped"
    | "session.error"
    | "session.hello"
    | "state.snapshot"
    | "voice.transcript";
  payload: Record<string, unknown>;
}
export type RelayStatus =
  | "offline"
  | "connecting"
  | "connected"
  | "denied"
  | "invalid_message";
const safeId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export function parseRelayMessage(
  data: unknown,
  sessionId: string,
): RelayMessage {
  if (typeof data !== "string" || new TextEncoder().encode(data).length > 16384)
    throw new Error("invalid_message_size");
  const value = JSON.parse(data) as RelayMessage;
  const keys = [
    "schema_version",
    "message_id",
    "session_id",
    "device_id",
    "sequence",
    "sent_at",
    "type",
    "payload",
  ];
  if (
    !value ||
    Object.keys(value).sort().join() !== keys.sort().join() ||
    value.schema_version !== 1 ||
    value.session_id !== sessionId ||
    !safeId(value.message_id) ||
    !safeId(value.device_id) ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 0 ||
    typeof value.sent_at !== "string" ||
    !Number.isFinite(Date.parse(value.sent_at)) ||
    !value.payload ||
    typeof value.payload !== "object"
  )
    throw new Error("invalid_message");
  const p = value.payload;
  const count = (n: unknown) =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 30;
  let fields: string[];
  if (value.type === "session.hello") {
    exactKeys(p, ["resume_sequence", "snapshot", "stopped"]);
    if (
      !Number.isSafeInteger(p.resume_sequence) ||
      Number(p.resume_sequence) < -1
    )
      throw new Error("invalid_resume");
    if (p.snapshot !== null) validateSnapshot(p.snapshot);
    if (p.stopped !== null) {
      const stopped = parseRelayMessage(JSON.stringify(p.stopped), sessionId);
      if (stopped.type !== "observation.stopped")
        throw new Error("invalid_resume_stop");
    }
    return value;
  } else if (value.type === "state.snapshot") {
    exactKeys(p, ["state", "expected_state_sequence"]);
    validateSnapshot(p.state);
    if (
      !Number.isSafeInteger(p.expected_state_sequence) ||
      Number(p.expected_state_sequence) < -1
    )
      throw new Error("invalid_snapshot_sequence");
    return value;
  } else if (value.type === "voice.transcript") {
    exactKeys(p, ["transcript", "confidence", "push_to_talk_session"]);
    if (
      typeof p.transcript !== "string" ||
      p.transcript.length > 160 ||
      typeof p.confidence !== "number" ||
      !Number.isFinite(p.confidence) ||
      p.confidence < 0 ||
      p.confidence > 1 ||
      !safeId(p.push_to_talk_session)
    )
      throw new Error("invalid_transcript");
    return value;
  } else if (value.type === "session.error") {
    fields = ["code", "recoverable"];
    if (
      !["unauthorized", "expired", "revoked", "unavailable"].includes(
        String(p.code),
      ) ||
      typeof p.recoverable !== "boolean"
    )
      throw new Error("invalid_error");
  } else {
    if (
      !["flat", "folded"].includes(String(p.trial)) ||
      typeof p.confidence !== "number" ||
      !Number.isFinite(p.confidence) ||
      p.confidence < 0 ||
      p.confidence > 1
    )
      throw new Error("invalid_observation");
    if (value.type === "observation.candidate") {
      fields = [
        "trial",
        "observed_count",
        "confidence",
        "calibration",
        "frame_sequence",
      ];
      if (
        !count(p.observed_count) ||
        !["calibrated", "needs_calibration", "needs_review"].includes(
          String(p.calibration),
        ) ||
        !Number.isSafeInteger(p.frame_sequence) ||
        Number(p.frame_sequence) < 0
      )
        throw new Error("invalid_candidate");
    } else if (value.type === "observation.stopped") {
      fields = ["trial", "last_stable_count", "confidence", "stop_reason"];
      if (!count(p.last_stable_count) || p.stop_reason !== "adult_marked_stop")
        throw new Error("invalid_stop");
    } else throw new Error("unsupported_message");
  }
  if (Object.keys(p).sort().join() !== fields.sort().join())
    throw new Error("unexpected_payload_fields");
  return value;
}

/** Scoped application credential only; AWS keys are never accepted by this interface. */
export class WebSocketRelayClient {
  status: RelayStatus = "offline";
  private socket: RelaySocket | undefined;
  private readonly received = new Map<string, number>();
  private sequence = 0;
  private scopeId = "";
  private sendScope: { sessionId: string; deviceId: string } | undefined;
  private authenticated = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly seen = new Set<string>();
  constructor(
    private readonly createSocket: (url: string) => RelaySocket,
    private readonly onObservation: (message: RelayMessage) => void,
    private readonly now: () => Date = () => new Date(),
    private readonly id: () => string = () => crypto.randomUUID(),
    private readonly connectTimeoutMs = 5000,
  ) {
    if (!Number.isFinite(connectTimeoutMs) || connectTimeoutMs <= 0)
      throw new Error("invalid_connect_timeout");
  }
  connect(
    url: string,
    scope: { sessionId: string; deviceId: string; credential: string },
  ): void {
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== "wss:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      !safeId(scope.sessionId) ||
      !safeId(scope.deviceId) ||
      scope.credential.length < 16 ||
      scope.credential.length > 512
    )
      throw new Error("invalid_relay_configuration");
    this.disconnect();
    if (this.scopeId !== scope.sessionId) {
      this.received.clear();
      this.seen.clear();
      this.sequence = 0;
    }
    this.scopeId = scope.sessionId;
    this.sendScope = { sessionId: scope.sessionId, deviceId: scope.deviceId };
    this.status = "connecting";
    const socket = this.createSocket(endpoint.href);
    this.socket = socket;
    this.timer = setTimeout(() => {
      if (this.socket === socket) this.disconnect();
    }, this.connectTimeoutMs);
    const active = () => this.socket === socket;
    socket.onopen = () => {
      if (!active()) return;
      clearTimeout(this.timer);
      socket.send(
        JSON.stringify({
          schema_version: 1,
          message_id: this.id(),
          session_id: scope.sessionId,
          device_id: scope.deviceId,
          sequence: this.sequence++,
          sent_at: this.now().toISOString(),
          type: "session.hello",
          payload: {
            credential: scope.credential,
            last_acknowledged_sequence: Math.max(-1, ...this.received.values()),
          },
        }),
      );
      this.status = "connected";
    };
    socket.onmessage = (event) => {
      if (!active()) return;
      try {
        const message = parseRelayMessage(event.data, scope.sessionId);
        if (this.seen.has(message.message_id)) return;
        if (message.type === "session.hello") {
          this.authenticated = true;
          this.sequence = Math.max(
            this.sequence,
            Number(message.payload.resume_sequence) + 1,
          );
        }
        const sender = `${scope.sessionId}:${message.device_id}`;
        if (message.sequence <= (this.received.get(sender) ?? -1)) return;
        if (this.received.size >= 3 && !this.received.has(sender))
          throw new Error("unexpected_sender");
        this.received.set(sender, message.sequence);
        this.seen.add(message.message_id);
        if (this.seen.size > 256)
          this.seen.delete(this.seen.values().next().value!);
        if (message.type === "session.error") {
          this.disconnect();
          this.status =
            message.payload.code === "unavailable" ? "offline" : "denied";
        } else this.onObservation(message);
      } catch {
        this.status = "invalid_message";
      }
    };
    socket.onclose = socket.onerror = () => {
      if (active()) {
        clearTimeout(this.timer);
        this.authenticated = false;
        this.sendScope = undefined;
        this.socket = undefined;
        this.status = "offline";
        socket.close();
      }
    };
  }
  send(
    type:
      | "observation.candidate"
      | "observation.stopped"
      | "state.snapshot"
      | "voice.transcript",
    payload: Record<string, unknown>,
  ): void {
    if (
      !this.socket ||
      !this.sendScope ||
      !this.authenticated ||
      this.status !== "connected"
    )
      throw new Error("relay_not_authenticated");
    const message = {
      schema_version: 1,
      message_id: this.id(),
      session_id: this.sendScope.sessionId,
      device_id: this.sendScope.deviceId,
      sequence: this.sequence,
      sent_at: this.now().toISOString(),
      type,
      payload,
    };
    const bytes = JSON.stringify(message);
    parseRelayMessage(bytes, this.sendScope.sessionId);
    this.socket.send(bytes);
    this.sequence++;
  }
  disconnect(): void {
    this.authenticated = false;
    this.sendScope = undefined;
    clearTimeout(this.timer);
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
    this.status = "offline";
  }
}

/** Thin browser adapter; credentials travel only in session.hello after WSS opens. */
export function browserRelaySocket(url: string): RelaySocket {
  const native = new WebSocket(url);
  const adapter: RelaySocket = {
    send: (data) => native.send(data),
    close: () => native.close(),
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };
  native.addEventListener("open", () => adapter.onopen?.());
  native.addEventListener("close", () => adapter.onclose?.());
  native.addEventListener("error", () => adapter.onerror?.());
  native.addEventListener("message", (event) =>
    adapter.onmessage?.({ data: event.data }),
  );
  return adapter;
}

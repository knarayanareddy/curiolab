import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type { SimulatorState } from "../../../packages/session-contracts/src/simulator-state.js";
import { committedRelaySnapshot } from "./companion-input.js";
/** Local-only network adapter. In Compose, browser calls stay same-origin; container DNS stays server-side. */
export class LocalServices {
  private readonly sessions = new Map<
    string,
    {
      tv: WebSocket;
      phone: WebSocket;
      token: string;
      sequence: number;
      tvSequence: number;
      phoneSequence: number;
      confidence: number;
    }
  >();
  title = "";
  status = "connecting";
  constructor(
    private readonly relay: string,
    private readonly content: string,
  ) {}
  async ready() {
    const [relay, content] = await Promise.all([
      fetch(`${this.relay}/health`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${this.content}/episode.json`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    if (!relay.ok || !content.ok) throw new Error("local_services_unavailable");
    const episode = await content.json();
    if (
      typeof episode.title !== "string" ||
      episode.content_version !== "0.1.0"
    )
      throw new Error("invalid_draft_content");
    this.title = episode.title;
    this.status = "ready";
  }
  private async connect(id: string, device: string, token: string) {
    const socket = new WebSocket(`${this.relay.replace(/^http/, "ws")}/relay`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error("relay_timeout"));
      }, 5000);
      socket.once("open", () =>
        socket.send(
          JSON.stringify(
            this.message(id, device, 0, "session.hello", {
              credential: token,
              last_acknowledged_sequence: -1,
            }),
          ),
        ),
      );
      socket.once("message", (data) => {
        clearTimeout(timer);
        try {
          if (JSON.parse(data.toString()).type !== "session.hello")
            throw new Error();
          resolve();
        } catch {
          socket.terminate();
          reject(new Error("relay_denied"));
        }
      });
      socket.on("error", () => {
        clearTimeout(timer);
        reject(new Error("relay_unavailable"));
      });
    });
    return socket;
  }
  private message(
    session: string,
    device: string,
    sequence: number,
    type: string,
    payload: object,
  ) {
    return {
      schema_version: 1,
      message_id: randomUUID(),
      session_id: session,
      device_id: device,
      sequence,
      sent_at: new Date().toISOString(),
      type,
      payload,
    };
  }
  async publish(
    id: string,
    state: SimulatorState,
    command: string,
    args: string[],
  ) {
    if (
      state.stage === "SAFETY_AND_CONSENT" ||
      (state.stage === "COMPLETE" && !this.sessions.has(id))
    )
      return;
    let session = this.sessions.get(id);
    if (!session) {
      const response = await fetch(`${this.relay}/fixture/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: id }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("fixture_session_unavailable");
      const tokens = await response.json();
      const tv = await this.connect(id, "tv", tokens.tv);
      try {
        const phone = await this.connect(id, "phone", tokens.phone);
        session = {
          tv,
          phone,
          token: tokens.tv,
          sequence: -1,
          tvSequence: 0,
          phoneSequence: 0,
          confidence: 0,
        };
        this.sessions.set(id, session);
      } catch (error) {
        tv.close();
        throw error;
      }
    }
    const send = async (
      device: "tv" | "phone",
      type: string,
      payload: object,
    ) => {
      const sequence =
        device === "tv" ? ++session.tvSequence : ++session.phoneSequence;
      const message = this.message(id, device, sequence, type, payload);
      const peer = device === "tv" ? session.phone : session.tv;
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          peer.off("message", receive);
          peer.off("close", closed);
        };
        const receive = (bytes: Buffer) => {
          if (JSON.parse(bytes.toString()).message_id === message.message_id) {
            cleanup();
            resolve();
          }
        };
        const closed = () => {
          cleanup();
          reject(new Error("relay_closed"));
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("relay_timeout"));
        }, 5000);
        peer.on("message", receive);
        peer.once("close", closed);
        session[device].send(JSON.stringify(message));
      });
    };
    if (command === "observe") session.confidence = Number(args[3]);
    if (command === "observe")
      await send("phone", "observation.candidate", {
        trial: args[0]!.toLowerCase(),
        observed_count: state.observed,
        confidence: Number(args[3]),
        calibration:
          state.perception === "NEEDS_CALIBRATION"
            ? "needs_calibration"
            : state.perception === "NEEDS_REVIEW"
              ? "needs_review"
              : "calibrated",
        frame_sequence: Number(args[1]),
      });
    if (command === "stop")
      await send("phone", "observation.stopped", {
        trial: args[0]!.toLowerCase(),
        last_stable_count: state.stopped,
        confidence: session.confidence,
        stop_reason: "adult_marked_stop",
      });
    if (state.sequence > session.sequence) {
      await send("tv", "state.snapshot", {
        state: committedRelaySnapshot(state),
        expected_state_sequence: session.sequence,
      });
      session.sequence = state.sequence;
    }
    this.status = "ready";
    if (state.stage === "COMPLETE") await this.clear(id);
  }
  async clear(id: string) {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    session.tv.close();
    session.phone.close();
    await fetch(`${this.relay}/fixture/sessions/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(5000),
    });
  }
  close() {
    for (const session of this.sessions.values()) {
      session.tv.terminate();
      session.phone.terminate();
    }
    this.sessions.clear();
  }
}

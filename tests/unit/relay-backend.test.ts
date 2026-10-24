import { describe, it, expect, vi } from "vitest";
import {
  fixtureStore,
  wire,
  pair,
} from "../../packages/testkit/src/backend-fixture.js";
const candidate = {
  trial: "flat",
  observed_count: 5,
  confidence: 0.9,
  calibration: "calibrated",
  frame_sequence: 1,
};
export const committed = {
  current_node_id: "node_flat_lab",
  content_version: "0.1.0",
  state_sequence: 1,
  predictions: { flat_winner: "unsure" },
  measurements: {},
};
describe("durable scoped observation broker (local fixtures)", () => {
  it("authenticates hello, relays transient candidates only to TV and rejects duplicates/stale messages", async () => {
    const f = fixtureStore();
    await pair(f);
    await f.broker.receive(
      "phoneconnection",
      wire("phone1", "observation.candidate", 1, candidate),
    );
    expect(f.delivery.post).toHaveBeenLastCalledWith(
      "tvconnection",
      expect.objectContaining({ type: "observation.candidate" }),
    );
    expect(f.data().snapshot).toBeNull();
    expect(f.data().stopped).toBeNull();
    const calls = f.delivery.post.mock.calls.length;
    await f.broker.receive(
      "phoneconnection",
      wire("phone1", "observation.candidate", 1, candidate),
    );
    expect(f.delivery.post).toHaveBeenCalledTimes(calls);
    await expect(
      f.broker.receive(
        "phoneconnection",
        wire("phone1", "observation.candidate", 0, candidate),
      ),
    ).rejects.toThrow("stale");
  });
  it("persists adult stops for reconnect and hydrates snapshot/resume offsets without committing a count", async () => {
    const f = fixtureStore();
    await pair(f);
    await f.broker.receive(
      "phoneconnection",
      wire("phone1", "observation.stopped", 1, {
        trial: "flat",
        last_stable_count: 5,
        confidence: 0.9,
        stop_reason: "adult_marked_stop",
      }),
    );
    expect(f.data().snapshot).toBeNull();
    expect(f.data().stopped).not.toBeNull();
    await f.broker.receive(
      "tvreplacement",
      wire("tv1", "session.hello", 0, {
        credential: "fictional-tv-credential",
        last_acknowledged_sequence: -1,
      }),
    );
    expect(f.delivery.post).toHaveBeenLastCalledWith(
      "tvreplacement",
      expect.objectContaining({
        payload: expect.objectContaining({
          stopped: expect.objectContaining({ type: "observation.stopped" }),
        }),
      }),
    );
    await expect(
      f.broker.receive(
        "tvconnection",
        wire("tv1", "state.snapshot", 1, {
          state: committed,
          expected_state_sequence: -1,
        }),
      ),
    ).rejects.toThrow("unauthorized");
    await f.broker.receive(
      "tvreplacement",
      wire("tv1", "state.snapshot", 1, {
        state: committed,
        expected_state_sequence: -1,
      }),
    );
    expect(f.data().snapshot).toEqual(committed);
    await f.broker.disconnected("tvconnection");
    expect(await f.store.lookup("tvreplacement")).toBe("session1");
  });
  it("rejects media, oversized data, forged identities, cross-session access and wrong sender roles", async () => {
    const f = fixtureStore();
    await pair(f);
    for (const body of [
      "x".repeat(16385),
      "not JSON",
      wire("phone1", "observation.candidate", 1, {
        ...candidate,
        raw_frame: "secret",
      }),
      wire("tv1", "observation.candidate", 1, candidate),
      wire("phone1", "state.snapshot", 1, {
        state: committed,
        expected_state_sequence: -1,
      }),
    ]) {
      await expect(f.broker.receive("phoneconnection", body)).rejects.toThrow();
    }
    await expect(
      f.broker.receive(
        "phoneconnection",
        wire("phone1", "observation.candidate", 1, candidate).replace(
          "session1",
          "another",
        ),
      ),
    ).rejects.toThrow("unauthorized");
    expect(f.data().grants[1]?.sequence).toBe(-1);
  });
  it.each(["expired", "revoked", "completed"])(
    "blocks %s credentials on every event",
    async (mode) => {
      const f = fixtureStore();
      await pair(f);
      f.mutate((data) => {
        if (mode === "expired") data.grants[1]!.expiresAt = 99;
        if (mode === "revoked") data.grants[1]!.revoked = true;
        if (mode === "completed") data.completed = true;
      });
      await expect(
        f.broker.receive(
          "phoneconnection",
          wire("phone1", "observation.candidate", 1, candidate),
        ),
      ).rejects.toThrow("unauthorized");
    },
  );
  it("denies bad hello secrets and stale snapshot overwrite", async () => {
    const f = fixtureStore();
    await expect(
      f.broker.receive(
        "conn",
        wire("phone1", "session.hello", 0, {
          credential: "wrong-secret-but-long",
          last_acknowledged_sequence: -1,
        }),
      ),
    ).rejects.toThrow("unauthorized");
    await pair(f);
    await f.broker.receive(
      "tvconnection",
      wire("tv1", "state.snapshot", 1, {
        state: committed,
        expected_state_sequence: -1,
      }),
    );
    await expect(
      f.broker.receive(
        "tvconnection",
        wire("tv1", "state.snapshot", 2, {
          state: {
            ...committed,
            state_sequence: 2,
            predictions: { flat_winner: "folded" },
          },
          expected_state_sequence: 1,
        }),
      ),
    ).rejects.toThrow("invalid");
    await expect(
      f.broker.receive(
        "tvconnection",
        wire("tv1", "state.snapshot", 2, {
          state: { ...committed, state_sequence: 2 },
          expected_state_sequence: 0,
        }),
      ),
    ).rejects.toThrow("stale");
  });
  it("bounds CAS contention, rate limits and preserves a stopped observation after delivery failure", async () => {
    const f = fixtureStore();
    await pair(f);
    f.delivery.post.mockRejectedValueOnce(new Error("GoneException"));
    await expect(
      f.broker.receive(
        "phoneconnection",
        wire("phone1", "observation.stopped", 1, {
          trial: "flat",
          last_stable_count: 4,
          confidence: 0.9,
          stop_reason: "adult_marked_stop",
        }),
      ),
    ).rejects.toThrow("unavailable");
    expect(f.data().stopped?.payload.last_stable_count).toBe(4);
    f.mutate((data) => {
      data.rateWindow = 100;
      data.rateCount = 40;
    });
    await expect(
      f.broker.receive(
        "phoneconnection",
        wire("phone1", "observation.candidate", 2, candidate),
      ),
    ).rejects.toThrow("rate_limited");
    f.mutate((data) => {
      data.rateCount = 0;
    });
    vi.mocked(f.store.save).mockResolvedValue(false);
    await expect(
      f.broker.receive(
        "phoneconnection",
        wire("phone1", "observation.candidate", 2, candidate),
      ),
    ).rejects.toThrow("unavailable");
  });
});
it("routes final transcript text transiently without persisting it; rejects audio fields", async () => {
  const f = fixtureStore();
  await pair(f);
  await f.broker.receive(
    "phoneconnection",
    wire("phone1", "voice.transcript", 1, {
      transcript: "more coins",
      confidence: 0.9,
      push_to_talk_session: "ptt1",
    }),
  );
  expect(f.delivery.post).toHaveBeenLastCalledWith(
    "tvconnection",
    expect.objectContaining({ type: "voice.transcript" }),
  );
  expect(JSON.stringify(f.data())).not.toContain("more coins");
  await expect(
    f.broker.receive(
      "phoneconnection",
      wire("phone1", "voice.transcript", 2, {
        transcript: "more",
        confidence: 0.9,
        push_to_talk_session: "ptt1",
        audio: "private",
      }),
    ),
  ).rejects.toThrow();
});

import { expect, it } from "vitest";
import {
  PushToTalk,
  FLAT_VOICE_OPTIONS,
  FOLDED_VOICE_OPTIONS,
  browserRemoteIntent,
} from "../../packages/voice/src/push-to-talk.js";
it("records only while held and visible, maps current options once, then discards the session", () => {
  let now = 100;
  const ptt = new PushToTalk(
    () => now,
    () => "ptt1",
  );
  expect(ptt.press(false, true)).toBeUndefined();
  expect(ptt.press(true, false)).toBeUndefined();
  expect(ptt.press(true, true)).toBe("ptt1");
  expect(ptt.canCapture(true)).toBe(true);
  now += 100;
  ptt.release();
  expect(ptt.state).toBe("awaiting_transcript");
  expect(
    ptt.mapFinal(
      {
        transcript: "The folded one!",
        confidence: 0.9,
        push_to_talk_session: "ptt1",
      },
      true,
      FLAT_VOICE_OPTIONS,
    ),
  ).toBe("folded");
  expect(ptt.state).toBe("idle");
  expect(
    ptt.mapFinal(
      { transcript: "more", confidence: 1, push_to_talk_session: "ptt1" },
      true,
      FOLDED_VOICE_OPTIONS,
    ),
  ).toBeUndefined();
});
it.each([
  "ambiguous",
  "confidence",
  "mismatch",
  "wrong_node",
  "expired",
  "partial",
])("leaves prediction unchanged for %s speech", (mode) => {
  let now = 0;
  const ptt = new PushToTalk(
    () => now,
    () => "ptt1",
  );
  ptt.press(true, true);
  now = 100;
  ptt.release();
  if (mode === "expired") now += 5001;
  expect(
    ptt.mapFinal(
      {
        transcript:
          mode === "ambiguous"
            ? "more or fewer"
            : mode === "wrong_node"
              ? "folded"
              : "more",
        confidence: mode === "confidence" ? 0.84 : 0.9,
        push_to_talk_session: mode === "mismatch" ? "other" : "ptt1",
      },
      mode !== "partial",
      FOLDED_VOICE_OPTIONS,
    ),
  ).toBeUndefined();
  expect(ptt.state).toBe("idle");
});
it("cancels on background, hold timeout or cancellation; no microphone key interception", () => {
  let now = 0;
  const ptt = new PushToTalk(() => now);
  ptt.press(true, true);
  expect(ptt.canCapture(false)).toBe(false);
  ptt.press(true, true);
  now = 10000;
  expect(ptt.canCapture(true)).toBe(false);
  expect(browserRemoteIntent("ArrowLeft", true)).toBe("left");
  expect(browserRemoteIntent("Enter", true)).toBeUndefined();
  expect(browserRemoteIntent("Escape")).toBe("back");
  expect(browserRemoteIntent("Microphone")).toBeUndefined();
});

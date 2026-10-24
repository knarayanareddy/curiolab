export type PushToTalkState = "idle" | "recording" | "awaiting_transcript";
export interface TranscriptIntent {
  transcript: string;
  confidence: number;
  push_to_talk_session: string;
}
/** Companion lifecycle policy; native audio/Transcribe remain separate adapters. No buffers/text stored. */
export class PushToTalk {
  state: PushToTalkState = "idle";
  private session: string | undefined;
  private startedAt = 0;
  private releasedAt = 0;
  constructor(
    private readonly now = () => Date.now(),
    private readonly id: () => string = () => crypto.randomUUID(),
  ) {}
  press(permissionGranted: boolean, isVisible: boolean): string | undefined {
    if (!permissionGranted || !isVisible || this.state !== "idle")
      return undefined;
    this.session = this.id();
    this.startedAt = this.now();
    this.state = "recording";
    return this.session;
  }
  /** Native adapter must call on lifecycle/timer ticks and stop capture if false. */
  canCapture(isVisible: boolean): boolean {
    if (
      this.state !== "recording" ||
      !isVisible ||
      this.now() < this.startedAt ||
      this.now() - this.startedAt >= 10000
    ) {
      this.cancel();
      return false;
    }
    return true;
  }
  release(): void {
    if (this.state !== "recording") return;
    if (!this.canCapture(true)) return;
    this.state = "awaiting_transcript";
    this.releasedAt = this.now();
  }
  mapFinal(
    input: TranscriptIntent,
    isFinal: boolean,
    allowed: Readonly<Record<string, string>>,
  ): string | undefined {
    try {
      if (
        this.state !== "awaiting_transcript" ||
        this.now() < this.releasedAt ||
        this.now() - this.releasedAt > 5000 ||
        !isFinal ||
        input.push_to_talk_session !== this.session ||
        !Number.isFinite(input.confidence) ||
        input.confidence < 0.85 ||
        input.confidence > 1 ||
        typeof input.transcript !== "string" ||
        input.transcript.length > 160 ||
        /[\p{Cc}\p{Cf}]/u.test(input.transcript)
      )
        return undefined;
      const normalized = input.transcript
        .toLowerCase()
        .trim()
        .replace(/[.!?]$/, "")
        .replace(/\s+/g, " ");
      return Object.hasOwn(allowed, normalized)
        ? allowed[normalized]
        : undefined;
    } finally {
      this.cancel();
    }
  }
  cancel(): void {
    this.session = undefined;
    this.state = "idle";
    this.startedAt = 0;
    this.releasedAt = 0;
  }
}
export const FLAT_VOICE_OPTIONS = Object.freeze({
  flat: "flat",
  "flat paper": "flat",
  "the flat one": "flat",
  folded: "folded",
  "folded paper": "folded",
  "the folded one": "folded",
  same: "same",
  "the same": "same",
  equal: "same",
  unsure: "unsure",
  "not sure": "unsure",
  "i don't know": "unsure",
});
export const FOLDED_VOICE_OPTIONS = Object.freeze({
  more: "more",
  "more coins": "more",
  fewer: "fewer",
  less: "fewer",
  "fewer coins": "fewer",
  same: "same",
  "the same": "same",
  equal: "same",
  unsure: "unsure",
  "not sure": "unsure",
  "i don't know": "unsure",
});
export function browserRemoteIntent(
  key: string,
  repeat = false,
): "up" | "down" | "left" | "right" | "select" | "back" | undefined {
  const options: Record<
    string,
    "up" | "down" | "left" | "right" | "select" | "back"
  > = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Enter: "select",
    Escape: "back",
    BrowserBack: "back",
  };
  const intent = Object.hasOwn(options, key) ? options[key] : undefined;
  return repeat && (intent === "select" || intent === "back")
    ? undefined
    : intent;
}

import { readBoundedJson } from "../../session-contracts/src/http-json.js";
export interface HintContext {
  nodeId: string;
  attempt: number;
  lastError?: "occluded" | "needs_calibration";
}
export interface HintResult {
  text: string;
  hintLevel: number;
  source: "authored" | "gateway";
  reason: "disabled" | "validated" | "unavailable";
}
export interface HintTransport {
  request(context: HintContext, signal: AbortSignal): Promise<unknown>;
}
export const AUTHORED_HINTS: Readonly<Record<string, string>> = Object.freeze({
  FLAT_PREDICTION:
    "What do you think will happen? Unsure is a useful prediction too.",
  FOLDED_PREDICTION:
    "Keep the supports, paper and coins the same. Only change the paper’s shape.",
  FLAT_LAB:
    "Add one coin at a time. Wait for it to settle before adding another.",
  FOLDED_LAB:
    "Use the same coins and support spacing. An adult can mark stop at any time.",
});
export const RECOVERY_HINTS = {
  occluded:
    "Move your hand away so all four markers are visible, then try one coin again.",
  needs_calibration:
    "Check that all four corner markers are visible, then try one coin again.",
} as const;
export class ModelGateway {
  constructor(
    private readonly transport?: HintTransport,
    private readonly budgetMs = 1500,
  ) {
    if (!Number.isFinite(budgetMs) || budgetMs <= 0 || budgetMs > 2000)
      throw new Error("invalid_hint_budget");
  }
  async hint(context: HintContext): Promise<HintResult> {
    if (
      !Object.hasOwn(AUTHORED_HINTS, context.nodeId) ||
      !Number.isInteger(context.attempt) ||
      context.attempt < 0 ||
      context.attempt > 100 ||
      (context.lastError !== undefined &&
        !Object.hasOwn(RECOVERY_HINTS, context.lastError))
    )
      throw new Error("invalid_hint_context");
    const approvedText = context.lastError
      ? RECOVERY_HINTS[context.lastError]
      : AUTHORED_HINTS[context.nodeId]!;
    const hintLevel = Math.min(3, context.attempt + 1);
    const fallback = (reason: "disabled" | "unavailable"): HintResult => ({
      text: approvedText,
      hintLevel,
      source: "authored",
      reason,
    });
    if (!this.transport) return fallback("disabled");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        this.transport.request({ ...context }, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("hint_timeout"));
          }, this.budgetMs);
        }),
      ]);
      if (
        !value ||
        typeof value !== "object" ||
        Object.keys(value).sort().join(",") !==
          "hint_id,hint_level,text,uses_fallback"
      )
        throw new Error("invalid_hint_schema");
      const output = value as {
        hint_id: unknown;
        hint_level: unknown;
        text: unknown;
        uses_fallback: unknown;
      };
      if (
        typeof output.hint_id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(output.hint_id) ||
        output.hint_level !== hintLevel ||
        typeof output.uses_fallback !== "boolean" ||
        typeof output.text !== "string" ||
        !output.text.trim() ||
        output.text.length > 240 ||
        output.text.trim().split(/\s+/).length < 5 ||
        output.text.trim().split(/\s+/).length > 45 ||
        // Until reviewed live-hint evaluation exists, only this node/error's vetted
        // text may pass. Models cannot introduce materials, actions or conclusions.
        output.text !== approvedText ||
        // Reject controls, bidi overrides and markup before any display or speech.
        // eslint-disable-next-line no-control-regex
        /[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(
          output.text,
        )
      )
        throw new Error("unsafe_hint");
      return {
        text: output.text.trim(),
        hintLevel,
        source: output.uses_fallback ? "authored" : "gateway",
        reason: "validated",
      };
    } catch {
      return fallback("unavailable");
    } finally {
      clearTimeout(timer);
    }
  }
}
/** Calls the shared application gateway, never Bedrock or browser AWS credentials. */
export class HttpHintTransport implements HintTransport {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async request(context: HintContext, signal: AbortSignal): Promise<unknown> {
    const response = await this.fetcher("/v1/hints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        node_id: `node_${context.nodeId.toLowerCase()}`,
        attempt_count: context.attempt,
        camera_mode: "manual_remote",
        ...(context.lastError ? { last_error: context.lastError } : {}),
      }),
      signal,
    });
    if (!response.ok) throw new Error("hint_gateway_unavailable");
    return readBoundedJson(response);
  }
}

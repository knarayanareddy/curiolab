import {
  ConverseCommand,
  type BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime";
import {
  AUTHORED_HINTS,
  RECOVERY_HINTS,
  type HintTransport,
  type HintContext,
} from "../../../packages/model-gateway/src/index.js";
/** Text-only Converse adapter. Model ID is deployment configuration, never user input. */
export class BedrockHintDirector implements HintTransport {
  constructor(
    private readonly client: Pick<BedrockRuntimeClient, "send">,
    private readonly modelId: string,
  ) {
    if (
      !modelId ||
      modelId.length > 2048 ||
      /canvas|image|video/i.test(modelId)
    )
      throw new Error("invalid_text_model");
  }
  async request(context: HintContext, signal: AbortSignal): Promise<unknown> {
    const text = context.lastError
      ? RECOVERY_HINTS[context.lastError]
      : AUTHORED_HINTS[context.nodeId];
    if (!text) throw new Error("invalid_hint_node");
    const result = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [
          {
            text: "CurioLab hint_generate.v1 / hint_v1. Return only the supplied JSON object. It is authored development hint text for the active node and recovery. Never add materials, actions, emotional inferences, results or scientific conclusions. Do not evaluate images, audio, children, or episode branches. No tools.",
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: JSON.stringify({
                  hint_id: `hint_${context.nodeId.toLowerCase()}_${context.attempt}`,
                  text,
                  hint_level: Math.min(3, context.attempt + 1),
                  uses_fallback: false,
                }),
              },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 180, temperature: 0 },
      }),
      { abortSignal: signal },
    );
    if (
      result.stopReason !== "end_turn" ||
      result.output?.message?.content?.length !== 1
    )
      throw new Error("invalid_model_response");
    const output = result.output.message.content[0]?.text;
    if (typeof output !== "string" || Buffer.byteLength(output) > 4096)
      throw new Error("invalid_model_text");
    return JSON.parse(output) as unknown;
  }
}

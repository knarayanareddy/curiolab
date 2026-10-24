import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  ModelGateway,
  type HintContext,
} from "../../../packages/model-gateway/src/index.js";
import { exactKeys } from "../../../packages/session-contracts/src/session-state.js";
import { authorize, type RelayStore } from "../../session-relay/src/broker.js";
import { DynamoRelayStore } from "../../session-relay/src/aws-adapters.js";
import { BedrockHintDirector } from "./bedrock-director.js";
interface HintHttpEvent {
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  requestContext?: { requestId?: string };
}
export function hintHandler(
  store: RelayStore,
  gateway: ModelGateway,
  now = () => Math.floor(Date.now() / 1000),
) {
  return async (event: HintHttpEvent) => {
    const start = Date.now();
    let statusCode = 200;
    let dependencyFailure = false;
    let body: object;
    try {
      const headers = Object.fromEntries(
        Object.entries(event.headers ?? {}).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      );
      const sessionId = headers["x-session-id"] ?? "";
      const deviceId = headers["x-device-id"] ?? "";
      const authorization = headers.authorization ?? "";
      if (
        !/^[a-zA-Z0-9_-]{1,80}$/.test(sessionId) ||
        !authorization.startsWith("Bearer ")
      )
        throw new Error("unauthorized");
      dependencyFailure = true;
      const session = await store.get(sessionId);
      dependencyFailure = false;
      const grant = authorize(session, deviceId, authorization.slice(7), now());
      if (grant.role !== "tv") throw new Error("unauthorized");
      if (
        event.isBase64Encoded ||
        typeof event.body !== "string" ||
        Buffer.byteLength(event.body) > 4096
      )
        throw new Error("invalid");
      const input = JSON.parse(event.body) as Record<string, unknown>;
      exactKeys(
        input,
        ["node_id", "attempt_count", "camera_mode"],
        ["last_error"],
      );
      if (
        !["manual_remote", "companion_cv"].includes(
          String(input.camera_mode),
        ) ||
        typeof input.node_id !== "string" ||
        !/^node_(flat|folded)_(prediction|lab)$/.test(input.node_id)
      )
        throw new Error("invalid");
      if (
        !Number.isInteger(input.attempt_count) ||
        Number(input.attempt_count) < 0 ||
        Number(input.attempt_count) > 100
      )
        throw new Error("invalid");
      const stateNode = session?.snapshot?.current_node_id;
      if (!stateNode || stateNode !== input.node_id) throw new Error("invalid");
      const context: HintContext = {
        nodeId: input.node_id.slice(5).toUpperCase(),
        attempt: input.attempt_count as number,
      };
      if (input.last_error !== undefined) {
        if (
          !["occluded", "needs_calibration"].includes(String(input.last_error))
        )
          throw new Error("invalid");
        context.lastError = input.last_error as
          | "occluded"
          | "needs_calibration";
      }
      // Durable per-session cap also constrains inference spend; core play never waits on it.
      const current = structuredClone(session!);
      if (current.hintWindow !== Math.floor(now() / 60)) {
        current.hintWindow = Math.floor(now() / 60);
        current.hintCount = 0;
      }
      current.hintCount = (current.hintCount ?? 0) + 1;
      if (current.hintCount > 6) {
        statusCode = 429;
        throw new Error("rate_limited");
      }
      current.version++;
      dependencyFailure = true;
      if (!(await store.save(current, session!.version))) {
        statusCode = 503;
        throw new Error("unavailable");
      }
      dependencyFailure = false;
      const hint = await gateway.hint(context);
      body = {
        hint_id: `hint_${context.nodeId.toLowerCase()}_${context.attempt}`,
        text: hint.text,
        hint_level: hint.hintLevel,
        uses_fallback: hint.source === "authored",
      };
    } catch (error) {
      if (statusCode === 200)
        statusCode =
          error instanceof Error && error.message === "unauthorized"
            ? 403
            : dependencyFailure
              ? 503
              : 400;
      body = {
        code:
          statusCode === 403
            ? "unauthorized"
            : statusCode === 429
              ? "rate_limited"
              : "invalid_or_unavailable",
      };
    }
    console.info(
      JSON.stringify({
        operation: "hint_generate.v1",
        request_id: event.requestContext?.requestId ?? "unknown",
        status: statusCode,
        duration_ms: Date.now() - start,
      }),
    );
    return {
      statusCode,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify(body),
    };
  };
}
let runtime: ReturnType<typeof hintHandler> | undefined;
export async function handler(event: HintHttpEvent) {
  if (!runtime) {
    if (!process.env.RELAY_TABLE)
      throw new Error("missing_relay_configuration");
    const db = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        maxAttempts: 2,
        requestHandler: { connectionTimeout: 500, requestTimeout: 1000 },
      }),
    );
    const client = new BedrockRuntimeClient({
      maxAttempts: 1,
      requestHandler: { connectionTimeout: 500, requestTimeout: 1200 },
    });
    const transport =
      process.env.LIVE_HINTS_ENABLED === "true"
        ? new BedrockHintDirector(client, process.env.BEDROCK_MODEL_ID ?? "")
        : undefined;
    runtime = hintHandler(
      new DynamoRelayStore(db, process.env.RELAY_TABLE),
      new ModelGateway(transport),
    );
  }
  return runtime(event);
}

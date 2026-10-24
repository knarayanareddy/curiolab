import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoRelayStore, ApiGatewayDelivery } from "./aws-adapters.js";
import {
  ObservationBroker,
  BrokerError,
  type RelayDelivery,
} from "./broker.js";
export interface WebSocketEvent {
  requestContext: {
    routeKey: string;
    connectionId: string;
    requestId?: string;
  };
  body?: string | null;
  isBase64Encoded?: boolean;
}
export function relayHandler(
  broker: ObservationBroker,
  delivery: RelayDelivery,
) {
  return async (event: WebSocketEvent) => {
    const start = Date.now();
    let statusCode = 200;
    let code = "ok";
    try {
      if (event.requestContext.routeKey === "$disconnect")
        await broker.disconnected(event.requestContext.connectionId);
      else if (event.requestContext.routeKey !== "$connect") {
        if (event.isBase64Encoded || typeof event.body !== "string")
          throw new BrokerError("invalid");
        await broker.receive(event.requestContext.connectionId, event.body);
      }
    } catch (error) {
      code = error instanceof BrokerError ? error.code : "unavailable";
      statusCode =
        code === "unauthorized"
          ? 403
          : code === "unavailable"
            ? 503
            : code === "rate_limited"
              ? 429
              : 400;
      if (code === "unauthorized" || code === "invalid")
        await delivery
          .disconnect(event.requestContext.connectionId)
          .catch(() => undefined);
    }
    // Never log bodies, credentials, observations, audio or transcripts.
    console.info(
      JSON.stringify({
        operation: "relay",
        request_id: event.requestContext.requestId ?? "unknown",
        status: code,
        duration_ms: Date.now() - start,
      }),
    );
    return { statusCode, body: JSON.stringify({ code }) };
  };
}
let runtime: ReturnType<typeof relayHandler> | undefined;
export async function handler(event: WebSocketEvent) {
  if (!runtime) {
    const table = process.env.RELAY_TABLE;
    const endpoint = process.env.RELAY_MANAGEMENT_ENDPOINT;
    if (
      !table ||
      !endpoint ||
      !/^https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com\/[a-zA-Z0-9_-]+$/.test(
        endpoint,
      )
    )
      throw new Error("missing_relay_configuration");
    const db = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        maxAttempts: 2,
        requestHandler: { connectionTimeout: 500, requestTimeout: 1000 },
      }),
    );
    const delivery = new ApiGatewayDelivery(
      new ApiGatewayManagementApiClient({
        endpoint,
        maxAttempts: 1,
        requestHandler: { connectionTimeout: 500, requestTimeout: 1000 },
      }),
    );
    runtime = relayHandler(
      new ObservationBroker(new DynamoRelayStore(db, table), delivery),
      delivery,
    );
  }
  return runtime(event);
}

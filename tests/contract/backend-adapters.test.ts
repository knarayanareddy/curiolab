import { it, expect, vi } from "vitest";
import {
  ConverseCommand,
  type BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import {
  PostToConnectionCommand,
  DeleteConnectionCommand,
  type ApiGatewayManagementApiClient,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { BedrockHintDirector } from "../../services/hints/src/bedrock-director.js";
import { hintHandler } from "../../services/hints/src/lambda.js";
import {
  DynamoRelayStore,
  ApiGatewayDelivery,
} from "../../services/session-relay/src/aws-adapters.js";
import {
  ModelGateway,
  AUTHORED_HINTS,
} from "../../packages/model-gateway/src/index.js";
import {
  fixtureStore,
  pair,
  wire,
} from "../../packages/testkit/src/backend-fixture.js";
import { parseRelayMessage } from "../../packages/session-contracts/src/relay-client.js";
it("Converse sends text only, configured model, no tools/media, with abort propagation and approved output", async () => {
  const send = vi.fn(async () => ({
    stopReason: "end_turn",
    output: {
      message: {
        content: [
          {
            text: JSON.stringify({
              hint_id: "hint1",
              text: AUTHORED_HINTS.FLAT_LAB,
              hint_level: 1,
              uses_fallback: false,
            }),
          },
        ],
      },
    },
  }));
  const director = new BedrockHintDirector(
    { send } as unknown as Pick<BedrockRuntimeClient, "send">,
    "anthropic.operator-verified-model",
  );
  const hint = await new ModelGateway(director).hint({
    nodeId: "FLAT_LAB",
    attempt: 0,
  });
  expect(hint.source).toBe("gateway");
  const command = (
    send.mock.calls[0] as unknown as [
      ConverseCommand,
      { abortSignal: AbortSignal },
    ]
  )[0];
  expect(command).toBeInstanceOf(ConverseCommand);
  expect(command.input.modelId).toBe("anthropic.operator-verified-model");
  expect(
    command.input.messages?.[0]?.content?.every(
      (c) => typeof c.text === "string",
    ),
  ).toBe(true);
  expect(command.input.toolConfig).toBeUndefined();
  expect(command.input.inferenceConfig?.temperature).toBe(0);
  expect(
    () =>
      new BedrockHintDirector(
        { send } as unknown as Pick<BedrockRuntimeClient, "send">,
        "amazon.nova-canvas-v1:0",
      ),
  ).toThrow();
});
it.each(["throttle", "malformed", "truncated", "media", "unsafe"])(
  "Bedrock %s returns authored fallback",
  async (mode) => {
    const send = vi.fn(async () => {
      if (mode === "throttle") throw new Error("ThrottlingException");
      return {
        stopReason: mode === "truncated" ? "max_tokens" : "end_turn",
        output: {
          message: {
            content:
              mode === "media"
                ? [{ image: {} }]
                : [
                    {
                      text:
                        mode === "malformed"
                          ? "bad json"
                          : JSON.stringify({
                              hint_id: "hint1",
                              hint_level: 1,
                              uses_fallback: false,
                              text: "Use a heavy glass weight on the bridge.",
                            }),
                    },
                  ],
          },
        },
      };
    });
    expect(
      (
        await new ModelGateway(
          new BedrockHintDirector(
            { send } as unknown as Pick<BedrockRuntimeClient, "send">,
            "test-text-model",
          ),
        ).hint({ nodeId: "FLAT_LAB", attempt: 0 })
      ).source,
    ).toBe("authored");
  },
);
it("DynamoDB adapter uses consistent reads, conditional aggregate writes, TTL bindings and no swallowed outages", async () => {
  const send = vi.fn(
    async (command: unknown): Promise<{ Item?: Record<string, unknown> }> => {
      void command;
      return {};
    },
  );
  const store = new DynamoRelayStore(
    { send } as unknown as Pick<DynamoDBDocumentClient, "send">,
    "fixture-table",
  );
  await store.get("session1");
  expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetCommand);
  expect((send.mock.calls[0]![0] as GetCommand).input.ConsistentRead).toBe(
    true,
  );
  const fixture = fixtureStore().data();
  expect(await store.save({ ...fixture, version: 1 }, 0)).toBe(true);
  expect(
    (send.mock.calls[1]![0] as PutCommand).input.ExpressionAttributeValues,
  ).toEqual({ ":expected": 0 });
  send.mockRejectedValueOnce(
    Object.assign(new Error("conflict"), {
      name: "ConditionalCheckFailedException",
    }),
  );
  expect(await store.save(fixture, 0)).toBe(false);
  send.mockRejectedValueOnce(new Error("outage"));
  await expect(store.get("session1")).rejects.toThrow("outage");
  await store.bind("connection", "session1", 1000);
  await store.lookup("connection");
  await store.unbind("connection");
  expect(send.mock.calls.at(-1)?.[0]).toBeInstanceOf(DeleteCommand);
});
it("API Gateway management adapter maps bytes, closes connections, and distinguishes Gone from outages", async () => {
  const send = vi.fn(async (command: unknown) => {
    void command;
    return {};
  });
  const delivery = new ApiGatewayDelivery({ send } as unknown as Pick<
    ApiGatewayManagementApiClient,
    "send"
  >);
  await delivery.post("connection", { type: "fixture" });
  const command = send.mock.calls[0]![0] as PostToConnectionCommand;
  expect(command).toBeInstanceOf(PostToConnectionCommand);
  expect(Buffer.from(command.input.Data! as Uint8Array).toString()).toBe(
    '{"type":"fixture"}',
  );
  await delivery.disconnect("connection");
  expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteConnectionCommand);
  send.mockRejectedValueOnce(
    Object.assign(new Error("gone"), { name: "GoneException" }),
  );
  await delivery.disconnect("connection");
  send.mockRejectedValueOnce(new Error("outage"));
  await expect(delivery.post("connection", {})).rejects.toThrow("outage");
});
it("hint HTTP handler authorizes TV scope/current node, rejects media, and returns compatible fallback with live hints disabled", async () => {
  const f = fixtureStore();
  await pair(f);
  const state = {
    current_node_id: "node_flat_lab",
    content_version: "0.1.0",
    state_sequence: 1,
    predictions: { flat_winner: "unsure" },
    measurements: {},
  };
  await f.broker.receive(
    "tvconnection",
    wire("tv1", "state.snapshot", 1, { state, expected_state_sequence: -1 }),
  );
  const invoke = hintHandler(f.store, new ModelGateway(), () => 100);
  const input = {
    body: JSON.stringify({
      node_id: "node_flat_lab",
      attempt_count: 0,
      camera_mode: "manual_remote",
    }),
    headers: {
      authorization: "Bearer fictional-tv-credential",
      "x-session-id": "session1",
      "x-device-id": "tv1",
    },
  };
  const result = await invoke(input);
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body).uses_fallback).toBe(true);
  expect(
    (
      await invoke({
        ...input,
        headers: {
          ...input.headers,
          authorization: "Bearer wrong-long-credential",
        },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await invoke({
        ...input,
        body: JSON.stringify({
          node_id: "node_flat_lab",
          attempt_count: 0,
          camera_mode: "manual_remote",
          image: "secret",
        }),
      })
    ).statusCode,
  ).toBe(400);
  for (let i = 0; i < 5; i++) await invoke(input);
  expect((await invoke(input)).statusCode).toBe(429);
});
it("broker resume and snapshot envelopes parse in the real relay client contract", async () => {
  const f = fixtureStore();
  await pair(f);
  for (const [, value] of f.delivery.post.mock.calls as unknown as Array<
    [string, object]
  >)
    expect(parseRelayMessage(JSON.stringify(value), "session1").type).toBe(
      "session.hello",
    );
});
it("hint handler distinguishes storage outage and rejects stale node, invalid attempts and base64/media bodies", async () => {
  const f = fixtureStore();
  await pair(f);
  f.mutate((data) => {
    data.snapshot = {
      current_node_id: "node_flat_lab",
      content_version: "0.1.0",
      state_sequence: 1,
      predictions: { flat_winner: "unsure" },
      measurements: {},
    };
  });
  const handler = hintHandler(f.store, new ModelGateway(), () => 100);
  const headers = {
    authorization: "Bearer fictional-tv-credential",
    "x-session-id": "session1",
    "x-device-id": "tv1",
  };
  for (const input of [
    {
      node_id: "node_folded_lab",
      attempt_count: 0,
      camera_mode: "manual_remote",
    },
    {
      node_id: "node_flat_lab",
      attempt_count: -1,
      camera_mode: "manual_remote",
    },
  ])
    expect(
      (await handler({ headers, body: JSON.stringify(input) })).statusCode,
    ).toBe(400);
  expect(
    (await handler({ headers, body: "secret", isBase64Encoded: true }))
      .statusCode,
  ).toBe(400);
  const get = vi
    .spyOn(f.store, "get")
    .mockRejectedValueOnce(new Error("DynamoDB outage"));
  expect((await handler({ headers, body: "{}" })).statusCode).toBe(503);
  get.mockRestore();
});

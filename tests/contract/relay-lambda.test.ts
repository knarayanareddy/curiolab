import { expect, it, vi } from "vitest";
import { relayHandler } from "../../services/session-relay/src/lambda.js";
import {
  fixtureStore,
  wire,
} from "../../packages/testkit/src/backend-fixture.js";
it("maps real API Gateway route events through the broker, never logs bodies or media, and closes unauthenticated connections", async () => {
  const f = fixtureStore();
  const handler = relayHandler(f.broker, f.delivery);
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  const event = {
    requestContext: {
      routeKey: "$connect",
      connectionId: "tvconnection",
      requestId: "req1",
    },
  };
  try {
    expect((await handler(event)).statusCode).toBe(200);
    const hello = wire("tv1", "session.hello", 0, {
      credential: "fictional-tv-credential",
      last_acknowledged_sequence: -1,
    });
    expect(
      (
        await handler({
          ...event,
          body: hello,
          requestContext: { ...event.requestContext, routeKey: "$default" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await handler({
          ...event,
          body: hello,
          isBase64Encoded: true,
          requestContext: { ...event.requestContext, routeKey: "$default" },
        })
      ).statusCode,
    ).toBe(400);
    expect(f.delivery.disconnect).toHaveBeenCalledWith("tvconnection");
    const forged = wire("phone1", "observation.candidate", 1, {
      raw_frame: "PRIVATE_MEDIA",
    });
    expect(
      (
        await handler({
          ...event,
          body: forged,
          requestContext: {
            ...event.requestContext,
            connectionId: "forged",
            routeKey: "$default",
          },
        })
      ).statusCode,
    ).toBe(403);
    const output = JSON.stringify(logs.mock.calls);
    expect(output).not.toContain("PRIVATE_MEDIA");
    expect(output).not.toContain("fictional-tv-credential");
    expect(output).not.toContain("payload");
    expect(
      (
        await handler({
          requestContext: { ...event.requestContext, routeKey: "$disconnect" },
        })
      ).statusCode,
    ).toBe(200);
    expect(await f.store.lookup("tvconnection")).toBeUndefined();
  } finally {
    logs.mockRestore();
  }
});
it("closes authenticated sockets on media/invalid schema without treating it as a provider outage", async () => {
  const f = fixtureStore();
  const { pair } = await import(
    "../../packages/testkit/src/backend-fixture.js"
  );
  await pair(f);
  const handler = relayHandler(f.broker, f.delivery);
  const response = await handler({
    requestContext: { routeKey: "$default", connectionId: "phoneconnection" },
    body: wire("phone1", "observation.candidate", 1, {
      trial: "flat",
      observed_count: 1,
      confidence: 0.9,
      calibration: "calibrated",
      frame_sequence: 1,
      audio: "never-log-this",
    }),
  });
  expect(response.statusCode).toBe(400);
  expect(f.delivery.disconnect).toHaveBeenCalledWith("phoneconnection");
});

import { expect, it } from "vitest";
import {
  AUTHORED_HINTS,
  HttpHintTransport,
  ModelGateway,
} from "../../packages/model-gateway/src/index.js";
import { PairingClient } from "../../packages/session-contracts/src/pairing-client.js";
it("uses shared hint route without AWS credentials and maps structured output", async () => {
  const gateway = new ModelGateway(
    new HttpHintTransport(async (url, init) => {
      expect(url).toBe("/v1/hints");
      expect(JSON.parse(String(init?.body))).toEqual({
        node_id: "node_flat_lab",
        attempt_count: 1,
        camera_mode: "manual_remote",
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({
        hint_id: "hint1",
        hint_level: 2,
        uses_fallback: false,
        text: AUTHORED_HINTS.FLAT_LAB,
      });
    }),
  );
  expect((await gateway.hint({ nodeId: "FLAT_LAB", attempt: 1 })).source).toBe(
    "gateway",
  );
});
it("exchanges only a valid code/nonce for a bounded unexpired scoped credential", async () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  const result = {
    session_id: "session",
    device_id: "phone",
    credential: "fictional-scoped-credential",
    expires_at: "2026-10-24T13:00:00Z",
  };
  const client = new PairingClient(
    async (url, init) => {
      expect(url).toBe("/v1/pairings/exchange");
      expect(JSON.parse(String(init?.body))).toEqual({
        code: "ABC234",
        device_nonce: "fictional-nonce-123",
      });
      return Response.json(result);
    },
    () => now,
  );
  expect(await client.exchange("ABC234", "fictional-nonce-123")).toEqual(
    result,
  );
  await expect(client.exchange("bad", "short")).rejects.toThrow(
    "invalid_pairing_input",
  );
  for (const status of [401, 410, 429, 503]) {
    await expect(
      new PairingClient(async () => new Response("", { status })).exchange(
        "ABC234",
        "fictional-nonce-123",
      ),
    ).rejects.toThrow();
  }
  await expect(
    new PairingClient(
      async () =>
        Response.json({ ...result, expires_at: "2020-01-01T00:00:00Z" }),
      () => now,
    ).exchange("ABC234", "fictional-nonce-123"),
  ).rejects.toThrow("invalid_pairing_response");
});
it("rejects malformed and oversized gateway bodies without rendering them", async () => {
  for (const data of ["not json", "x".repeat(4097)]) {
    const transport = new HttpHintTransport(async () => new Response(data));
    expect(
      (
        await new ModelGateway(transport).hint({
          nodeId: "FLAT_LAB",
          attempt: 0,
        })
      ).source,
    ).toBe("authored");
    await expect(
      new PairingClient(async () => new Response(data)).exchange(
        "ABC234",
        "fictional-nonce-123",
      ),
    ).rejects.toThrow();
  }
});

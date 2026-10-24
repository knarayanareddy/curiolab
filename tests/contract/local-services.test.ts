import { expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { createLocalRelayServer } from "../../services/session-relay/src/local-server.js";
import { createLocalContentServer } from "../../services/content/src/local-server.js";
import { LocalServices } from "../../services/simulator/src/local-services.js";
import type { SimulatorState } from "../../packages/session-contracts/src/simulator-state.js";
async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
it("real local HTTP + WebSockets authenticate and relay observed/proposed/committed values; draft content stays allowlisted", async () => {
  const relay = createLocalRelayServer();
  const content = createLocalContentServer();
  const relayUrl = await listen(relay.server),
    contentUrl = await listen(content);
  const services = new LocalServices(relayUrl, contentUrl);
  const id = randomUUID();
  try {
    await services.ready();
    expect(services.title).toContain("Draft Fixture");
    expect((await fetch(`${contentUrl}/.env`)).status).toBe(404);
    expect((await fetch(`${contentUrl}/reviews.json`)).status).toBe(404);
    expect(
      (await fetch(`${contentUrl}/episode.json`, { method: "POST" })).status,
    ).toBe(405);
    const state: SimulatorState = {
      stage: "FLAT_PREDICTION",
      sequence: 1,
      flat: null,
      folded: null,
      stopped: null,
      comparison: null,
      perception: "NONE",
      observed: 0,
      predictions: {},
    };
    await services.publish(id, state, "begin", []);
    expect((await relay.store.get(id))?.snapshot?.state_sequence).toBe(1);
    const lab: SimulatorState = {
      ...state,
      stage: "FLAT_LAB",
      sequence: 2,
      predictions: { flat_winner: "folded" },
    };
    await services.publish(id, lab, "predict", []);
    await services.publish(
      id,
      { ...lab, observed: 5, perception: "OBSERVING" },
      "observe",
      ["FLAT", "1", "5", "0.9"],
    );
    expect((await relay.store.get(id))?.snapshot?.measurements).toEqual({});
    const stopped: SimulatorState = {
      ...lab,
      stage: "FLAT_CONFIRMATION",
      sequence: 3,
      stopped: 5,
    };
    await services.publish(id, stopped, "stop", ["FLAT"]);
    await services.publish(
      id,
      { ...stopped, stage: "FOLDED_PREDICTION", sequence: 4, flat: 4 },
      "confirm",
      ["FLAT", "4"],
    );
    expect((await relay.store.get(id))?.snapshot?.measurements).toEqual({
      flat_load: 4,
    });
    expect(services.status).toBe("ready");
    const socket = new WebSocket(`${relayUrl.replace("http:", "ws:")}/relay`);
    await new Promise<void>((resolve) => socket.once("open", resolve));
    const closed = new Promise<number>((resolve) =>
      socket.once("close", resolve),
    );
    socket.send(Buffer.from("raw-media"));
    expect(await closed).toBe(1008);
    await services.clear(id);
    expect(await relay.store.get(id)).toBeUndefined();
  } finally {
    services.close();
    await relay.close();
    await new Promise<void>((resolve) => content.close(() => resolve()));
  }
});
it("unavailable orchestration dependencies fail explicitly rather than claim readiness", async () => {
  const services = new LocalServices(
    "http://127.0.0.1:1",
    "http://127.0.0.1:1",
  );
  await expect(services.ready()).rejects.toThrow();
  expect(services.status).not.toBe("ready");
});

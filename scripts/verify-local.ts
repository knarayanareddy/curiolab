import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const tv = process.env.SIMULATOR_ORIGIN ?? "http://127.0.0.1:5173";
for (const [origin, path] of [
  [process.env.RELAY_ORIGIN ?? "http://127.0.0.1:8080", "/health"],
  [process.env.CONTENT_ORIGIN ?? "http://127.0.0.1:8081", "/episode.json"],
])
  assert.equal(
    (await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(5000) }))
      .status,
    200,
  );
const health = await (await fetch(`${tv}/api/health`)).json();
assert.equal(health.services?.status, "ready");
assert.match(health.services.title, /Draft Fixture/);
const session = randomUUID();
const send = async (command: string, args: string[] = []) => {
  const response = await fetch(`${tv}/api/episode`, {
    method: "POST",
    headers: { origin: tv, "content-type": "application/json" },
    body: JSON.stringify({ session, command, args }),
    signal: AbortSignal.timeout(15000),
  });
  const reply = await response.json();
  assert.equal(response.status, 200);
  assert.equal(reply.error, undefined);
  return reply;
};
try {
  await send("begin", [
    "true",
    "true",
    "true",
    "true",
    "false",
    "COMPANION",
    "GRANTED",
    "standard",
  ]);
  await send("predict", ["FLAT", "folded"]);
  await send("observe", [
    "FLAT",
    "1",
    "3",
    "0.9",
    "500",
    "0,1,2,3",
    "2",
    "0",
    "OBSERVING",
  ]);
  await send("stop", ["FLAT", "3"]);
  await send("confirm", ["FLAT", "3"]);
  await send("predict", ["FOLDED", "more"]);
  await send("observe", [
    "FOLDED",
    "2",
    "7",
    "0.9",
    "500",
    "0,1,2,3",
    "2",
    "0",
    "OBSERVING",
  ]);
  await send("stop", ["FOLDED", "7"]);
  const result = await send("confirm", ["FOLDED", "7"]);
  assert.equal(result.comparison, "GREATER");
  assert.equal(
    (await (await fetch(`${tv}/api/health`)).json()).services.status,
    "ready",
  );
  console.log(
    "PASS: TV → draft content HTTP + authenticated real local WebSockets → broker candidate/stop/committed snapshot forwarding; synthetic 3/7 GREATER.",
  );
} finally {
  await send("delete");
}

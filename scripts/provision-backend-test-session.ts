import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  credentialHash,
  type RelaySession,
} from "../services/session-relay/src/broker.js";
if (
  process.argv[2] !== "--adult-approved-test-session" ||
  !process.env.RELAY_TABLE ||
  !process.env.AWS_REGION
)
  throw new Error(
    "Requires --adult-approved-test-session, RELAY_TABLE and AWS_REGION. Uses operator AWS credential chain; creates test grants, not production pairing.",
  );
const id = randomUUID();
const now = Math.floor(Date.now() / 1000);
const tv = {
  device_id: randomUUID(),
  credential: randomBytes(32).toString("base64url"),
};
const companion = {
  device_id: randomUUID(),
  credential: randomBytes(32).toString("base64url"),
};
const session: RelaySession = {
  id,
  version: 0,
  ttl: now + 7 * 86400,
  completed: false,
  snapshot: null,
  stopped: null,
  rateWindow: now,
  rateCount: 0,
  grants: [tv, companion].map((device, index) => ({
    deviceId: device.device_id,
    role: index === 0 ? "tv" : "companion",
    tokenHash: credentialHash(device.credential),
    expiresAt: now + 12 * 3600,
    revoked: false,
    sequence: -1,
    recentIds: [],
  })),
};
await mkdir(".private", { recursive: true, mode: 0o700 });
const path = `.private/backend-session-${id}.json`;
await writeFile(
  path,
  JSON.stringify({
    mode: "operator-provisioned-test-only",
    session_id: id,
    expires_at: new Date((now + 12 * 3600) * 1000).toISOString(),
    tv,
    companion,
  }),
  { flag: "wx", mode: 0o600 },
);
try {
  const db = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 1000, requestTimeout: 3000 },
    }),
  );
  await db.send(
    new PutCommand({
      TableName: process.env.RELAY_TABLE,
      Item: { pk: `SESSION#${id}`, version: 0, ttl: session.ttl, session },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );
} catch {
  await unlink(path);
  throw new Error(
    "Test session not provisioned; private local file removed. Check operator AWS access/table configuration.",
  );
}
console.log(
  "Operator-approved test session provisioned. Credentials are in the new mode-0600 file under .private/; never share or commit it. No native pairing or release evidence was produced.",
);

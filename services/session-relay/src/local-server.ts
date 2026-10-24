import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import {
  ObservationBroker,
  authorize,
  credentialHash,
  type RelaySession,
  type RelayStore,
} from "./broker.js";
/** Ephemeral LOCAL fixture host for the real broker. Never a cloud pairing/token issuer. */
export function createLocalRelayServer() {
  const sessions = new Map<string, RelaySession>();
  const bindings = new Map<string, string>();
  const sockets = new Map<string, WebSocket>();
  const store: RelayStore = {
    get: async (id) => {
      const data = sessions.get(id);
      return data && structuredClone(data);
    },
    save: async (next, expected) => {
      if (sessions.get(next.id)?.version !== expected) return false;
      sessions.set(next.id, structuredClone(next));
      return true;
    },
    bind: async (id, session) => {
      bindings.set(id, session);
    },
    lookup: async (id) => bindings.get(id),
    unbind: async (id) => {
      bindings.delete(id);
    },
  };
  const broker = new ObservationBroker(store, {
    post: async (id, value) => {
      const socket = sockets.get(id);
      if (!socket || socket.readyState !== WebSocket.OPEN)
        throw new Error("socket_closed");
      socket.send(JSON.stringify(value));
    },
    disconnect: async (id) => {
      sockets.get(id)?.close(1008);
    },
  });
  const server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    if (req.method === "GET" && req.url === "/health") {
      res.end(
        JSON.stringify({
          status: "ready",
          provenance: "local-fixture",
          sessions: sessions.size,
        }),
      );
      return;
    }
    try {
      if (req.method === "POST" && req.url === "/fixture/sessions") {
        let body = "";
        for await (const chunk of req) {
          body += String(chunk);
          if (Buffer.byteLength(body) > 512) throw new Error("too_large");
        }
        const input = JSON.parse(body);
        if (
          Object.keys(input).join() !== "session" ||
          typeof input.session !== "string" ||
          !/^[a-f0-9-]{36}$/.test(input.session)
        )
          throw new Error("invalid_session");
        const now = Math.floor(Date.now() / 1000);
        for (const [id, session] of sessions)
          if (session.ttl <= now) sessions.delete(id);
        if (sessions.has(input.session) || sessions.size >= 100) {
          res.writeHead(409);
          res.end('{"error":"session_exists_or_capacity"}');
          return;
        }
        const tv = randomBytes(32).toString("hex"),
          phone = randomBytes(32).toString("hex");
        sessions.set(input.session, {
          id: input.session,
          version: 0,
          ttl: now + 43200,
          completed: false,
          snapshot: null,
          stopped: null,
          rateWindow: 0,
          rateCount: 0,
          grants: [
            {
              deviceId: "tv",
              role: "tv",
              tokenHash: credentialHash(tv),
              expiresAt: now + 43200,
              revoked: false,
              sequence: -1,
              recentIds: [],
            },
            {
              deviceId: "phone",
              role: "companion",
              tokenHash: credentialHash(phone),
              expiresAt: now + 43200,
              revoked: false,
              sequence: -1,
              recentIds: [],
            },
          ],
        });
        res.writeHead(201);
        res.end(JSON.stringify({ provenance: "local-fixture", tv, phone }));
        return;
      }
      const match = req.url?.match(/^\/fixture\/sessions\/([a-f0-9-]{36})$/);
      if (req.method === "DELETE" && match) {
        const grant = authorize(
          sessions.get(match[1]!),
          "tv",
          (req.headers.authorization ?? "").replace(/^Bearer /, ""),
          Math.floor(Date.now() / 1000),
        );
        for (const peer of sessions.get(match[1]!)!.grants)
          if (peer.connectionId) sockets.get(peer.connectionId)?.close(1000);
        grant.revoked = true;
        sessions.delete(match[1]!);
        res.end('{"deleted":true}');
        return;
      }
      res.writeHead(404);
      res.end('{"error":"not_found"}');
    } catch {
      res.writeHead(400);
      res.end('{"error":"invalid_fixture_request"}');
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16384,
    perMessageDeflate: false,
  });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/relay") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });
  wss.on("connection", (socket) => {
    if (sockets.size >= 200) {
      socket.close(1013);
      return;
    }
    const id = randomUUID();
    sockets.set(id, socket);
    const timer = setTimeout(() => {
      if (!bindings.has(id)) socket.close(1008);
    }, 5000);
    let queue = Promise.resolve();
    let pending = 0;
    socket.on("message", (data, binary) => {
      if (pending >= 20) {
        socket.close(1008, "queue_limit");
        return;
      }
      pending++;
      queue = queue
        .then(async () => {
          if (binary) throw new Error("media_forbidden");
          await broker.receive(id, data.toString());
        })
        .catch(() => {
          socket.close(1008, "invalid_or_unauthorized");
        })
        .finally(() => {
          pending--;
        });
    });
    socket.on("error", () => socket.close());
    socket.on("close", () => {
      clearTimeout(timer);
      sockets.delete(id);
      void queue.finally(() => broker.disconnected(id));
    });
  });
  return {
    store,
    server,
    close: async () => {
      for (const socket of sockets.values()) socket.terminate();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const host = createLocalRelayServer();
  host.server.listen(8080, "0.0.0.0", () =>
    console.log("Local fixture WebSocket relay on :8080; no AWS"),
  );
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.on(signal, () => void host.close());
}

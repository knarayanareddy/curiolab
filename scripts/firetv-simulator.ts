import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { createServer as createViteServer } from "vite";

const java = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, "bin/java")
  : "java";
const engine = spawn(
  java,
  ["-cp", "build/episode-engine.jar", "com.curiolab.episode.SimulatorBridge"],
  { stdio: ["pipe", "pipe", "inherit"] },
);
const pending: Array<{
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}> = [];
let healthy = true;
createInterface({ input: engine.stdout }).on("line", (line) =>
  pending.shift()?.resolve(line),
);
const fail = () => {
  healthy = false;
  for (const job of pending.splice(0))
    job.reject(new Error("engine_unavailable"));
};
engine.on("error", fail);
engine.on("exit", fail);
engine.stdin.on("error", fail);
function command(parts: string[]): Promise<string> {
  if (!healthy || pending.length >= 20)
    return Promise.reject(new Error("engine_unavailable"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      fail();
      engine.kill();
    }, 5000);
    pending.push({
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    engine.stdin.write(`${parts.join("\t")}\n`);
  });
}
const vite = await createViteServer({
  root: "apps/firetv",
  server: {
    middlewareMode: true,
    allowedHosts: true,
    hmr: false,
    fs: {
      allow: [
        "apps/firetv",
        "packages/model-gateway",
        "packages/session-contracts",
        "packages/perception",
        "packages/voice",
        "ui",
        "node_modules",
      ].map((path) => resolve(path)),
    },
  },
  appType: "spa",
});
const server = createServer(async (req, res) => {
  if (req.url === "/api/health") {
    res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: healthy ? "ready" : "unavailable",
        mode: "local-kotlin-simulator",
      }),
    );
    return;
  }
  if (req.url !== "/api/episode") {
    vite.middlewares(req, res);
    return;
  }
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  let sameOrigin = false;
  try {
    sameOrigin =
      !!req.headers.origin &&
      new URL(req.headers.origin).host === req.headers.host;
  } catch {
    /* Malformed Origin is rejected, never crashes the server. */
  }
  if (req.method !== "POST" || !sameOrigin) {
    res.writeHead(403);
    res.end('{"error":"Same-origin POST required"}');
    return;
  }
  try {
    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
      if (Buffer.byteLength(body) > 4096) throw new Error("request_too_large");
    }
    const value = JSON.parse(body) as {
      session: unknown;
      command: unknown;
      args: unknown;
    };
    if (
      typeof value.session !== "string" ||
      !/^[a-f0-9-]{36}$/.test(value.session) ||
      typeof value.command !== "string" ||
      ![
        "state",
        "begin",
        "predict",
        "observe",
        "stop",
        "confirm",
        "manual",
        "compare",
        "reflect",
        "delete",
      ].includes(value.command) ||
      !Array.isArray(value.args) ||
      value.args.length > 12 ||
      !value.args.every(
        (arg) =>
          typeof arg === "string" && !/[\t\r\n]/.test(arg) && arg.length <= 80,
      )
    )
      throw new Error("invalid_command");
    const result = await command([
      value.session,
      value.command,
      ...(value.args as string[]),
    ]);
    res.end(result);
  } catch {
    res.writeHead(400);
    res.end(
      '{"error":"Simulator unavailable or invalid action. Retry or restart the local simulator."}',
    );
  }
});
server.listen(5173, "0.0.0.0", () =>
  console.log(
    "CurioLab TV simulator on port 5173 — local Kotlin engine, no AWS or native camera",
  ),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    engine.kill();
    server.close();
    void vite.close();
  });

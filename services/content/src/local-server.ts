import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
/** Explicit allowlist: never serve private datasets, reviews, filesystem paths or secrets. */
export function createLocalContentServer(root = process.cwd()) {
  const files: Record<string, string> = {
    "/episode.json": "content/episodes/bridge-to-moon-base/episode.json",
  };
  return createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    res.setHeader("x-content-type-options", "nosniff");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    if (req.url === "/health") {
      res.end(
        req.method === "HEAD"
          ? undefined
          : JSON.stringify({
              status: "ready",
              provenance: "draft-fixture",
              signed: false,
            }),
      );
      return;
    }
    const path = files[req.url ?? ""];
    if (!path) {
      res.writeHead(404);
      res.end('{"error":"not_found"}');
      return;
    }
    try {
      const body = await readFile(resolve(root, path));
      res.setHeader("cache-control", "public, max-age=60");
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(503);
      res.end('{"error":"draft_content_unavailable"}');
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  createLocalContentServer().listen(8081, "0.0.0.0", () =>
    console.log("Draft fixture content on :8081; not signed/approved content"),
  );

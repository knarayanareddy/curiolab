import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { EpisodeBundleLoader } from "../../packages/bundle-loader/src/index.js";
import { FileBundleCache } from "../../services/content/src/file-bundle-cache.js";
import { HttpsBundleSource } from "../../services/content/src/https-bundle-source.js";
import { bundleFixture } from "../../packages/testkit/src/bundle-fixture.js";

it("downloads, commits, reopens offline, rejects modified cache and preserves old bundle on bad update", async () => {
  const directory = await mkdtemp(join(tmpdir(), "curiolab-bundle-"));
  try {
    const f = bundleFixture();
    let response = JSON.stringify(f.envelope());
    const source = new HttpsBundleSource(
      new URL("https://content.example/"),
      async (url, options) => {
        expect(String(url)).toBe(
          "https://content.example/v1/episodes/01000000000000000000000001/bundle",
        );
        expect(options?.redirect).toBe("error");
        return new Response(response);
      },
    );
    const cache = new FileBundleCache(directory);
    const loader = new EpisodeBundleLoader(
      source,
      cache,
      f.publicKey,
      f.schema,
    );
    await loader.install(f.payload.episodeId);
    const reopened = new EpisodeBundleLoader(
      source,
      new FileBundleCache(directory),
      f.publicKey,
      f.schema,
    );
    expect(await reopened.launch(f.payload.episodeId)).toEqual(f.payload);
    response = JSON.stringify({ payload: "", signature: "" });
    await expect(loader.install(f.payload.episodeId)).rejects.toThrow();
    expect(await reopened.launch(f.payload.episodeId)).toEqual(f.payload);
    await expect(cache.replace("../escape", f.envelope())).rejects.toThrow();
    await writeFile(join(directory, `${f.payload.episodeId}.json`), response);
    await expect(reopened.launch(f.payload.episodeId)).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it("fails closed for HTTP failures, malformed JSON, untrusted origins and missing cache", async () => {
  expect(
    () => new HttpsBundleSource(new URL("http://content.example/")),
  ).toThrow();
  for (const response of [
    new Response("denied", { status: 403 }),
    new Response("not json"),
  ]) {
    const source = new HttpsBundleSource(
      new URL("https://content.example/"),
      async () => response,
    );
    await expect(
      source.download("episode", new AbortController().signal),
    ).rejects.toThrow();
  }
  await expect(
    new FileBundleCache("/nonexistent-curiolab").read("episode"),
  ).rejects.toThrow();
});

it("rejects oversized HTTP bodies and propagates transport failures", async () => {
  const signal = new AbortController().signal;
  const large = new HttpsBundleSource(
    new URL("https://content.example/"),
    async () => new Response("x".repeat(8 * 1024 * 1024 + 1025)),
  );
  await expect(large.download("episode", signal)).rejects.toThrow(
    "download_too_large",
  );
  const failed = new HttpsBundleSource(
    new URL("https://content.example/"),
    async () => {
      throw new Error("network_unavailable");
    },
  );
  await expect(failed.download("episode", signal)).rejects.toThrow(
    "network_unavailable",
  );
});

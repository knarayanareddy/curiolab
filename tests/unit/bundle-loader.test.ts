import { describe, it, expect, vi } from "vitest";
import {
  EpisodeBundleLoader,
  verifyBundle,
  type SignedBundle,
} from "../../packages/bundle-loader/src/index.js";
import { bundleFixture } from "../../packages/testkit/src/bundle-fixture.js";

describe("signed bundle policy (fictional keys/content)", () => {
  it("accepts a signed approved bundle", () => {
    const f = bundleFixture();
    expect(
      verifyBundle(f.envelope(), f.payload.episodeId, f.publicKey, f.schema),
    ).toEqual(f.payload);
  });
  it.each([
    "signature",
    "schema",
    "draft",
    "graph",
    "asset",
    "identity",
    "version",
    "format",
    "asset-set",
    "base64",
  ])("rejects %s tampering", (failure) => {
    const f = bundleFixture();
    if (failure === "schema") f.payload.episode.nodes = [];
    if (failure === "draft") f.payload.episode.review.status = "draft";
    if (failure === "graph")
      f.payload.episode.review.graph_sha256 = "abcd".repeat(16);
    if (failure === "asset")
      f.payload.assets[Object.keys(f.payload.assets)[0]!] = "YWJj";
    if (failure === "identity") f.payload.episodeId = "other";
    if (failure === "version") f.payload.version = "latest";
    if (failure === "format") Object.assign(f.payload, { format: 2 });
    if (failure === "asset-set") f.payload.assets.extra = "";
    if (failure === "base64")
      f.payload.assets[Object.keys(f.payload.assets)[0]!] = "!";
    const bundle = f.envelope();
    if (failure === "signature") bundle.signature = "";
    expect(() =>
      verifyBundle(bundle, "01000000000000000000000001", f.publicKey, f.schema),
    ).toThrow();
  });
  it("never replaces cache after a rejected download; launches offline", async () => {
    const f = bundleFixture();
    let saved: SignedBundle = f.envelope();
    const replace = vi.fn(async (_: string, bundle: SignedBundle) => {
      saved = bundle;
    });
    const source = {
      download: vi.fn(async () => ({ payload: "", signature: "" })),
    };
    const loader = new EpisodeBundleLoader(
      source,
      { read: async () => saved, replace },
      f.publicKey,
      f.schema,
    );
    await expect(loader.install(f.payload.episodeId)).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
    expect((await loader.launch(f.payload.episodeId)).version).toBe("0.1.0");
    source.download.mockRejectedValueOnce(new Error("offline"));
    await expect(loader.install(f.payload.episodeId)).rejects.toThrow(
      "offline",
    );
    expect((await loader.launch(f.payload.episodeId)).version).toBe("0.1.0");
  });
  it("bounds download time even if source ignores abort", async () => {
    const f = bundleFixture();
    const replace = vi.fn();
    const loader = new EpisodeBundleLoader(
      { download: () => new Promise(() => {}) },
      { read: vi.fn(), replace },
      f.publicKey,
      f.schema,
      5,
    );
    await expect(loader.install(f.payload.episodeId)).rejects.toThrow(
      "timeout",
    );
    expect(replace).not.toHaveBeenCalled();
  });
});

it("propagates atomic cache failure without claiming installation", async () => {
  const f = bundleFixture();
  const loader = new EpisodeBundleLoader(
    { download: async () => f.envelope() },
    {
      read: async () => f.envelope(),
      replace: async () => {
        throw new Error("disk_full");
      },
    },
    f.publicKey,
    f.schema,
  );
  await expect(loader.install(f.payload.episodeId)).rejects.toThrow(
    "disk_full",
  );
  expect(await loader.launch(f.payload.episodeId)).toEqual(f.payload);
});
it("rejects unsigned/oversized envelopes, wrong trust key, invalid identifiers and timeout", () => {
  const f = bundleFixture();
  for (const envelope of [
    { payload: "", signature: "" },
    { payload: "a".repeat(8 * 1024 * 1024 + 1), signature: "" },
  ]) {
    expect(() =>
      verifyBundle(envelope, f.payload.episodeId, f.publicKey, f.schema),
    ).toThrow();
  }
  expect(() =>
    verifyBundle(
      f.envelope(),
      f.payload.episodeId,
      bundleFixture().publicKey,
      f.schema,
    ),
  ).toThrow("signature");
  expect(() =>
    verifyBundle(f.envelope(), "../escape", f.publicKey, f.schema),
  ).toThrow("invalid_episode_id");
  expect(
    () =>
      new EpisodeBundleLoader(
        { download: async () => f.envelope() },
        { read: async () => f.envelope(), replace: async () => {} },
        f.publicKey,
        f.schema,
        0,
      ),
  ).toThrow("invalid_timeout");
});

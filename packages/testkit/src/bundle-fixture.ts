/** Fictional signed fixture. These keys and approvals are NEVER release evidence. */
import { readFileSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  sha256,
  type BundlePayload,
  type SignedBundle,
} from "../../bundle-loader/src/index.js";
import type { EpisodeDocument } from "../../content-compiler/src/index.js";
export function bundleFixture() {
  const schema = JSON.parse(
    readFileSync("schemas/episode.schema.json", "utf8"),
  ) as object;
  const episode = JSON.parse(
    readFileSync("examples/episode.example.json", "utf8"),
  ) as EpisodeDocument;
  const assets = Object.fromEntries(
    episode.assets.map((asset) => {
      const bytes = Buffer.from(`FICTIONAL fixture ${asset.asset_id}`);
      asset.sha256 = sha256(bytes);
      return [asset.asset_id, bytes.toString("base64")];
    }),
  );
  episode.review = {
    ...episode.review,
    status: "approved",
    science_reviewer: "FICTIONAL",
    child_safety_reviewer: "FICTIONAL",
    graph_sha256: sha256(Buffer.from(JSON.stringify(episode.nodes))),
  };
  episode.safety.reviewed = true;
  const payload: BundlePayload = {
    format: 1,
    episodeId: "01000000000000000000000001",
    version: "0.1.0",
    episode,
    assets,
  };
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  function envelope(value = payload): SignedBundle {
    const bytes = Buffer.from(JSON.stringify(value));
    return {
      payload: bytes.toString("base64"),
      signature: sign(null, bytes, privateKey).toString("base64"),
    };
  }
  return { schema, payload, publicKey, envelope };
}

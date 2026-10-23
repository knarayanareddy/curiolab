import { createHash, verify, type KeyObject } from "node:crypto";
import {
  validateEpisodeSchema,
  validateEpisodeGraph,
  type EpisodeDocument,
} from "../../content-compiler/src/index.js";

/** Internal signed transport contract, not a replacement for episode.schema.json. */
export interface SignedBundle {
  payload: string;
  signature: string;
}
export interface BundlePayload {
  format: 1;
  episodeId: string;
  version: string;
  episode: EpisodeDocument;
  assets: Record<string, string>;
}
export interface BundleSource {
  download(episodeId: string, signal: AbortSignal): Promise<SignedBundle>;
}
/** replace must commit the entire envelope atomically, retaining old bytes on failure. */
export interface BundleCache {
  read(episodeId: string): Promise<SignedBundle>;
  replace(episodeId: string, bundle: SignedBundle): Promise<void>;
}
export const MAX_BUNDLE_BYTES = 8 * 1024 * 1024;
export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function validateEpisodeId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))
    throw new Error("invalid_episode_id");
}
function base64(value: string): Buffer {
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error("invalid_base64");
  return bytes;
}
export function verifyBundle(
  envelope: SignedBundle,
  episodeId: string,
  key: KeyObject,
  schema: object,
): BundlePayload {
  validateEpisodeId(episodeId);
  if (
    typeof envelope?.payload !== "string" ||
    typeof envelope.signature !== "string" ||
    envelope.payload.length > MAX_BUNDLE_BYTES ||
    envelope.signature.length > 128
  )
    throw new Error("invalid_envelope");
  if (key.asymmetricKeyType !== "ed25519") throw new Error("invalid_trust_key");
  const bytes = base64(envelope.payload);
  if (!verify(null, bytes, key, base64(envelope.signature)))
    throw new Error("invalid_signature");
  const payload = JSON.parse(bytes.toString("utf8")) as BundlePayload;
  if (
    payload.format !== 1 ||
    payload.episodeId !== episodeId ||
    !/^\d+\.\d+\.\d+$/.test(payload.version) ||
    !payload.assets ||
    typeof payload.assets !== "object" ||
    Array.isArray(payload.assets)
  )
    throw new Error("invalid_manifest");
  if (!validateEpisodeSchema(schema, payload.episode).valid)
    throw new Error("invalid_episode_schema");
  const identity = payload.episode as EpisodeDocument & {
    episode_id: string;
    content_version: string;
  };
  if (
    identity.episode_id !== episodeId ||
    identity.content_version !== payload.version
  )
    throw new Error("episode_identity_mismatch");
  if (!validateEpisodeGraph(payload.episode, { forPublication: true }).valid)
    throw new Error("unapproved_or_invalid_graph");
  // Compiler graph identity is SHA-256 over JSON.stringify(nodes), in authored order.
  if (
    payload.episode.review.graph_sha256 !==
    sha256(Buffer.from(JSON.stringify(payload.episode.nodes)))
  )
    throw new Error("graph_hash_mismatch");
  if (Object.keys(payload.assets).length !== payload.episode.assets.length)
    throw new Error("asset_set_mismatch");
  for (const asset of payload.episode.assets) {
    const encoded = payload.assets[asset.asset_id];
    if (typeof encoded !== "string" || sha256(base64(encoded)) !== asset.sha256)
      throw new Error("asset_hash_mismatch");
  }
  return payload;
}

export class EpisodeBundleLoader {
  constructor(
    private readonly source: BundleSource,
    private readonly cache: BundleCache,
    private readonly key: KeyObject,
    private readonly schema: object,
    private readonly timeoutMs = 5000,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new Error("invalid_timeout");
  }
  async install(episodeId: string): Promise<BundlePayload> {
    validateEpisodeId(episodeId);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const bundle = await Promise.race([
        this.source.download(episodeId, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("bundle_download_timeout"));
          }, this.timeoutMs);
        }),
      ]);
      const payload = verifyBundle(bundle, episodeId, this.key, this.schema);
      await this.cache.replace(episodeId, bundle);
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }
  async launch(episodeId: string): Promise<BundlePayload> {
    validateEpisodeId(episodeId);
    return verifyBundle(
      await this.cache.read(episodeId),
      episodeId,
      this.key,
      this.schema,
    );
  }
}

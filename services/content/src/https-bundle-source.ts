import {
  MAX_BUNDLE_BYTES,
  validateEpisodeId,
  type BundleSource,
  type SignedBundle,
} from "../../../packages/bundle-loader/src/index.js";

/** Deployment supplies a trusted HTTPS content origin; redirects are never followed. */
export class HttpsBundleSource implements BundleSource {
  constructor(
    private readonly origin: URL,
    private readonly request: typeof fetch = fetch,
  ) {
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new Error("invalid_content_origin");
    this.origin = new URL(origin);
  }
  async download(id: string, signal: AbortSignal): Promise<SignedBundle> {
    validateEpisodeId(id);
    const response = await this.request(
      new URL(`/v1/episodes/${id}/bundle`, this.origin),
      { signal, redirect: "error" },
    );
    if (!response.ok || !response.body) throw new Error("bundle_unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > MAX_BUNDLE_BYTES + 1024)
          throw new Error("download_too_large");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as SignedBundle;
  }
}

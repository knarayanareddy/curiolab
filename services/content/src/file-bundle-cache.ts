import { mkdir, rename, unlink, open } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  MAX_BUNDLE_BYTES,
  validateEpisodeId,
  type BundleCache,
  type SignedBundle,
} from "../../../packages/bundle-loader/src/index.js";

/** Local Node adapter. Not Fire OS storage or a deployed content service. */
export class FileBundleCache implements BundleCache {
  constructor(private readonly directory: string) {}
  private path(id: string): string {
    validateEpisodeId(id);
    return join(this.directory, `${id}.json`);
  }
  async read(id: string): Promise<SignedBundle> {
    const file = await open(this.path(id), "r");
    try {
      if ((await file.stat()).size > MAX_BUNDLE_BYTES + 1024)
        throw new Error("cache_too_large");
      return JSON.parse(await file.readFile("utf8")) as SignedBundle;
    } finally {
      await file.close();
    }
  }
  async replace(id: string, bundle: SignedBundle): Promise<void> {
    const destination = this.path(id);
    const data = JSON.stringify(bundle);
    if (Buffer.byteLength(data) > MAX_BUNDLE_BYTES + 1024)
      throw new Error("cache_too_large");
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(data);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, destination);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}

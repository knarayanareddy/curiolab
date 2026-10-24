import { stat, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
/** One build before workers start, including direct `pnpm vitest run` on a clean checkout. */
export default async function prepare() {
  const root = "packages/episode-engine/src/main/kotlin/com/curiolab/episode";
  const sources = (await readdir(root))
    .filter((name) => name.endsWith(".kt"))
    .map((name) => `${root}/${name}`);
  sources.push(
    "packages/episode-engine/src/jsMain/kotlin/com/curiolab/episode/BrowserSimulator.kt",
    "scripts/build-browser-engine.sh",
  );
  const output = await stat("apps/firetv/src/generated/engine.mjs").catch(
    () => undefined,
  );
  const latest = Math.max(
    ...(await Promise.all(
      sources.map(async (path) => (await stat(path)).mtimeMs),
    )),
  );
  if (!output || output.mtimeMs < latest)
    await promisify(execFile)("bash", ["scripts/build-browser-engine.sh"], {
      timeout: 90000,
    });
}

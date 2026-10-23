import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  validateEpisodeSchema,
  type EpisodeDocument,
} from "../../packages/content-compiler/src/index.js";

function path(relative: string): string {
  return fileURLToPath(new URL(`../../${relative}`, import.meta.url));
}
function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(path(relative), "utf8")) as T;
}

const schema = readJson<object>("schemas/episode.schema.json");
const example = readJson<EpisodeDocument>("examples/episode.example.json");

describe("episode schema contract", () => {
  it("keeps the compiler schema byte-identical to canonical", () => {
    expect(
      readFileSync(
        path("packages/content-compiler/episode.schema.json"),
        "utf8",
      ),
    ).toBe(readFileSync(path("schemas/episode.schema.json"), "utf8"));
  });

  it("validates the labeled draft and its content copy", () => {
    expect(validateEpisodeSchema(schema, example)).toEqual({
      valid: true,
      errors: [],
    });
    const content = readJson<EpisodeDocument>(
      "content/episodes/bridge-to-moon-base/episode.json",
    );
    expect(content).toEqual(example);
    expect(validateEpisodeSchema(schema, content).valid).toBe(true);
  });

  it("rejects a non-authored measurement source", () => {
    const invalid = structuredClone(example) as unknown as {
      nodes: Array<{ type: string; measurement?: { source: string } }>;
    };
    const lab = invalid.nodes.find((node) => node.type === "lab")!;
    lab.measurement!.source = "unbounded_ai_guess";
    expect(validateEpisodeSchema(schema, invalid).valid).toBe(false);
  });

  it("round-trips without changing graph content", () => {
    expect(JSON.parse(JSON.stringify(example)) as unknown).toEqual(example);
  });
});

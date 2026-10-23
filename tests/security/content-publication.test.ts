import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  validateEpisodeGraph,
  type EpisodeDocument,
} from "../../packages/content-compiler/src/index.js";

const example = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../examples/episode.example.json", import.meta.url),
    ),
    "utf8",
  ),
) as EpisodeDocument;

describe("content trust boundary", () => {
  it("does not allow placeholder review identities or asset hashes to publish", () => {
    const invalid = structuredClone(example);
    invalid.review.status = "approved";
    invalid.safety.reviewed = true;
    const result = validateEpisodeGraph(invalid, { forPublication: true });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing_science_reviewer");
    expect(result.errors).toContain("missing_child_safety_reviewer");
    expect(
      result.errors.some((error) =>
        error.startsWith("placeholder_asset_hash:"),
      ),
    ).toBe(true);
  });
});

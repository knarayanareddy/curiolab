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

describe("episode graph validation", () => {
  it("accepts the draft graph for development, not publication", () => {
    expect(validateEpisodeGraph(example)).toEqual({ valid: true, errors: [] });
    const publication = validateEpisodeGraph(example, { forPublication: true });
    expect(publication.valid).toBe(false);
    expect(publication.errors).toContain(
      "publication_requires_approved_review",
    );
    expect(publication.errors).toContain("publication_requires_safety_review");
    expect(publication.errors).toContain("placeholder_graph_hash");
  });

  it("rejects duplicate IDs and missing references", () => {
    const invalid = structuredClone(example);
    invalid.nodes[1]!.id = invalid.nodes[0]!.id;
    invalid.nodes[0]!.next = "node_missing";
    const result = validateEpisodeGraph(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("duplicate_node_id");
    expect(result.errors).toContain("missing_node_reference:node_problem");
  });

  it("rejects unreachable nodes and unbounded cycles", () => {
    const unreachable = structuredClone(example);
    unreachable.start_node_id = "node_end";
    expect(validateEpisodeGraph(unreachable).errors).toContain(
      "unreachable_node:node_problem",
    );

    const cycle = structuredClone(example);
    cycle.nodes[cycle.nodes.length - 2]!.next = "node_problem";
    expect(validateEpisodeGraph(cycle).errors).toContain(
      "unbounded_graph_cycle",
    );
  });

  it("rejects missing learning and instruction references", () => {
    const invalid = structuredClone(example);
    invalid.learning_objectives[0]!.assessment_node_id = "node_absent";
    invalid.nodes.find((node) => node.type === "lab")!.instruction_asset_id =
      "asset_absent";
    const result = validateEpisodeGraph(invalid);
    expect(result.errors).toContain("missing_learning_assessment_node");
    expect(result.errors).toContain("missing_instruction_asset:node_flat_lab");
  });
});

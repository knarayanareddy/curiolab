import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export interface EpisodeNode {
  id: string;
  type: "scene" | "prediction" | "lab" | "branch" | "end";
  next?: string;
  default?: string;
  cases?: Array<{
    next: string;
    operator?: string;
    left?: string;
    right?: unknown;
  }>;
  instruction_asset_id?: string;
}

export interface EpisodeDocument {
  start_node_id: string;
  nodes: EpisodeNode[];
  assets: Array<{ asset_id: string; sha256: string }>;
  learning_objectives: Array<{ assessment_node_id: string }>;
  safety: { reviewed: boolean };
  review: {
    status: "draft" | "approved";
    science_reviewer: string;
    child_safety_reviewer: string;
    graph_sha256: string;
  };
}

export interface ContentValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEpisodeSchema(
  schema: object,
  document: unknown,
): ContentValidationResult {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(document);
  return {
    valid,
    errors: valid
      ? []
      : (validate.errors ?? []).map(
          (error) =>
            `${error.instancePath || "/"} ${error.message ?? "invalid"}`,
        ),
  };
}

function outgoingReferences(node: EpisodeNode): string[] {
  return [
    ...(node.next ? [node.next] : []),
    ...(node.default ? [node.default] : []),
    ...(node.cases ?? []).map((branch) => branch.next),
  ];
}

export function validateEpisodeGraph(
  document: EpisodeDocument,
  options: { forPublication: boolean } = { forPublication: false },
): ContentValidationResult {
  const errors = new Set<string>();
  const nodeIds = document.nodes.map((node) => node.id);
  const uniqueIds = new Set(nodeIds);
  if (uniqueIds.size !== nodeIds.length) errors.add("duplicate_node_id");
  const byId = new Map(document.nodes.map((node) => [node.id, node]));
  if (!byId.has(document.start_node_id)) errors.add("missing_start_node");

  for (const node of document.nodes) {
    for (const reference of outgoingReferences(node)) {
      if (!byId.has(reference)) errors.add(`missing_node_reference:${node.id}`);
    }
    if (
      node.instruction_asset_id &&
      !document.assets.some(
        (asset) => asset.asset_id === node.instruction_asset_id,
      )
    ) {
      errors.add(`missing_instruction_asset:${node.id}`);
    }
  }
  for (const objective of document.learning_objectives) {
    if (!byId.has(objective.assessment_node_id))
      errors.add("missing_learning_assessment_node");
  }

  const reachable = new Set<string>();
  const queue = byId.has(document.start_node_id)
    ? [document.start_node_id]
    : [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = byId.get(id);
    if (node) queue.push(...outgoingReferences(node));
  }
  for (const id of uniqueIds) {
    if (!reachable.has(id)) errors.add(`unreachable_node:${id}`);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function hasCycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const node = byId.get(id);
    const cycle = node
      ? outgoingReferences(node).some(
          (next) => byId.has(next) && hasCycle(next),
        )
      : false;
    visiting.delete(id);
    visited.add(id);
    return cycle;
  }
  if (byId.has(document.start_node_id) && hasCycle(document.start_node_id))
    errors.add("unbounded_graph_cycle");

  if (options.forPublication) {
    if (document.review.status !== "approved")
      errors.add("publication_requires_approved_review");
    if (!document.safety.reviewed)
      errors.add("publication_requires_safety_review");
    if (!document.review.science_reviewer.trim())
      errors.add("missing_science_reviewer");
    if (!document.review.child_safety_reviewer.trim())
      errors.add("missing_child_safety_reviewer");
    if (new Set(document.review.graph_sha256).size <= 1)
      errors.add("placeholder_graph_hash");
    for (const asset of document.assets) {
      if (new Set(asset.sha256).size <= 1)
        errors.add(`placeholder_asset_hash:${asset.asset_id}`);
    }
  }
  return { valid: errors.size === 0, errors: [...errors].sort() };
}

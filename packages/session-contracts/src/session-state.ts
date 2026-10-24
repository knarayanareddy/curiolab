export interface CommittedSnapshot {
  current_node_id: string;
  content_version: string;
  state_sequence: number;
  predictions: { flat_winner?: string; folded_change?: string };
  measurements: { flat_load?: number; folded_load?: number };
}
export function exactKeys(
  value: unknown,
  required: string[],
  optional: string[] = [],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    required.some((k) => !Object.hasOwn(value, k)) ||
    Object.keys(value).some((k) => ![...required, ...optional].includes(k))
  )
    throw new Error("invalid_fields");
}
export function validateSnapshot(
  value: unknown,
): asserts value is CommittedSnapshot {
  exactKeys(value, [
    "current_node_id",
    "content_version",
    "state_sequence",
    "predictions",
    "measurements",
  ]);
  if (
    typeof value.current_node_id !== "string" ||
    !/^node_[a-z_]{1,60}$/.test(value.current_node_id) ||
    typeof value.content_version !== "string" ||
    value.content_version.length > 32 ||
    !/^\d+\.\d+\.\d+$/.test(value.content_version) ||
    !Number.isSafeInteger(value.state_sequence) ||
    Number(value.state_sequence) < 0
  )
    throw new Error("invalid_snapshot");
  exactKeys(value.predictions, [], ["flat_winner", "folded_change"]);
  exactKeys(value.measurements, [], ["flat_load", "folded_load"]);
  for (const [key, options] of [
    ["flat_winner", ["flat", "folded", "same", "unsure"]],
    ["folded_change", ["more", "fewer", "same", "unsure"]],
  ] as const)
    if (
      value.predictions[key] !== undefined &&
      !options.includes(value.predictions[key] as never)
    )
      throw new Error("invalid_prediction");
  for (const [measurement, prediction] of [
    ["flat_load", "flat_winner"],
    ["folded_load", "folded_change"],
  ] as const) {
    const count = value.measurements[measurement];
    if (
      count !== undefined &&
      (!Number.isInteger(count) ||
        Number(count) < 0 ||
        Number(count) > 30 ||
        value.predictions[prediction] === undefined)
    )
      throw new Error("unconfirmed_snapshot_measurement");
  }
}

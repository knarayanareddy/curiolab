export const EPISODE_STAGES = [
  "SAFETY_AND_CONSENT",
  "FLAT_PREDICTION",
  "FLAT_LAB",
  "FLAT_CONFIRMATION",
  "FOLDED_PREDICTION",
  "FOLDED_LAB",
  "FOLDED_CONFIRMATION",
  "COMPARISON",
  "REFLECTION",
  "COMPLETE",
] as const;
export type EpisodeStage = (typeof EPISODE_STAGES)[number];
export type NarrativeBranch = "GREATER" | "EQUAL" | "LOWER";
/** Returned by the actual local Kotlin coordinator, never a renderer-owned state machine. */
export interface SimulatorState {
  stage: EpisodeStage;
  sequence: number;
  flat: number | null;
  folded: number | null;
  stopped: number | null;
  comparison: NarrativeBranch | null;
  predictions?: { flat_winner?: string; folded_change?: string };
  perception: string;
  observed: number;
  accessibility_mode?: "standard" | "reduced_motion" | "no_timing";
}

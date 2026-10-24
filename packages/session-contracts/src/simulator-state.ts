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
  local_services?: { status: string; provenance: "local-fixture" };
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
export type SimulatorReply =
  | SimulatorState
  | { error: string }
  | { deleted: true };
export interface SimulatorTransport {
  request(
    session: string,
    command: string,
    args?: string[],
  ): Promise<SimulatorReply>;
}
export function validateSimulatorCommand(
  session: string,
  command: string,
  args: string[],
): void {
  if (
    !/^[a-f0-9-]{36}$/.test(session) ||
    ![
      "state",
      "begin",
      "predict",
      "observe",
      "stop",
      "confirm",
      "manual",
      "compare",
      "reflect",
      "delete",
    ].includes(command) ||
    args.length > 12 ||
    !args.every(
      (arg) =>
        typeof arg === "string" && arg.length <= 80 && !/[\t\r\n]/.test(arg),
    )
  )
    throw new Error("invalid_simulator_command");
}

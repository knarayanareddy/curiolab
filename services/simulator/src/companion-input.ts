import { kotlinObservationArgs } from "../../../packages/perception/src/kotlin-observation.js";
import type { ObservationSnapshot } from "../../../packages/perception/src/index.js";
import type { RelayMessage } from "../../../packages/session-contracts/src/relay-client.js";
import type { SimulatorState } from "../../../packages/session-contracts/src/simulator-state.js";
import type { CommittedSnapshot } from "../../../packages/session-contracts/src/session-state.js";
import { KotlinSimulatorEngine, type SimulatorReply } from "./kotlin-engine.js";
/** LOCAL fixture bridge, not a deployed/native relay consumer.
 * The restricted wire status omits calibration/stability metadata. A fixture must provide
 * the actual tracker snapshot separately; never invent those metrics from a status string.
 * Requires already authenticated/validated relay messages. No raw detections/media.
 */
export class SimulatorCompanionInput {
  private candidate: RelayMessage | undefined;
  constructor(
    private readonly engine: KotlinSimulatorEngine,
    private readonly session: string,
    private readonly observationForFrame: (
      trial: string,
      frame: number,
    ) => ObservationSnapshot | undefined,
  ) {}
  async receive(message: RelayMessage): Promise<SimulatorReply | undefined> {
    if (message.session_id !== this.session)
      throw new Error("companion_session_mismatch");
    const p = message.payload;
    if (message.type === "observation.candidate") {
      if (
        this.candidate &&
        this.candidate.payload.trial === p.trial &&
        Number(p.frame_sequence) <=
          Number(this.candidate.payload.frame_sequence)
      )
        return undefined;
      const observation = this.observationForFrame(
        String(p.trial),
        Number(p.frame_sequence),
      );
      if (
        !observation ||
        observation.trial !== p.trial ||
        observation.frame_sequence !== p.frame_sequence ||
        observation.stable_count !== p.observed_count ||
        observation.confidence !== p.confidence ||
        (observation.status === "observing"
          ? "calibrated"
          : observation.status) !== p.calibration
      )
        throw new Error("simulator_frame_context_mismatch");
      const reply = await this.engine.request(
        this.session,
        "observe",
        kotlinObservationArgs(observation),
      );
      if (!("error" in reply)) this.candidate = message;
      return reply;
    }
    if (message.type === "observation.stopped") {
      if (
        !this.candidate ||
        this.candidate.payload.trial !== p.trial ||
        this.candidate.payload.observed_count !== p.last_stable_count ||
        p.stop_reason !== "adult_marked_stop"
      )
        throw new Error("stop_requires_matching_stable_observation");
      return this.engine.request(this.session, "stop", [
        String(p.trial).toUpperCase(),
        String(p.last_stable_count),
      ]);
    }
    return undefined;
  }
}
/** Projection only: values/predictions come from the Kotlin engine, not the UI/relay. */
export function committedRelaySnapshot(
  state: SimulatorState,
): CommittedSnapshot {
  const nodes: Record<SimulatorState["stage"], string> = {
    SAFETY_AND_CONSENT: "node_problem",
    FLAT_PREDICTION: "node_flat_prediction",
    FLAT_LAB: "node_flat_lab",
    FLAT_CONFIRMATION: "node_flat_lab",
    FOLDED_PREDICTION: "node_folded_prediction",
    FOLDED_LAB: "node_folded_lab",
    FOLDED_CONFIRMATION: "node_folded_lab",
    COMPARISON: "node_comparison",
    REFLECTION: "node_reflection",
    COMPLETE: "node_end",
  };
  return {
    current_node_id: nodes[state.stage],
    content_version: "0.1.0",
    state_sequence: state.sequence,
    predictions: { ...state.predictions },
    measurements: {
      ...(state.flat !== null ? { flat_load: state.flat } : {}),
      ...(state.folded !== null ? { folded_load: state.folded } : {}),
    },
  };
}

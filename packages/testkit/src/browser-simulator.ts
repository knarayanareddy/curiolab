import {
  validateSimulatorCommand,
  type SimulatorTransport,
  type SimulatorReply,
} from "../../session-contracts/src/simulator-state.js";
/** Synthetic/manual-input sandbox; domain decisions execute in the actual Kotlin/JS core. */
export class BrowserSimulator implements SimulatorTransport {
  constructor(private readonly protocol: (line: string) => string) {}
  async request(
    session: string,
    command: string,
    args: string[] = [],
  ): Promise<SimulatorReply> {
    validateSimulatorCommand(session, command, args);
    return JSON.parse(
      this.protocol([session, command, ...args].join("\t")),
    ) as SimulatorReply;
  }
}

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { SimulatorState } from "../../../packages/session-contracts/src/simulator-state.js";
export type SimulatorReply =
  | SimulatorState
  | { error: string }
  | { deleted: true };
/** Owns one real Kotlin coordinator process. No simulated state transitions. */
export class KotlinSimulatorEngine {
  private readonly engine;
  private readonly lines;
  private readonly pending: Array<{
    resolve: (value: SimulatorReply) => void;
    reject: (error: Error) => void;
  }> = [];
  private healthy = true;
  constructor(jar = "build/episode-engine.jar") {
    const java = process.env.JAVA_HOME
      ? join(process.env.JAVA_HOME, "bin/java")
      : "java";
    this.engine = spawn(
      java,
      ["-cp", jar, "com.curiolab.episode.SimulatorBridge"],
      { stdio: ["pipe", "pipe", "inherit"] },
    );
    this.lines = createInterface({ input: this.engine.stdout });
    this.lines.on("line", (line) => {
      const job = this.pending.shift();
      try {
        job?.resolve(JSON.parse(line) as SimulatorReply);
      } catch {
        job?.reject(new Error("invalid_engine_reply"));
        this.close();
      }
    });
    this.engine.on("error", () => this.fail());
    this.engine.on("exit", () => this.fail());
    this.engine.stdin.on("error", () => this.fail());
  }
  get ready(): boolean {
    return this.healthy;
  }
  private fail(): void {
    this.healthy = false;
    for (const job of this.pending.splice(0))
      job.reject(new Error("engine_unavailable"));
  }
  request(
    session: string,
    command: string,
    args: string[] = [],
  ): Promise<SimulatorReply> {
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
      return Promise.reject(new Error("invalid_simulator_command"));
    if (!this.healthy || this.pending.length >= 20)
      return Promise.reject(new Error("engine_unavailable"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.close(), 5000);
      this.pending.push({
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.engine.stdin.write(`${[session, command, ...args].join("\t")}\n`);
    });
  }
  close(): void {
    this.fail();
    this.lines.close();
    this.engine.kill();
  }
}

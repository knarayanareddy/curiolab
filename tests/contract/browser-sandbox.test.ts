import { beforeAll, afterAll, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { KotlinSimulatorEngine } from "../../services/simulator/src/kotlin-engine.js";
import { BrowserSimulator } from "../../packages/testkit/src/browser-simulator.js";
import { simulatorRequest } from "../../apps/firetv/src/generated/engine.mjs";
let jvm: KotlinSimulatorEngine;
const browser = new BrowserSimulator(simulatorRequest);
beforeAll(async () => {
  // Separate artifact from the concurrently running JVM lifecycle contract suite.
  await promisify(execFile)("bash", ["scripts/kotlin.sh", "build"], {
    env: {
      ...process.env,
      KOTLIN_BUILD_JAR: `${process.cwd()}/build/browser-parity.jar`,
    },
    timeout: 90000,
  });
  jvm = new KotlinSimulatorEngine("build/browser-parity.jar");
}, 100000);
afterAll(() => jvm?.close());
it.each([
  [3, 7, "standard"],
  [4, 4, "reduced_motion"],
  [6, 2, "no_timing"],
  [0, 30, "standard"],
  [30, 0, "standard"],
  [0, 0, "no_timing"],
  [30, 30, "reduced_motion"],
] as const)(
  "browser Kotlin and JVM agree for %s/%s (%s), including invalid/replayed input",
  async (flat, folded, mode) => {
    const id = randomUUID();
    const send = async (command: string, args: string[] = []) => {
      const result = await browser.request(id, command, args);
      expect(result).toEqual(await jvm.request(id, command, args));
      return result;
    };
    try {
      expect(await send("predict", ["FLAT", "folded"])).toHaveProperty("error");
      expect(
        await send("begin", [
          "true",
          "false",
          "true",
          "true",
          "false",
          "COMPANION",
          "GRANTED",
          mode,
        ]),
      ).toHaveProperty("error");
      await send("begin", [
        "true",
        "true",
        "true",
        "true",
        "false",
        "COMPANION",
        "GRANTED",
        mode,
      ]);
      for (const [trial, coins] of [
        ["FLAT", flat],
        ["FOLDED", folded],
      ] as const) {
        await send("predict", [trial, trial === "FLAT" ? "folded" : "more"]);
        await send("observe", [
          trial,
          "0",
          "5",
          "0.9",
          "500",
          "0,1,2",
          "2",
          "0",
          "OBSERVING",
        ]);
        expect(await send("stop", [trial, "5"])).toHaveProperty("error");
        await send("observe", [
          trial,
          "1",
          "5",
          "0.5",
          "500",
          "0,1,2,3",
          "2",
          "0",
          "OBSERVING",
        ]);
        expect(await send("stop", [trial, "5"])).toHaveProperty("error");
        await send("observe", [
          trial,
          "2",
          "5",
          "0.9",
          "0",
          "0,1,2,3",
          "2",
          "0",
          "OBSERVING",
        ]);
        expect(await send("stop", [trial, "5"])).toHaveProperty("error");
        await send("observe", [
          trial,
          "3",
          "5",
          "0.9",
          "500",
          "0,1,2,3",
          "2",
          "0",
          "OBSERVING",
        ]);
        await send("observe", [
          trial,
          "2",
          "4",
          "0.9",
          "500",
          "0,1,2,3",
          "2",
          "0",
          "OBSERVING",
        ]); // Stale.
        await send("stop", [trial, "5"]);
        expect(await send("confirm", [trial, "31"])).toHaveProperty("error");
        await send("confirm", [trial, String(coins)]);
        await send("confirm", [trial, String(coins)]);
      }
      expect(await send("state")).toMatchObject({
        flat,
        folded,
        comparison:
          folded > flat ? "GREATER" : folded < flat ? "LOWER" : "EQUAL",
      });
      await send("compare");
      expect(await send("reflect", ["unapproved"])).toHaveProperty("error");
      await send("reflect", ["shape_can_matter"]);
      await send("reflect", ["shape_can_matter"]);
    } finally {
      await send("delete");
    }
  },
);
it("browser sandbox rejects protocol injection and non-authored commands", async () => {
  await expect(
    browser.request(randomUUID(), "begin", ["true\nstate"]),
  ).rejects.toThrow("invalid_simulator_command");
  await expect(
    browser.request(randomUUID(), "generated-scene"),
  ).rejects.toThrow("invalid_simulator_command");
});

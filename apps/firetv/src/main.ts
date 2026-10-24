import { mountViewModes } from "./view-modes";
import { BrowserSimulator } from "../../../packages/testkit/src/browser-simulator";
import { renderEpisodeScene } from "./scene";
import {
  EPISODE_STAGES,
  type SimulatorState,
} from "../../../packages/session-contracts/src/simulator-state";
import { browserRemoteIntent } from "../../../packages/voice/src/push-to-talk";
import {
  evaluateCalibration,
  StableCoinCounter,
} from "../../../packages/perception/src/index";
import { kotlinObservationArgs } from "../../../packages/perception/src/kotlin-observation";
import "./style.css";
import { ModelGateway } from "../../../packages/model-gateway/src/index";
import tokens from "../../../ui/tokens.json";
for (const [key, token] of Object.entries(tokens.color))
  document.documentElement.style.setProperty(`--${key}`, token.$value);
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><a href="/" class="brand">◒ <span>curio<span class="gold">lab</span></span></a><span class="pill">LOCAL TV SIMULATOR · KOTLIN ENGINE</span><span class="connection">● Manual play · no cloud</span></header>
<main><aside><span class="eyebrow">EPISODE 01 · FAMILY SCIENCE</span><h1>The Bridge<br>to <span class="gold">Moon Base</span></h1><p class="intro">A small experiment.<br>A new way to see the world.</p><figure id="episode-canvas" class="episode-canvas" aria-labelledby="scene-caption"></figure><div class="progress"><span id="step-label">MISSION CHECKLIST</span><div id="progress-bar"></div></div><p class="remote">↑ ↓ ← → Move &nbsp; · &nbsp; Enter Select<br>Tab also works. No timed actions.</p></aside>
<section class="panel" aria-labelledby="screen-title"><div class="panel-top"><span class="eyebrow" id="chapter">BEFORE WE BEGIN</span><span id="step">01 / 10</span></div><h2 id="screen-title" tabindex="-1">Adult launch checklist</h2><p id="description"></p><div id="content"></div><p id="error" role="alert"></p><div id="actions"></div><p class="caption" id="caption">An adult stays with the experiment. Every observation is confirmed by your family.</p></section></main><footer><span>DESIGNED FOR CURIOUS MINDS, AGES 7–11 + AN ADULT</span><button id="hint" class="subtle">Need a hint?</button><button id="restart" class="subtle">Clear this session</button></footer><div id="hint-text" role="status" class="hint" hidden></div>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const sandbox =
  import.meta.env.MODE === "pages" ||
  new URLSearchParams(location.search).get("sandbox") === "1";
// Lazy-load the actual compiled Kotlin core only for the explicit browser sandbox.
const browserEngine = sandbox
  ? import("./generated/engine.mjs").then(
      (module) => new BrowserSimulator(module.simulatorRequest),
    )
  : undefined;
if (sandbox) {
  el("caption").textContent =
    "BROWSER SANDBOX · Synthetic observations, not a physical experiment. Confirm counts to drive the story.";
  document.querySelector(".pill")!.textContent =
    "BROWSER SANDBOX · KOTLIN/JS · SYNTHETIC INPUT";
  document.querySelector(".connection")!.textContent =
    "In-memory · no server / camera / cloud";
}
document.querySelector<HTMLAnchorElement>(".brand")!.href =
  import.meta.env.BASE_URL ?? "/";
const disposeViewModes = mountViewModes(app, import.meta.env.BASE_URL ?? "/");
let state: SimulatorState;
let session = crypto.randomUUID();
let busy = false;
let count = 0;
let camera = false;
let frame = 0;
const gateway = new ModelGateway();
const stages = EPISODE_STAGES;
async function requestServer(session: string, command: string, args: string[]) {
  const response = await fetch("/api/episode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session, command, args }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new Error(
      "The simulator is unavailable. Check the local server, then retry. Your last screen is unchanged.",
    );
  return response.json();
}
async function action(command: string, args: string[] = []) {
  if (busy) return;
  busy = true;
  el("error").textContent = "";
  app.setAttribute("aria-busy", "true");
  try {
    const result = browserEngine
      ? await (await browserEngine).request(session, command, args)
      : await requestServer(session, command, args);
    if ("error" in result) throw new Error(result.error);
    if (command === "delete") return;
    state = result as SimulatorState;
    if (state.local_services)
      document.querySelector(".connection")!.textContent =
        state.local_services.status === "ready"
          ? "Local relay + draft content · no AWS"
          : "Local relay offline · manual continues";
    if (state.accessibility_mode)
      document.documentElement.dataset.motion = state.accessibility_mode;
    count = state.stopped ?? 0;
    render();
  } catch (error) {
    el("error").textContent =
      error instanceof Error ? error.message : "Action unavailable; retry.";
    if (!el("retry")) {
      const retry = button(
        "Reload current step",
        () => void action("state"),
        "actions",
        true,
      );
      retry.id = "retry";
    }
  } finally {
    busy = false;
    app.setAttribute("aria-busy", "false");
  }
}
export const refreshEpisode = () => action("state");
function button(
  label: string,
  run: () => void,
  parent = "actions",
  secondary = false,
) {
  const button = document.createElement("button");
  button.textContent = label;
  if (secondary) button.className = "secondary";
  button.onclick = run;
  el(parent).append(button);
  return button;
}
function check(id: string, label: string) {
  const row = document.createElement("label");
  row.className = "check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  const text = document.createElement("span");
  text.textContent = label;
  row.append(input, text);
  el("content").append(row);
}
function select(id: string, label: string, options: [string, string][]) {
  const row = document.createElement("label");
  row.className = "select";
  row.textContent = label;
  const select = document.createElement("select");
  select.id = id;
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  row.append(select);
  el("content").append(row);
}
function paragraph(text: string, className = "") {
  const p = document.createElement("p");
  p.textContent = text;
  p.className = className;
  el("content").append(p);
}
function counter(label: string, initial: number) {
  count = initial;
  const row = document.createElement("div");
  row.className = "counter";
  row.id = "counter";
  el("content").append(row);
  const display = document.createElement("output");
  display.setAttribute("aria-live", "polite");
  const update = () => {
    display.textContent = `${count} coins`;
  };
  button(
    "−",
    () => {
      count = Math.max(0, count - 1);
      update();
    },
    "counter",
    true,
  );
  row.append(display);
  button(
    "+",
    () => {
      count = Math.min(30, count + 1);
      update();
    },
    "counter",
    true,
  );
  display.setAttribute("aria-label", label);
  update();
}
function render() {
  renderEpisodeScene(el("episode-canvas"), state);
  el("hint-text").hidden = true;
  el("content").replaceChildren();
  el("actions").replaceChildren();
  const index = stages.indexOf(state.stage);
  const folded = state.stage.startsWith("FOLDED");
  const trial = folded ? "FOLDED" : "FLAT";
  el("step").textContent = `${String(index + 1).padStart(2, "0")} / 10`;
  el("progress-bar").style.setProperty("--progress", `${(index + 1) * 10}%`);
  el("chapter").textContent =
    index === 0
      ? "BEFORE WE BEGIN"
      : `YOUR MISSION · ${folded ? "FOLDED" : "FLAT"} PAPER`;
  el("description").textContent = "";
  el<HTMLButtonElement>("hint").disabled = !Object.hasOwn(
    { FLAT_LAB: 1, FOLDED_LAB: 1, FLAT_PREDICTION: 1, FOLDED_PREDICTION: 1 },
    state.stage,
  );
  switch (state.stage) {
    case "SAFETY_AND_CONSENT":
      el("screen-title").textContent = "Adult launch checklist";
      el("description").textContent =
        "A few important checks before your family heads to the Moon.";
      check(
        "adult",
        "I am the supervising adult and agree to this experiment.",
      );
      check(
        "privacy",
        sandbox
          ? "I understand: this is synthetic browser play, not a real camera or experiment. No child account, name, video or audio is collected. State stays in this tab until cleared or reloaded."
          : "I understand: no child account, name, raw video or continuous audio is collected. This local session lives in server memory until cleared or restarted.",
      );
      check(
        "safety",
        "Use a stable low table, identical paper and coins, two equal-height books 150 mm apart. No glass, heavy objects, throwing or climbing.",
      );
      check(
        "objects",
        "I will supervise small coins: keep them out of mouths and away from younger children.",
      );
      select("camera", "Measurement mode", [
        ["MANUAL", "TV remote · no camera required"],
        ["COMPANION", "Camera states · fictional input simulator"],
      ]);
      select("permission", "Companion camera permission (simulated)", [
        ["NOT_REQUESTED", "Not requested"],
        ["GRANTED", "Granted · fixture only"],
        ["DENIED", "Denied · choose manual"],
        ["UNAVAILABLE", "Unavailable · choose manual"],
      ]);
      select("accessibility", "Comfort settings", [
        ["standard", "Standard · captions always visible"],
        ["reduced_motion", "Reduced motion"],
        ["no_timing", "No timing"],
      ]);
      paragraph(
        "Analytics is off. No analytics events are emitted by this simulator.",
        "note",
      );
      button("All set — begin our mission →", () => {
        camera = el<HTMLSelectElement>("camera").value === "COMPANION";
        const mode = el<HTMLSelectElement>("accessibility").value;
        document.documentElement.dataset.motion = mode;
        void action(
          "begin",
          ["adult", "privacy", "safety", "objects"]
            .map((id) => String(el<HTMLInputElement>(id).checked))
            .concat([
              "false",
              camera ? "COMPANION" : "MANUAL",
              el<HTMLSelectElement>("permission").value,
              mode,
            ]),
        );
      });
      break;
    case "FLAT_PREDICTION":
    case "FOLDED_PREDICTION": {
      el("screen-title").textContent = folded
        ? "What will folding change?"
        : "Which bridge will hold more?";
      paragraph(
        folded
          ? `Your flat bridge held ${state.flat} coins. Keep everything the same except the paper’s shape.`
          : "Our Moon Base needs a supply bridge. First compare a flat paper bridge with a folded one. Make a prediction before testing.",
      );
      const choices = folded
        ? [
            ["more", "More coins"],
            ["fewer", "Fewer coins"],
            ["same", "The same"],
            ["unsure", "I’m not sure yet"],
          ]
        : [
            ["flat", "Flat paper"],
            ["folded", "Folded paper"],
            ["same", "The same"],
            ["unsure", "I’m not sure yet"],
          ];
      for (const [value, label] of choices)
        button(
          label!,
          () => void action("predict", [trial, value!]),
          "actions",
          true,
        );
      break;
    }
    case "FLAT_LAB":
    case "FOLDED_LAB": {
      el("screen-title").textContent = folded
        ? "Test your folded bridge"
        : "Test your flat bridge";
      paragraph(
        "1. Place the paper across the marked supports, 150 mm apart. Start with an empty load zone.",
      );
      paragraph(
        "2. Add one identical coin at a time. Wait at least 500 ms for each coin to settle.",
      );
      paragraph(
        "3. Adult: mark stop when the bridge collapses, or whenever you decide to stop.",
      );
      counter(
        camera ? "Fictional observed coins" : "Manual coins at stop",
        camera ? state.observed : 0,
      );
      if (camera) {
        paragraph(
          `FICTIONAL COMPANION INPUT · ${state.perception} · observed ${state.observed}`,
          "note",
        );
        const observeFixture = (kind: "stable" | "missing" | "review") => {
          const tracker = new StableCoinCounter(
            folded ? "folded" : "flat",
            evaluateCalibration({
              markerIds:
                kind === "missing" ? ["0", "1", "2"] : ["0", "1", "2", "3"],
              reprojectionErrorPx: 2,
              loadZoneOccludedMs: 0,
            }),
          );
          const detections = Array.from({ length: count }, (_, i) => ({
            detectionId: `fixture-${i}`,
            center: { x: i * 40, y: 100 },
            confidence: 0.9,
          }));
          tracker.observe({
            frameSequence: ++frame,
            timestampMs: frame * 1000,
            detections,
          });
          const snapshot = tracker.observe({
            frameSequence: ++frame,
            timestampMs: frame * 1000,
            detections,
            overlap: kind === "review",
          });
          void action("observe", kotlinObservationArgs(snapshot));
        };
        button(
          "Fixture: aligned + stable",
          () => observeFixture("stable"),
          "actions",
          true,
        );
        button(
          "Fixture: missing marker",
          () => observeFixture("missing"),
          "actions",
          true,
        );
        button(
          "Fixture: needs review",
          () => observeFixture("review"),
          "actions",
          true,
        );
        button(
          "Use TV remote instead",
          () => {
            camera = false;
            void action("manual");
          },
          "actions",
          true,
        );
      }
      button(
        "Adult: mark stop →",
        () => void action("stop", [trial, String(count)]),
      );
      break;
    }
    case "FLAT_CONFIRMATION":
    case "FOLDED_CONFIRMATION":
      el("screen-title").textContent = "Does this match your count?";
      paragraph(
        `Stopped count: ${state.stopped} coins. Check together, then confirm or correct. Nothing is used in the story until your family confirms.`,
      );
      counter("Family confirmed coins", state.stopped ?? 0);
      button(
        "Confirm our measurement →",
        () => void action("confirm", [trial, String(count)]),
      );
      break;
    case "COMPARISON":
    case "COMPLETE": {
      el("chapter").textContent = "MISSION FINDINGS";
      el("screen-title").textContent =
        state.stage === "COMPLETE"
          ? "A little test. A real discovery."
          : `Folded held ${state.comparison === "GREATER" ? "more" : state.comparison === "LOWER" ? "fewer" : "the same number of"} coins`;
      paragraph(
        `FLAT PAPER   ${state.flat} coins     /     FOLDED PAPER   ${state.folded} coins`,
        "result",
      );
      paragraph(
        "These are your family’s actual confirmed counts. One comparison is an observation, not a universal scientific law.",
      );
      const supplies = document.createElement("div");
      supplies.className = "supplies";
      supplies.setAttribute(
        "aria-label",
        `${state.folded} measured supply crates; illustration capped at 12`,
      );
      for (let i = 0; i < Math.min(state.folded ?? 0, 12); i++) {
        const crate = document.createElement("span");
        crate.textContent = "▣";
        supplies.append(crate);
      }
      el("content").append(supplies);
      paragraph(
        "What would you change next time? Repeat with just one changed condition, keeping the other conditions the same.",
      );
      if (state.stage === "COMPARISON")
        button("Reflect on our experiment →", () => void action("compare"));
      break;
    }
    case "REFLECTION":
      el("screen-title").textContent = "What did you notice?";
      paragraph(
        "Did the result match your prediction? Folding changes paper’s shape and can change how it carries a load. We need repeated tests to learn more.",
      );
      button(
        "Shape can make a difference",
        () => void action("reflect", ["shape_can_matter"]),
      );
      button(
        "I’d like to test again",
        () => void action("reflect", ["not_sure"]),
        "actions",
        true,
      );
      break;
  }
  if (!app.hidden) el("screen-title").focus();
}
el("hint").onclick = async () => {
  const hint = await gateway.hint({ nodeId: state.stage, attempt: 0 });
  el("hint-text").hidden = false;
  el("hint-text").textContent = `Authored hint · ${hint.text}`;
};
el("hint-text").onclick = () => {
  el("hint-text").hidden = true;
};
el("restart").onclick = async () => {
  if (!confirm("Clear this local session and all its measurements?")) return;
  await action("delete");
  session = crypto.randomUUID();
  camera = false;
  frame = 0;
  await action("state");
};
const backSheet = document.createElement("div");
backSheet.id = "back-sheet";
backSheet.className = "back-sheet";
backSheet.hidden = true;
backSheet.setAttribute("role", "dialog");
backSheet.setAttribute("aria-modal", "true");
backSheet.setAttribute("aria-labelledby", "back-title");
backSheet.innerHTML = `<section><h2 id="back-title">Pause here</h2><p>Your confirmed measurements stay unchanged while ${sandbox ? "this tab stays open" : "this local server is running"}.</p><button id="back-continue">Return to episode</button> <button id="back-clear" class="secondary">Clear this session</button></section>`;
app.append(backSheet);
let returnFocus: HTMLElement | null = null;
function closeBackSheet() {
  backSheet.hidden = true;
  for (const region of document.querySelectorAll("header,main,footer"))
    region.removeAttribute("inert");
  returnFocus?.focus();
}
el("back-continue").onclick = closeBackSheet;
el("back-clear").onclick = () => {
  closeBackSheet();
  el<HTMLButtonElement>("restart").click();
};
function handleRemoteKeydown(event: KeyboardEvent) {
  if (
    app.hidden ||
    (event.target instanceof Element && event.target.closest("#view-modes"))
  )
    return;
  const intent = browserRemoteIntent(event.key, event.repeat);
  if (!intent) {
    if (event.repeat && ["Enter", "Escape", "BrowserBack"].includes(event.key))
      event.preventDefault();
    return;
  }
  if (intent === "select") return; // Native button/input activation, never double-dispatch.
  if (intent === "back") {
    event.preventDefault();
    if (!el("hint-text").hidden) {
      el("hint-text").hidden = true;
      el("hint").focus();
      return;
    }
    if (!backSheet.hidden) {
      closeBackSheet();
      return;
    }
    returnFocus = document.activeElement as HTMLElement;
    backSheet.hidden = false;
    for (const region of document.querySelectorAll("header,main,footer"))
      region.setAttribute("inert", "");
    el("back-continue").focus();
    return;
  }
  if (document.activeElement?.tagName === "SELECT") return;
  const items = Array.from(
    document.querySelectorAll<HTMLElement>(
      "button:not(:disabled),input,select,a",
    ),
  ).filter((item) => !item.closest("[hidden],[inert]"));
  const index = items.indexOf(document.activeElement as HTMLElement);
  event.preventDefault();
  items[
    (index + (intent === "up" || intent === "left" ? -1 : 1) + items.length) %
      items.length
  ]?.focus();
}
document.addEventListener("keydown", handleRemoteKeydown);
/** Unmount hook for host teardown and isolated DOM lifecycle tests. */
export function disposeEpisodeUI(): void {
  disposeViewModes();
  document.removeEventListener("keydown", handleRemoteKeydown);
}
void action("state");

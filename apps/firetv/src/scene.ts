import {
  EPISODE_STAGES,
  type SimulatorState,
  type NarrativeBranch,
} from "../../../packages/session-contracts/src/simulator-state";
export const VISUAL_CRATE_CAP = 12;
interface BridgeScene {
  trial: "flat" | "folded";
  count: number | null;
  collapsed: boolean;
}
export interface EpisodeScene {
  bridges: BridgeScene[];
  branch: NarrativeBranch | null;
  label: string;
  quiet: boolean;
}
/** Only committed measurements can become scene parameters. No observed/stopped/manual drafts. */
export function episodeScene(state: SimulatorState): EpisodeScene {
  const index = EPISODE_STAGES.indexOf(state.stage);
  if (index < 0) throw new Error("invalid_scene_stage");
  const flat = index >= 4 ? state.flat : null;
  const folded = index >= 7 ? state.folded : null;
  for (const count of [flat, folded])
    if (count !== null && (!Number.isInteger(count) || count < 0 || count > 30))
      throw new Error("invalid_confirmed_scene_count");
  const branch = index >= 7 ? state.comparison : null;
  if (
    (index >= 4 && flat === null) ||
    (index >= 7 && (folded === null || branch === null))
  )
    throw new Error("missing_confirmed_scene_state");
  if (branch !== null) {
    if (
      flat === null ||
      folded === null ||
      branch !== (folded > flat ? "GREATER" : folded < flat ? "LOWER" : "EQUAL")
    )
      throw new Error("inconsistent_coordinator_branch");
  }
  const bridges: BridgeScene[] = [
    { trial: "flat", count: flat, collapsed: flat !== null && flat > 0 },
  ];
  if (index >= 4)
    bridges.push({ trial: "folded", count: folded, collapsed: false });
  return {
    bridges,
    branch,
    quiet: state.stage.endsWith("CONFIRMATION") || index === 0,
    label: branch
      ? `Folded held ${branch === "GREATER" ? "more" : branch === "LOWER" ? "fewer" : "the same number of"} coins in this comparison.`
      : flat !== null
        ? "Flat trial confirmed. Change only the paper’s shape for the folded trial."
        : "Make a prediction, test the bridge, then confirm your family’s count.",
  };
}
const NS = "http://www.w3.org/2000/svg";
function svgElement(tag: string, attributes: Record<string, string | number>) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, String(value));
  return element;
}
function bridgeCard(scene: BridgeScene, animate: boolean): HTMLElement {
  const card = document.createElement("div");
  card.className = `bridge-card bridge-${scene.trial}${scene.collapsed ? " is-collapsed" : ""}${scene.count !== null ? " is-confirmed" : ""}`;
  card.dataset.trial = scene.trial;
  card.dataset.animate = String(animate);
  const title = document.createElement("h3");
  title.textContent = `${scene.trial === "flat" ? "Flat paper" : "Folded accordion"} · ${scene.count === null ? "awaiting confirmation" : `${scene.count} confirmed coins`}`;
  const graphic = svgElement("svg", {
    viewBox: "0 0 600 320",
    "aria-hidden": "true",
    focusable: "false",
    class: "bridge-graphic",
  });
  graphic.append(
    svgElement("path", {
      d: "M0 300 Q160 265 300 300 T600 295 L600 320 H0Z",
      class: "lunar-ground",
    }),
  );
  for (const x of [65, 465]) {
    graphic.append(
      svgElement("rect", {
        x,
        y: 225,
        width: 70,
        height: 65,
        rx: 6,
        class: "bridge-support",
      }),
    );
    graphic.append(
      svgElement("path", {
        d: `M${x + 7} 245h56m-56 20h56`,
        class: "support-lines",
      }),
    );
  }
  const paper = svgElement("g", { class: "paper-shape" });
  const sag = scene.count === null ? 0 : Math.min(scene.count, 30) * 0.7;
  card.style.setProperty("--sag", `${sag}px`);
  if (scene.trial === "flat") {
    for (const [name, d] of [
      ["paper-left", `M100 220 Q200 ${220 + sag} 300 ${220 + sag}`],
      ["paper-right", `M300 ${220 + sag} Q400 ${220 + sag} 500 220`],
    ])
      paper.append(svgElement("path", { d: d!, class: name! }));
  } else {
    const points = Array.from(
      { length: 21 },
      (_, i) => `${100 + i * 20},${i % 2 === 0 ? 220 : 198}`,
    ).join(" ");
    paper.append(svgElement("polyline", { points, class: "accordion-paper" }));
    paper.append(
      svgElement("path", { d: "M100 224H500", class: "accordion-base" }),
    );
  }
  const crates = svgElement("g", { class: "scene-crates" });
  for (let i = 0; i < Math.min(scene.count ?? 0, VISUAL_CRATE_CAP); i++) {
    const x = 214 + (i % 6) * 29;
    const y = 170 - Math.floor(i / 6) * 28;
    const crate = svgElement("g", {
      class: "scene-crate",
      "data-crate": i + 1,
    });
    crate.append(svgElement("rect", { x, y, width: 24, height: 24, rx: 3 }));
    crate.append(
      svgElement("path", { d: `M${x + 3} ${y + 3}l18 18m0-18l-18 18` }),
    );
    crates.append(crate);
  }
  graphic.append(paper, crates);
  card.append(title, graphic);
  return card;
}
/** Responsive SVG scene canvas. CSS owns finite transitions; final state never depends on a timer. */
export function renderEpisodeScene(
  host: HTMLElement,
  state: SimulatorState,
): void {
  const scene = episodeScene(state);
  const key = JSON.stringify({ ...scene, stage: state.stage });
  if (host.dataset.sceneKey === key) return; // A snapshot refresh must not replay choreography.
  const previousFlat = host.dataset.flatCount;
  const previousFolded = host.dataset.foldedCount;
  const previousBranch = host.dataset.branch;
  host.dataset.flatCount = String(scene.bridges[0]?.count ?? "pending");
  host.dataset.foldedCount = String(scene.bridges[1]?.count ?? "pending");
  host.dataset.branchEnter = String(previousBranch !== scene.branch);
  host.dataset.sceneKey = key;
  host.dataset.stage = state.stage;
  host.dataset.branch = scene.branch ?? "PENDING";
  host.dataset.quiet = String(scene.quiet);
  host.className = `episode-canvas${scene.branch ? ` resolution-${scene.branch.toLowerCase()}` : ""}`;
  const caption = document.createElement("p");
  caption.className = "scene-caption";
  caption.id = "scene-caption";
  caption.textContent = scene.label;
  const cards = document.createElement("div");
  cards.className = "bridge-cards";
  for (const bridge of scene.bridges)
    cards.append(
      bridgeCard(
        bridge,
        bridge.count !== null &&
          String(bridge.count) !==
            (bridge.trial === "flat" ? previousFlat : previousFolded),
      ),
    );
  const note = document.createElement("p");
  note.className = "scene-note";
  note.textContent =
    "Story illustration, not a physics simulation or detected collapse. Crate drawings are capped at 12; exact confirmed counts are always shown.";
  host.replaceChildren(caption, cards);
  if (scene.branch) {
    const feedback = document.createElement("div");
    feedback.className = "branch-feedback";
    feedback.dataset.branch = scene.branch;
    const symbol = document.createElement("span");
    symbol.className = "branch-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent =
      scene.branch === "GREATER" ? "↑" : scene.branch === "LOWER" ? "↓" : "=";
    const text = document.createElement("p");
    text.textContent = `${scene.branch}: flat ${state.flat} coins · folded ${state.folded} coins. One observation is not a universal law.`;
    feedback.append(symbol, text);
    host.append(feedback);
  }
  host.append(note);
}

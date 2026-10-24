import recording from "../../../docs/media/curiolab-demo.json";
/** Presentation only: never resets, commits to, or selects a branch in the episode. */
export function mountViewModes(app: HTMLElement, base: string): () => void {
  const existing = document.getElementById("view-modes");
  const host = existing ?? document.createElement("div");
  host.id = "view-modes";
  if (!existing) app.before(host);
  host.innerHTML = `<nav class="view-banner" aria-label="View mode"><strong>View Mode:</strong><button id="view-recording" type="button" aria-pressed="false" aria-controls="recorded-view">📺 Recorded 1080p Walkthrough</button><button id="view-simulator" type="button" aria-pressed="true" aria-controls="app">🕹️ In-Browser TV Remote Simulator</button></nav>
<section id="recorded-view" class="recorded-view" aria-labelledby="recording-title" hidden>
<h1 id="recording-title" tabindex="-1">Recorded walkthrough</h1>
<p>Synthetic science sandbox · captured from a 1920×1080 viewport, encoded at 1280×720 (720p). This is not a physical experiment or Fire OS device recording.</p>
<video id="demo-video" controls playsinline preload="none" aria-label="CurioLab synthetic episode walkthrough">Your browser cannot play this WebM recording.</video>
<div class="recording-controls"><label>Playback speed <select id="video-speed"><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option></select></label><a id="scene-flat" href="#demo-video">Flat Bridge · ~0:04</a><a id="scene-folded" href="#demo-video">Folded Bridge · ~0:12</a></div>
<p id="video-status" role="status">Captions and exact counts are embedded in this silent recording. Scene links are approximate.</p><p><a id="video-download">Download the walkthrough (WebM, ~4.2 MB)</a></p></section>`;
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const recorded = get<HTMLButtonElement>("view-recording");
  const simulator = get<HTMLButtonElement>("view-simulator");
  const panel = get<HTMLElement>("recorded-view");
  const video = get<HTMLVideoElement>("demo-video");
  const status = get<HTMLElement>("video-status");
  host.after(panel); // Keep only the banner in the sticky host; panels remain normal flow.
  get<HTMLElement>("view-recording").parentElement!.onkeydown = (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    (event.target === recorded ? simulator : recorded).focus();
  };
  const source = `${base.replace(/\/?$/, "/")}media/curiolab-demo.webm`;
  get<HTMLAnchorElement>("video-download").href = source;
  get<HTMLAnchorElement>("video-download").download = "curiolab-demo.webm";
  let disposed = false;
  let pendingSeek: number | undefined;
  const play = () => {
    if (!video.hasAttribute("src")) video.src = source; // No video download during interactive play.
    const attempt = video.play();
    void attempt?.catch(() => {
      if (!disposed && !panel.hidden)
        status.textContent =
          "Playback did not start. Press Play, or use the download link below.";
    });
  };
  const showRecording = () => {
    app.hidden = true;
    panel.hidden = false;
    recorded.setAttribute("aria-pressed", "true");
    simulator.setAttribute("aria-pressed", "false");
    get<HTMLElement>("recording-title").focus();
    play();
  };
  recorded.onclick = showRecording;
  simulator.onclick = () => {
    video.pause();
    panel.hidden = true;
    app.hidden = false;
    recorded.setAttribute("aria-pressed", "false");
    simulator.setAttribute("aria-pressed", "true");
    (
      app.querySelector<HTMLElement>("#back-sheet:not([hidden]) button") ??
      app.querySelector<HTMLElement>(
        "#content input, #content select, #actions button:not(:disabled), #screen-title",
      ) ??
      simulator
    ).focus();
  };
  get<HTMLSelectElement>("video-speed").onchange = (event) => {
    video.playbackRate = Number((event.target as HTMLSelectElement).value);
  };
  const seek = (seconds: number) => {
    pendingSeek = seconds;
    if (video.readyState >= 1) {
      video.currentTime = Number.isFinite(video.duration)
        ? Math.min(seconds, video.duration)
        : seconds;
      pendingSeek = undefined;
    }
  };
  video.onloadedmetadata = () => {
    if (pendingSeek !== undefined) seek(pendingSeek);
  };
  video.onerror = () => {
    status.textContent =
      "The recording could not load or this browser does not support WebM. Try the download link, or switch to the interactive simulator.";
  };
  for (const [id, stage] of [
    ["scene-flat", "FLAT_LAB"],
    ["scene-folded", "FOLDED_LAB"],
  ] as const) {
    const seconds =
      recording.stages.find((item) => item.stage === stage)!.at_ms / 1000;
    get<HTMLAnchorElement>(id).onclick = (event) => {
      event.preventDefault();
      seek(seconds);
      play();
      video.focus();
    };
  }
  return () => {
    disposed = true;
    if (video.hasAttribute("src")) video.pause();
    app.hidden = false;
    panel.remove();
    host.replaceChildren();
    if (!existing) host.remove();
  };
}

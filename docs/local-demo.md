# Local orchestration, browser recording and Pages sandbox

Recorded 2026-10-24. These are **synthetic web demonstrations**, not an installed Fire OS app, a physical experiment, a real Android companion or deployed AWS evidence. Automated checkbox interaction demonstrates the consent UI, not human consent, safety approval or a family study.

## One-command local stack

Requirements: Docker Engine/Desktop with Compose v2, internet during the image build, and free loopback ports 5173, 8080 and 8081.

```sh
docker compose up --build --wait
# Or: docker compose up  (foreground)
# Open http://localhost:5173/curiolab/
# Verify from inside the TV container (no host Node/JDK needed):
docker compose exec -e RELAY_ORIGIN=http://session-relay:8080 -e CONTENT_ORIGIN=http://content:8081 firetv pnpm verify:local
# Or, with host dependencies installed: pnpm verify:local
docker compose down
```

`Dockerfile` installs Java 17, pinned pnpm dependencies and builds the actual JVM and Kotlin/JS engines. No host JDK is needed inside Compose. `.dockerignore` excludes secrets, private grants, caches and generated outputs; only the explicit public walkthrough and its metadata are included from the media folder. No credentials or camera media are mounted. No production database volume is created.

| Service | Host port | Behavior |
| --- | --- | --- |
| `session-relay` | 8080 | Real `ObservationBroker` with an ephemeral CAS store, scoped fixture grants, first-frame authentication, 16 KiB message cap, bounded sockets/queue and transient candidate/stopped forwarding. `GET /health`, WebSocket `/relay`. |
| `content` | 8081 | Allowlisted `GET /episode.json` from the existing draft fixture. No general filesystem/dataset serving, no signed/approved bundle claim. `GET /health`. |
| `firetv` | 5173 | Vite UI plus real JVM `SimulatorBridge`; server-side `RELAY_URL=http://session-relay:8080`, `CONTENT_URL=http://content:8081`. Health-gated startup. |

Host ports bind **127.0.0.1**, while servers bind 0.0.0.0 inside containers. Container DNS URLs never enter browser code. The browser uses same-origin `/api/episode`. After accepted preflight, the TV server creates local fixture grants, opens actual TV/companion WebSockets, publishes synthetic observation/proposal messages and forwards Kotlin-committed snapshots through the broker. The draft title is fetched over HTTP; it does not replace signed content verification or make the runtime a downloaded graph renderer. A local-services indicator reports relay failure while preserving the authoritative local episode/manual path.

`POST /fixture/sessions` and authenticated `DELETE /fixture/sessions/{id}` are **local fixture provisioning/cleanup**, not production one-time pairing or a public token issuer. Capabilities are random, in memory and never logged; stored grants are hashed. Completion/clear revokes the local network fixture grants and removes its relay record; restarting/down loses all state. Do not expose this stack as a production service. AWS relay/SAM sources remain separate.

### Verification boundary

**Docker is not installed in this execution environment**, so no Docker image build, container DNS or successful `docker compose up` run is claimed. YAML wiring, COPY source existence and workflow boundaries are tested. The exact three service entry points were run as host processes on 8080/8081/5173; `pnpm verify:local` passed over actual HTTP and authenticated WebSockets, followed by the existing HTTP → JVM smoke suite. Node contract tests also start the actual servers on ephemeral ports and verify forwarded/confirmed data, denial, media rejection and cleanup. This is not a substitute for the outstanding container run.

For a host-only run: install Node 22, Java 17 and pinned dependencies; `pnpm build`; start `pnpm dev:relay` and `pnpm dev:content` in separate shells; then `RELAY_URL=http://127.0.0.1:8080 CONTENT_URL=http://127.0.0.1:8081 pnpm dev:firetv`.

## Browser-only Pages rendition

`apps/firetv/vite.config.ts` sets `base: '/curiolab/'`. Build with `pnpm build:firetv` (also included in `pnpm build`); static output is **`build/pages/`**. Preview with:

```sh
pnpm exec vite preview apps/firetv --host 0.0.0.0 --port 4173
# http://localhost:4173/curiolab/
```

The `pages` build always uses the sandbox. Local dev can explicitly select `?sandbox=1`. It does not silently switch to a fixture on HTTP failure.

**There is no TypeScript reimplementation of episode logic.** `SimulatorProtocol.kt` is shared by the JVM stdin `SimulatorBridge` and the exported Kotlin/JS `BrowserSimulator.kt`. The pinned compiler builds the actual `EpisodeCoordinator`, `ManualEpisodeSession`, preflight and input rules into an ES module. JVM-only persistence/stdin adapters are excluded. `packages/testkit/src/browser-simulator.ts` validates the same command boundary and calls that module. Generated implementation is ignored in Git and rebuilt from source; its declaration is tracked. Vitest prepares the browser module once before workers start, including on a clean checkout. Input normalization uses Kotlin's locale-invariant lowercase on both targets.

State stays in this tab's memory; reloading/clearing loses it. Prediction, manual fallback, simulated calibration/stable/review observations, adult stop, correction, all three comparisons and reflection are interactive. Companion buttons still run the real structured tracker fixture. No camera, microphone, API server, WebSocket, Bedrock or AWS credential is required. Authored hints work. Exact values come only from family-confirmed inputs; animations are story illustrations, not detected physical collapse. Persistent captions and badges identify the sandbox and synthetic data.

`tests/contract/browser-sandbox.test.ts` compares browser Kotlin/JS replies against a separately built actual JVM for typical, equal/lower, 0/30 bounds, correction, calibration/review/stability gating, stale frames, duplicate confirmation/reflection and invalid commands. `pnpm smoke:pages` drives the **built static site in Chromium** for 3/7, 4/4 and 6/2, sets the browser offline after module loading, rejects API/cloud requests, and checks computed reduced-motion/no-timing end states. This proves only already-loaded web modules, not a signed offline bundle or native accessibility certification.

### Publish to GitHub Pages

`.github/workflows/pages.yml` runs checks/build on `main` and manual dispatch, uploads only `build/pages`, then deploys with **`actions/deploy-pages@v4`**. Read/write permissions are job-scoped; no personal token is embedded.

**Operator prerequisite still needed:** repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. The current GitHub integration could read the public repository but Pages lookup returned 404 and enabling Pages returned **403 Resource not accessible by integration**. No site was enabled or deployed in this session. After enabling that setting and merging this workflow to `main`, its deployment should publish at **https://knarayanareddy.github.io/curiolab/**. Inspect the Actions deployment result; do not treat that intended URL as a live-verified result yet.

## Automated walkthrough video

Requirements outside Compose: Node 22, pinned dependencies and Playwright's Chromium/FFmpeg with host libraries. Standard setup:

```sh
pnpm exec playwright install --with-deps chromium
# With local JVM stack on 5173:
pnpm record:demo
# Or record the built Pages rendition on 4173:
DEMO_URL=http://127.0.0.1:4173/curiolab/ pnpm record:demo
# Verify all static branches (preview must be running):
pnpm smoke:pages
```

`scripts/record-demo.ts` uses real Playwright `recordVideo`; `demo-walkthrough.ts` drives visible controls, not patched engine state. It starts at safety/consent, selects synthetic companion input, predicts, sends stable tracker observations, marks adult stop, confirms flat 3, films flat deflection/collapse, confirms folded 7, films accordion support and the GREATER resolution, then reflects to completion. Pacing sleeps affect recording readability only. A proposed observation never loads story crates. Video is flushed on context close, checked for non-empty size, and published only on success.

Output: [`media/curiolab-demo.webm`](./media/curiolab-demo.webm), with [`media/curiolab-demo.json`](./media/curiolab-demo.json) recording browser version, actual engine label, stage markers, exact values and SHA-256. This requested generated video is intentionally tracked (~4.2 MiB); intermediate captures stay under ignored `build/`. The recording is silent and captions carry the content.

The supplied capture was made from **built Pages assets**, with Chromium **153.0.8010.0**, viewport 1920×1080 and video 1280×720. Because this sandbox permits only registry/GitHub/PyPI downloads, Chromium came from the pinned `@sparticuz/chromium@153.0.0` npm package and FFmpeg 7.0.2 from `imageio-ffmpeg==0.6.0`, installed only in external tool caches. Neither is a product dependency. `CHROMIUM_EXECUTABLE_PATH` optionally selects an installed browser; this environment also supplied its external library/cache paths. Normal users should use Playwright's standard installer above. No browser executable, private data, runtime cache or raw experiment media is committed.

## Validation and remaining gates

- Required `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`: **passed, 21 suites / 117 tests** (75 TypeScript unit, 37 contract, 4 infrastructure, 1 security). `make test-unit test-infra test-security` also passed, including **24 Kotlin tests**, with no known dependency vulnerabilities. `git diff --check` and all traceability path/ID checks passed.
- Actual host-process service connectivity and static Chromium/offline journey checks passed; actual `.webm` capture exists.
- Container build/up, Pages enablement/deployment, native Fire OS/CameraX, deployed AWS, physical protocol accuracy, signed approved content, native accessibility/performance and human reviews remain incomplete. Existing `make test-e2e`/native integration gates are not waived by a browser demo.

## Embedded recorded / interactive view switch

The sticky **View Mode** banner defaults to the interactive simulator. Selecting **Recorded 1080p Walkthrough** reveals the existing public capture with native play/pause/seek/fullscreen controls, 1x/1.25x/1.5x playback speeds, and approximate **Flat Bridge (~0:04)** / **Folded Bridge (~0:12)** scene links derived from the capture metadata. The visible description clarifies that **1080p refers to the captured viewport; the unchanged file is encoded at 720p**. Synthetic/browser provenance stays visible. WebM failures or blocked playback offer a download link and the interactive alternative; there is no forced autoplay before selection. The player fetches no video during default interactive play.

Switching views pauses playback on return and preserves the actual episode DOM/session, predictions and confirmed measurements. Native video keys are not captured by simulator D-pad navigation; the banner supports directional focus and native keyboard activation. `index.html` also includes a no-JavaScript link to the recording.

The Vite media plugin emits the exact original file at **`build/pages/media/curiolab-demo.webm`**, addressed as **`/curiolab/media/curiolab-demo.webm`**. It also serves the explicit recording URL during local dev. Docker's ignore list allows only this public capture and its metadata from the media folder; the dev server allowlist includes only the required metadata JSON. The Pages workflow now asserts that both `index.html` and the video exist before uploading the whole `build/pages` artifact. The build contract verifies the source/output SHA-256 match and deployment path. No duplicate video source or re-encoding is introduced.

Unit coverage checks mode preservation, lazy loading, speed controls, pre-metadata scene seeking, directional focus, and playback failure recovery. This adds local build/DOM evidence, not a new live Pages deployment, browser codec audit or Fire OS release claim.

Embedded-player verification: `pnpm build && pnpm vitest run` passed (**23 suites / 126 tests**), along with lint and strict TypeScript checking. The built preview served both the simulator and the exact source video with `video/webm` MIME, matching SHA-256 and HTTP 206 range requests. Live Pages deployment and browser codec/accessibility certification are not claimed.

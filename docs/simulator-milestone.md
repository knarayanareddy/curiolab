# Adult preflight, Kotlin perception and TV simulator milestone

Recorded 2026-10-24. Local implementation/fixture evidence only. This extracted checkout is the CurioLab project root; no sibling/shared production files or controlled specifications/schemas were modified.

## Subsequent scene/lifecycle slice

The coordinator-driven SVG canvas and complete local paired lifecycle contract are documented in [`scene-lifecycle-validation.md`](./scene-lifecycle-validation.md). They supersede this milestone's earlier **static-scene** description and historical test counts below. The canvas uses confirmed counts only; reduced-motion/no-timing share static end states. The local relay bridge is fixture-only and does not establish a native/deployed phone connection. See [`backend-deployment.md`](./backend-deployment.md) for the later relay snapshot/authentication implementations; the client limitations below describe this earlier milestone, not current backend source.

## Run

Requirements: Node 22, pinned pnpm through Corepack, Java 17. Install with `make bootstrap`, set `JAVA_HOME` if Java is not on PATH, then:

```sh
corepack pnpm dev:firetv        # compiles Kotlin JAR; serves Vite + local API on 0.0.0.0:5173
corepack pnpm smoke:firetv      # separate shell, against the running local server
corepack pnpm build:firetv     # web assets only; needs local Kotlin API at runtime
make lint typecheck test-unit test-contract test-security
```

For this sandbox Java was obtained from the pinned PyPI `jdk4py==17.0.9.2` wheel, installed outside Git at `/home/user/.cache/curiolab-java`; `JAVA_HOME=/home/user/.cache/curiolab-java/jdk4py/java-runtime`. This is a local harness runtime, not an Android SDK or Fire OS simulator. No automatic machine-specific path is added to project scripts. Tool versions: Node 22.22.3, pnpm 10.17.1, Kotlin compiler 2.4.21, Java 17.0.9, Vite 7.3.7, jsdom 26.1.0. Vite was upgraded during validation to avoid the published moderate/high advisories found in 7.3.1.

## Implemented paths and boundaries

### FR-CL-002 — adult preflight

`AdultPreflight.kt` adds typed adult, privacy, safety, small-object supervision, analytics, camera-choice/permission and accessibility policy. `AdultPreflightService` accepts only a complete choice. Camera denial/unavailability blocks the companion route, not manual play. Analytics consent is independent and not required. The simulator emits no analytics and leaves analytics off.

`EpisodeCoordinator.kt` is the entry point used by the simulator: prediction requires accepted preflight. The UI shows privacy and exact safety instructions before launch. Native camera permission is **not** requested by the web UI: its permission choices are explicitly fictional simulator input. Native permission revocation/lifecycle and accessible device evaluation remain outstanding. Preflight is memory-only, with no child account or identity data.

### FR-CL-005 / FR-CL-006 — structured perception into Kotlin

`packages/perception/src/kotlin-observation.ts` translates the existing `StableCoinCounter` observation/calibration contract to the local Kotlin bridge. Pending candidates cannot qualify for stop. `EpisodeCoordinator` checks the active trial, monotonic frame sequence, 0–30 bounds, finite confidence/error, marker set, 8 px error, 1,000 ms occlusion, 0.65 confidence and 500 ms stability. Review/calibration states prevent camera stop. Adult manual override remains available. Stop freezes only a proposal; family correction/confirmation goes through the existing `ManualEpisodeSession` and `EpisodeState`. Perception never commits engine variables.

The UI's fixture buttons execute the actual TypeScript tracker/calibration logic and send structured results to the actual JVM coordinator. They are **not** real images, CameraX, MediaPipe, or physical ground truth. Kotlin trusts stability metadata produced by the companion tracker; it is not an independent object detector. Structured observations are transient and are not restored after a restart.

### INT-CL-003 — relay/pairing client foundation

`packages/session-contracts/src/pairing-client.ts` uses same-origin `POST /v1/pairings/exchange`, a five-second timeout and bounded responses. It validates code/nonce, scope IDs, credential bounds and expiry. Tokens are returned in memory, never logged or stored. Rate-limited/expired/denied/unavailable exchanges fail explicitly.

`relay-client.ts` provides an injected WebSocket interface plus a thin browser adapter. It restricts endpoints to WSS without credentials/query strings, sends the scoped app credential in `session.hello`, has a five-second connect timeout, scopes messages by session, limits UTF-8 messages to 16 KiB, rejects unexpected/media fields, validates observed/stopped counts, drops duplicates/out-of-order messages, preserves per-sender offsets across explicit reconnect and ignores events from stale sockets. Revocation/expiry deny further use; malformed input never reaches the consumer. `connected` describes an open transport, **not** proof of server authorization. Reconnect is explicit and credentials must be renewed by the caller when expired. Message-ID deduplication is a bounded 256-entry window plus per-sender monotonic sequences.

The client currently accepts observation candidate/stopped and typed session-error messages. It does not implement full `state.snapshot` hydration, committed-event replay, automatic reconnect/backoff, a deployed relay, server-side authorization/rate limiting or REST session creation. Candidate `calibration` is a restricted status string in this local wire subset; deployed publisher compatibility is not established. The TV simulator does not connect this client to fake AWS or claim a paired phone. Actual API Gateway `$connect`/authorizer setup and hello/resume protocol need deployment verification; **INT-CL-003 remains in_progress**.

### INT-CL-004 — shared ModelGateway client foundation

`packages/model-gateway/src/index.ts` calls the shared application endpoint `/v1/hints`, not Bedrock directly. Its input uses canonical node IDs and `attempt_count`, with optional authored last-error enum; no raw media, transcript, child data or unconfirmed measurement is sent. It validates the specification's `hint_id`, `text`, `hint_level`, `uses_fallback` shape, matching level, 5–45 words, 240-character bound, controls/bidi/markup rejection, and a conservative node/error-specific vetted-text allowlist. Until live content safety evaluation is available, other generated text falls back rather than introducing unreviewed materials/actions or conclusions. The current catalog is development-authored text, not a human-approved release asset.

Disabled transport, HTTP errors, malformed/oversized output and even a non-cooperative timed-out provider return a deterministic authored hint at the same level within a 1,500 ms default budget. Error hints include marker/occlusion recovery. No HTML rendering or automatic speech occurs. The simulator deliberately uses disabled transport, so hints work without cloud access. Bedrock credentials, model invocation, deployed gateway, production prompt versioning, reviewed multi-level catalog and live evaluation remain outstanding; **INT-CL-004 remains in_progress**, not live-verified.

### Web TV UI

`apps/firetv` is Vite/HTML5/CSS, using `ui/tokens.json` colors, large TV controls, captions, visible focus, keyboard/D-pad traversal, manual count adjustment, quiet confirmation, exact greater/equal/lower results, capped visual crates with exact counts in text, repeat/variable-change prompt and reflection. Static scenes impose no motion or timing demand. This is an authored simulator journey, not a general episode-graph renderer or signed-content runtime.

`SimulatorBridge.kt` exposes a bounded local stdin protocol. `scripts/firetv-simulator.ts` serializes requests to a real long-lived Kotlin process, restricts POSTs to same-origin, bounds bodies/queue/engine deadlines, and restricts Vite filesystem access to UI/runtime source folders. Browser requests use relative `/api/episode`; no browser localhost calls or cloud credentials. The server must only be used as a development simulator, not a production service. No private files/media should be placed in served source folders.

Sessions have unguessable ephemeral IDs, are limited to 100 concurrent entries, and are held in process memory only. Clearing a session deletes its engine entry; restarting loses all sessions. Reloading the page starts a new session; stale entries remain until cleared/server restart. This is not production retention, durable resume, a signed downloaded/offline bundle, or native Fire TV installation. Losing the local server connection displays an error/reload action, not fake completion. Cloud-disabled manual play works as long as the local simulator server is available.

## Validation evidence

- `make lint typecheck test-unit test-contract test-security`: passed with Java 17.
- TypeScript unit tests: 49 passed, including 14 client tests, 5 jsdom UI tests and structured tracker-to-Kotlin serialization.
- Kotlin unit tests: 21 passed, including 4 new preflight/perception/coordinator tests.
- Contract tests: 10 passed, including 3 new hint/pairing adapter tests.
- Existing publication security test: 1 passed.
- `corepack pnpm build:firetv`: passed.
- `corepack pnpm smoke:firetv`: passed against the running HTTP server and real JVM: privacy/preflight gating, prediction before result, stop/correction, greater/equal/lower, reflection, structured stable tracker → stop → correction, deletion and cross-origin rejection.
- Audit: no moderate/high issues; one low esbuild Windows development-server advisory remains in Vite's transitive dependency. No Windows dev-server validation is claimed.

Source tests: `packages/episode-engine/src/test/kotlin/com/curiolab/episode/EpisodeEngineTestSuite.kt`, `tests/unit/clients.test.ts`, `tests/unit/firetv-ui.test.ts`, `tests/unit/perception.test.ts`, `tests/contract/gateway-pairing.test.ts`. Smoke script: `scripts/firetv-smoke.ts`.

jsdom assertions are DOM unit evidence, not a real browser, accessibility audit, or device run. No physical remote, Fire TV/permitted simulator, CameraX device, physical calibration protocol, real paired phone, live AWS/Bedrock request, human approval, branch coverage threshold, or family study is claimed. Native/deployed requirements stay incomplete. No controlled-input requirement has been waived.

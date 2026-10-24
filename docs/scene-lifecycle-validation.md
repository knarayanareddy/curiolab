# Coordinator-driven scenes and local paired lifecycle

Recorded 2026-10-24. **Local simulator/fixture evidence only**, not a native Fire OS build, rendered-browser accessibility audit, physical experiment, deployed pairing/relay or live Bedrock run. Controlled specifications, schemas and UI guidance are unchanged.

## Implementation

- `packages/session-contracts/src/simulator-state.ts` types the actual Kotlin bridge reply. `SimulatorBridge.kt` also returns the accepted accessibility mode and committed predictions, so the renderer and relay projection do not invent either.
- `apps/firetv/src/scene.ts` projects that reply to an authored SVG scene canvas. A flat load appears only after flat confirmation; the folded load and comparison appear only after folded confirmation. Observed frames, stopped proposals and editable correction counts never parameterize story visuals. Missing/invalid confirmed values or a comparison inconsistent with the confirmed counts fail closed, not to a canned success.
- Flat-paper curvature depends on the confirmed load; finite load/deflection/collapse choreography illustrates the story. Folded paper has an accordion silhouette and a settled load. Greater/equal/lower use explicit text, numbers and distinct up/equal/down glyphs; none assumes folding always wins. The illustration is explicitly **not a physics simulation or evidence of detected collapse**. A zero flat count does not invent a loaded collapse.
- Graphic crates are capped at **12 per trial**, while exact confirmed values remain in each title and comparison. The cap never changes stored counts or selects a branch.
- CSS transitions/animations are finite, at most 450 ms. Snapshot refreshes reuse the scene; stage changes do not replay unchanged loads. Confirmation stays quiet. OS `prefers-reduced-motion` and the accepted `reduced_motion`/`no_timing` modes disable animation and expose the same static end state without waiting for a timer or animation event. SVGs scale with their viewBox and remain present in the narrow responsive layout.
- Descriptive text/labels carry the information of decorative, accessibility-hidden SVGs. Programmatic D-pad focus as well as `:focus-visible` receives a four-pixel outline. Stale hint text is hidden when the episode changes stage.

`services/simulator/src/kotlin-engine.ts` now owns the real long-lived JVM process for both the HTTP simulator and lifecycle test: bounded queue, input validation, five-second deadline, and pending-request rejection on process exit. The HTTP server retains same-origin POST, body bounds and relative browser URLs.

## Lifecycle contract evidence

`tests/contract/e2e-session-lifecycle.test.ts` builds Kotlin **from current source** and mounts the real TV entry point in jsdom. It does not stub coordinator replies or implement another episode state machine. Three complete journeys cover:

| Flat / folded | Kotlin outcome | Accessibility setting |
| --- | --- | --- |
| 3 / 7 | GREATER | standard |
| 4 / 4 | EQUAL | reduced_motion |
| 6 / 2 | LOWER | no_timing |

Each journey checks:

1. Missing adult preflight rejects launch/prediction. Accepted adult/privacy/safety/small-object choices precede play; analytics remains off. D-pad key events move focus and Back/return restores the triggering control without changing the coordinator stage.
2. Actual `FixturePairingService` creation and `PairingClient` token exchange, session/device binding, observation scope and consumed-code denial.
3. Actual `WebSocketRelayClient` hello/authentication and `ObservationBroker` routing/persistence over injected in-memory sockets/store, with the paired companion token hash installed into the fixture grant. Tokens are fictional and in memory.
4. Real `StableCoinCounter` frame processing, missing-marker rejection, sub-500 ms stop rejection, subsequent stable sets, stale-frame suppression, adult stop, and the quiet TV confirmation screen. No candidate/stopped proposal loads story crates.
5. TV correction from observed `flat + 1` to the family-confirmed flat value (including **5 → 4**), followed by both TV measurement commits. Actual Kotlin predictions/measurements project into committed relay snapshots received by the companion. Exact SVG/text values and the Kotlin-selected branch agree.
6. The rendered **Authored hint** fallback with the UI's Bedrock transport disabled, and no hint-provider HTTP call. Earlier hint client/backend suites separately exercise malformed/timeout provider responses.
7. Reflection, completion, duplicate-confirmation idempotence, fixture completion/revocation and denial of subsequent observation, then clearing the local TV session removes scene crates.

### Explicit fixture boundaries

- TV `/api/episode` fetches are routed into the shared real JVM adapter in jsdom, not through a network HTTP server. The separate HTTP smoke check exercises the running simulator server. Pairing exchange HTTP and relay sockets/delivery/store are injected, not deployed services. The local grant installation and completion/revocation linkage are test orchestration, **not production pairing/completion endpoints**.
- `services/simulator/src/companion-input.ts` is a **local fixture bridge**. The restricted v1 relay payload carries a calibration status but not geometry or stability duration. The test supplies the actual tracker snapshot through an explicit fixture metadata port, validates that its trial/frame/count/confidence/status match the wire message, and uses `kotlinObservationArgs` to pass the real synthetic metadata into Kotlin. It does **not** infer/fabricate calibration metrics or a 500 ms duration from a status string. This does not establish compatibility with a native/deployed publisher.
- TV refresh and snapshot publication are driven by the harness; the web simulator is not being represented as a production phone-pairing client. Observations are structured synthetic detections, never camera images.
- `tests/unit/scene-choreography.test.ts` adds eight DOM/model/CSS-contract cases: committed-only parameters, each branch, zero/max/capping, refresh/replay behavior, invalid values/branch rejection, static end states and focus/motion rules. CSS text/DOM checks are **not computed browser rendering, frame-rate measurement, a screen-reader audit or a physical remote run**.

## Reproduce

Requirements: Node 22, pinned pnpm/Corepack and Java 17 on PATH or in `JAVA_HOME`. The contract suite invokes the pinned Kotlin compiler and builds its own JAR; no AWS credentials or downloaded model are needed.

```sh
pnpm typecheck && pnpm lint && pnpm vitest run
# `corepack pnpm` is equivalent when the pnpm shim is not installed.
make lint typecheck test-unit test-contract test-infra test-security build
corepack pnpm build:firetv
corepack pnpm dev:firetv     # live local preview at port 5173
# In another shell:
corepack pnpm smoke:firetv
```

The requested typecheck/lint/full Vitest run passed: **18 suites, 105 tests** (75 TypeScript unit, 27 contract, 2 infrastructure, 1 security). **Also passed:** `make test-unit test-contract test-infra test-security build` (including 24 Kotlin unit tests), `pnpm build:firetv`, dependency audit (no known vulnerabilities), `git diff --check`, and `corepack pnpm smoke:firetv` against the running HTTP server/real JVM. The live local preview binds `0.0.0.0:5173`.

## Still blocked / not claimed

Native libGDX/Leanback install, real CameraX publisher, production pairing/completion provisioning, deployed API Gateway/DynamoDB/Bedrock, signed approved content, physical measurement accuracy, audio description/screen-reader/device accessibility, 1080p 30 fps/remote latency, observation-to-scene latency, process-death restoration and family/educator review remain separate release gates. `make test-e2e` intentionally continues to fail for missing native device evidence; this local contract suite does not waive that gate.

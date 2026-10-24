# CurioLab

**Track:** Fire TV
**Status:** manual two-trial episode, structured perception, one-time scoped pairing, and content-compiler foundations validated locally; Fire OS/companion applications not implemented
**Agent entry point:** [`AGENTS.md`](./AGENTS.md)

CurioLab is a two-screen family science episode in which predictions precede results and confirmed measurements—not canned success values—drive comparisons.

## Deployable backend and input intents

The test-stage relay backend now includes API Gateway/Lambda handlers, DynamoDB conditional state storage, scoped first-frame authentication, resume snapshots, transient structured observations/transcripts, and a text-only Bedrock Converse hint adapter with authored fallback. Pure Kotlin/TypeScript parsers cover remote navigation and companion push-to-talk prediction choices. The simulator's Back key opens a non-destructive pause sheet.

```sh
corepack pnpm build:backend
make test-infra
```

The SAM template is `infra/backend.template.json`. **No backend is deployed and no real AWS/device integration is claimed.** Follow [`docs/backend-deployment.md`](./docs/backend-deployment.md) for operator deployment, model access verification, test-grant provisioning, protocol details, safety boundaries and remaining release gates. Production one-time pairing issuance, native audio/Transcribe, durable engine hydration, deletion jobs and device evidence remain incomplete.

## TV web simulator

```sh
make bootstrap
# Java 17 must be on PATH, or set JAVA_HOME to its installation directory.
corepack pnpm dev:firetv    # Vite UI + actual local Kotlin engine, port 5173
# In another terminal:
corepack pnpm smoke:firetv
```

Use arrows/Enter or Tab to navigate. Adult preflight precedes both trials; mark stop, then confirm/correct each count to see the measured branch. Camera controls are explicitly fictional structured-state fixtures. Authored hints work with cloud disabled. This is a local development simulator, **not** a Fire OS build, permitted platform simulator, deployed relay or live Bedrock integration. Sessions are memory-only and are lost on server restart. See [`docs/simulator-milestone.md`](./docs/simulator-milestone.md) for architecture, validation, client limitations and remaining gates.

### Coordinator-driven scene and local lifecycle test

The SVG story canvas now uses only Kotlin-confirmed measurements: flat-paper deflection/collapse illustration, a folded accordion carrying the confirmed load, and distinct greater/equal/lower feedback. Exact counts accompany capped crate drawings. Reduced-motion/no-timing show the same static end state; confirmation is quiet and D-pad focus stays visible.

```sh
# Java 17 required; includes compiling/running the actual Kotlin coordinator.
corepack pnpm vitest run tests/contract/e2e-session-lifecycle.test.ts
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm vitest run
```

The local lifecycle contract exercises pairing, relay, structured tracker frames, family correction/confirmation, all three branches, authored fallback rendering and fixture cleanup. It is not deployed/native E2E; see [boundaries and reproduction](./docs/scene-lifecycle-validation.md). `make test-e2e` remains the blocked native-device gate.

## Local foundation

Requirements: Node.js 22, Corepack, `make`, and a Java 17 runtime for the pure Kotlin harness. The pinned npm Kotlin compiler is installed by `make bootstrap`; this is not an Android SDK.

```bash
make setup                 # install and create .env.local from safe examples
make dev                   # structured perception + deterministic Kotlin fixtures; no devices or cloud
make lint typecheck
make test-unit test-contract test-security
corepack pnpm validate:content
make build
```

Draft validation checks schema/graph semantics only. `--publish` intentionally rejects the current draft because reviews and hashes are placeholders.

`make test-security` audits the npm graph. Native integration, E2E, infrastructure, and deployment targets intentionally fail while unavailable.

The walking fixture also creates an anonymous parent-approved session, exchanges a five-minute unambiguous code once for session/device-scoped credentials, verifies scope binding, denies replay, and revokes access. Pairing state and hashed credential material are in-memory; no REST/WebSocket relay, Cognito, DynamoDB table, or companion connection is deployed. The separate backend source above is deployable test-stage code, not live evidence.

## Workspace map

| Path | Purpose |
| --- | --- |
| [`SPEC.md`](./SPEC.md) | Canonical requirements and vertical slices |
| [`schemas/episode.schema.json`](./schemas/episode.schema.json) | Canonical episode contract |
| [`packages/episode-engine/`](./packages/episode-engine/) | Predictions, adult stop/confirmation/correction, measured comparisons, reflection, and atomic fixture-file snapshots |
| [`packages/content-compiler/`](./packages/content-compiler/) | Draft schema/graph and publication-preflight checks |
| [`packages/perception/`](./packages/perception/) | Calibration gates and structured 500 ms stable-count observations; no camera implementation |
| [`services/pairing/`](./services/pairing/) | One-time codes, scoped credential lifecycle, rate limits, expiry, and revocation; no relay |
| [`scripts/walking-perception.ts`](./scripts/walking-perception.ts) | Labeled synthetic perception and pairing walking fixtures |
| [`content/episodes/bridge-to-moon-base/`](./content/episodes/bridge-to-moon-base/) | Draft content copy and pending human reviews |
| [`scripts/validate-content.ts`](./scripts/validate-content.ts) | Explicit draft/publication-preflight CLI |
| [`tests/`](./tests/) | TypeScript and Kotlin unit/contract/security checks |
| [`docs/`](./docs/) | Setup evidence, boundaries, and validation results |
| [`ui/`](./ui/) | Static design guidance, not a Fire OS UI |

## External blockers

Fire OS SDK/signing/device or permitted simulator, Android companion/CameraX, deployed WebSocket relay, AWS model/voice services, real content assets/signatures, family accessibility/safety reviews, and learning/device evidence remain blocked or unimplemented. The fixture does not perform a physical experiment or establish a learning outcome.

Maintain [`SPEC_TRACEABILITY.md`](./SPEC_TRACEABILITY.md) and [`SPEC_DEVIATIONS.md`](./SPEC_DEVIATIONS.md) without treating local fixtures as live evidence.

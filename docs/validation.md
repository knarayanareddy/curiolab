# CurioLab validation record

Recorded 2026-10-23 on the local vertical-slice branch. Evidence covers pure Kotlin/TypeScript source and fictional content only.

## Latest local orchestration / Pages / video slice (2026-10-24)

See [`local-demo.md`](./local-demo.md). The real shared Kotlin coordinator/protocol now compiles for JVM and Kotlin/JS; parity contracts cover values, preflight, calibration/review, stability, correction, replay and all outcomes. Real local HTTP/WebSocket server contracts and Compose/Pages configuration tests were added. Built static assets completed standard/reduced-motion/no-timing journeys in actual Chromium while offline after loading, with no API/cloud calls. Host processes on 8080/8081/5173 passed the network connectivity and existing HTTP → JVM smoke checks. The requested real browser capture is [`media/curiolab-demo.webm`](./media/curiolab-demo.webm), with version/provenance/hash metadata alongside it. It records a synthetic Pages walkthrough, not a real experiment or human approval.

**Blocked/unverified:** Docker/Compose execution (Docker absent), and Pages enablement/deployment (GitHub API returned 404 for the site and 403 on enablement). Enable Source: GitHub Actions in repository Pages settings, then merge/run the workflow on `main`. No Fire OS, physical companion, live AWS, signed-content or device release gate is satisfied by this slice. **Final required checks passed: 21 suites / 117 tests**, plus build. Named unit/infra/security checks also passed, including **24 Kotlin tests** and a clean dependency audit. Networked completion was checked to remove fixture grants/session; `git diff --check` and all 56 traceability IDs/paths passed validation.

## Latest scene/lifecycle slice (2026-10-24)

See [`scene-lifecycle-validation.md`](./scene-lifecycle-validation.md) for actual paths and fixture boundaries. TypeScript/Kotlin typecheck, lint, and the complete Vitest run passed: **18 suites, 105 tests** (75 TypeScript unit, 27 contract, 2 infrastructure, 1 security). The three new lifecycle journeys run the real Kotlin coordinator and TV DOM for greater/equal/lower in standard/reduced-motion/no-timing modes, scoped pairing/relay fixtures, actual structured tracker frames, TV correction/commits and rendered cloud-disabled authored hints. Eight new scene tests cover parameters, caps, replay and CSS/focus contracts. The named `make test-unit test-contract test-infra test-security build` checks also passed, including **24 Kotlin tests**. Web production build, dependency audit (no known vulnerabilities), `git diff --check`, and the running local HTTP → Kotlin smoke check passed. This supersedes earlier static-scene counts, but is not a rendered-browser, physical remote, native companion, deployed AWS or accessibility certification result.

## Latest deployable-backend slice (2026-10-24)

See [`backend-deployment.md`](./backend-deployment.md) for SDK/API preflight, deployment/runbook, exact wire scope, tests and blockers. `make lint typecheck test-unit test-contract test-infra test-security` passed: 67 TypeScript unit, 24 Kotlin, 24 contract, 2 infrastructure and 1 existing security test. Backend Lambda bundle build/import, web build and cfn-lint 1.58.0 validation passed. The current dependency audit reports no known vulnerabilities. No AWS CLI/SAM CLI or credential environment was available; no stack, real DynamoDB/API Gateway socket, Bedrock invocation or native voice/device run is claimed. The conservative text director, relay state hydration, transient transcript handling and input policies remain local evidence, not completed live release gates.

## Previous simulator milestone (2026-10-24)

See [`simulator-milestone.md`](./simulator-milestone.md) for preflight, Kotlin perception integration, relay/hint client and UI paths, protocols and remaining blockers. Full `make lint typecheck test-unit test-contract test-security` now passes with Java 17 (obtained through pinned PyPI jdk4py). Results: 49 TypeScript unit + 21 Kotlin + 10 contract + 1 security tests passed. The web build and running local HTTP → Kotlin smoke script also passed. One low transitive esbuild advisory remains; no moderate/high audit issues. This supersedes the previous sandbox Java blocker but does not imply native, accessibility or deployed AWS validation.

## Latest bundle-slice run (2026-10-23)

See [`bundle-loader.md`](./bundle-loader.md) for FR-CL-001 implementation, test paths and blockers. Lint, strict TypeScript checking, 29 TypeScript unit tests and 7 contract tests passed. Full `make typecheck` and `make test-unit` are currently blocked at their Kotlin stages because this sandbox has no Java 17 runtime. No current Kotlin/device result is claimed. The table below is historical foundation evidence, not a rerun in this environment.

## Previous foundation passing checks

| Check | Result |
| --- | --- |
| ESLint + Prettier | Passed |
| TypeScript strict typecheck + Kotlin main/test compilation | Passed |
| TypeScript unit tests | 14/14 passed: 4 episode-graph, 5 structured-perception, and 5 pairing tests |
| Kotlin episode-engine tests | 17/17 passed |
| Canonical schema/contract tests | 4/4 passed; schema copy byte-identical |
| Content-publication security test | 1/1 passed |
| npm audit, moderate and above | No known vulnerabilities |
| TypeScript build + Kotlin runtime JAR build | Passed |
| Draft content CLI | Valid in `draft-development` mode |
| Fixture walking path | Structured calibration/stable-count/stop, one-time pairing/scope/replay/revocation, plus manual consent, stop 5/correct to 4, folded 7, greater branch, reflection, two atomic fixture-file saves/reopens through new stores/sessions |
| **Total tests** | **36/36 passed** |

The manual coordinator requires safety/consent before predictions, an adult-marked stop before confirmation, and a confirmed count before result parameters or comparison. Duplicate stops/confirmations are idempotent, stale sequences and counts outside the episode's 0–30 bounds fail, and the final summary requires reflection and preserves a variable-change prompt rather than asserting a universal law.

The versioned value-only snapshot format uses size/count limits, SHA-256 integrity checks, semantic validation, and atomic replacement. Tests prove deterministic bytes for an unchanged snapshot, reopen through a new store and session, continuation to the same measured summary, and fail-closed handling of bad magic/version/checksum, truncation, trailing bytes, and invalid state. Walking/test directories are removed.

The structured perception fixture rejects missing markers, reprojection error above 8 px, and occlusion above 1,000 ms. It requires 0.65 confidence, 12 px maximum center drift, and 500 ms stability; duplicate frames are ignored, review flags never create a guessed count, and adult stop returns an awaiting-family-confirmation snapshot. The API accepts structured detections only and does not commit a TV measurement or persist raw media.

The in-memory pairing fixture uses a six-character alphabet without ambiguous characters, five-minute code expiry, and a separate randomly generated scoped credential by default. Tests cover expired/consumed codes, independent per-device/per-IP failed-attempt rate limiting (including rotation attempts), device/session/token/scope binding, adult revocation, completion revocation, and twelve-hour expiry. The pairing code is not the session credential, raw credential hashes are not exposed by session reads, and no relay or cloud token issuer is involved.

The publication CLI was also run with `--publish` and correctly exited nonzero. It reported missing science/child-safety reviews, unapproved review state, and placeholder graph/asset hashes. This negative check is expected for the current draft.

## Reproduce

```bash
make lint typecheck test-unit test-contract test-security build dev
corepack pnpm validate:content
corepack pnpm validate:content -- --publish   # expected to fail for this draft
```

## Not evidenced / historical foundation boundary

No Kotlin/TypeScript coverage percentage, frame-rate/latency measurement, physical count accuracy, actual process-death/power-loss recovery, encrypted production storage, retention/deletion worker, or signed-bundle verification is claimed. Atomic fixture-file reopen is not a production durability test. No native Fire TV, real companion/camera, deployed REST/WebSocket relay or cloud token issuer, AWS service, physical experiment, real-browser scene rendering, family participant, accessibility study, learning outcome, deployment, or release gate was exercised. The later slice above does exercise the SVG scene DOM against a real local JVM, but does not establish native/rendered-browser/device evidence. Pairing evidence is local lifecycle behavior only, not a real companion connection.

The fixture proves deterministic state transitions and ordinary file reopen over supplied synthetic values only.

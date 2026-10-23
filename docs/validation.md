# CurioLab validation record

Recorded 2026-10-23 on the local vertical-slice branch. Evidence covers pure Kotlin/TypeScript source and fictional content only.

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

## Not evidenced

No Kotlin/TypeScript coverage percentage, frame-rate/latency measurement, physical count accuracy, actual process-death/power-loss recovery, encrypted production storage, retention/deletion worker, or signed-bundle verification is claimed. Atomic fixture-file reopen is not a production durability test. No Fire TV, companion, camera, REST/WebSocket relay, cloud token issuer, AWS service, physical experiment, rendered scene, family participant, accessibility study, learning outcome, deployment, or release gate was exercised. Pairing evidence is local lifecycle behavior only, not a real companion connection.

The fixture proves deterministic state transitions and ordinary file reopen over supplied synthetic values only.

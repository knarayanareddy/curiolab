# Signed bundle slice — FR-CL-001

Recorded 2026-10-23. This checkout is the extracted CurioLab project root; all paths below are project-relative. No sibling or shared production files were changed.

## Implementation

- `packages/bundle-loader/src/index.ts`: typed source/cache contracts, Ed25519 verification with a pinned caller-supplied public key, canonical episode-schema and publication/graph checks, episode/version identity, graph SHA-256, exact asset-set and individual asset SHA-256 validation. Install verifies before replacing; launch always verifies again, without network access.
- `services/content/src/https-bundle-source.ts`: trusted HTTPS origin, no redirects or credentials in URLs, abort propagation and bounded streaming response. Loader enforces a five-second default download deadline even for a non-cooperative source. There are no retries or logs of content/private data.
- `services/content/src/file-bundle-cache.ts`: single-envelope local Node cache with exclusive temporary files, restrictive permissions, file sync and atomic same-directory rename. Rejected downloads do not touch the prior bundle. Launch fails closed on missing/corrupt cache. Cache directory must be application-owned; this is not a hostile shared-filesystem adapter. Atomic replacement is not a power-loss durability guarantee for the parent directory.

The internal envelope is `{payload, signature}`. Both fields are canonical base64. Signature covers the exact UTF-8 JSON payload bytes using Ed25519. Payload contains format `1`, canonical episode ID, semantic content version, the episode document, and assets indexed by asset ID (base64 bytes). Payload base64 is limited to 8 MiB; envelope transport has 1 KiB overhead allowance. Graph identity is SHA-256 of UTF-8 `JSON.stringify(episode.nodes)` in authored order. This is a local transport contract, not a change to the controlled episode schema or a deployed manifest API. The source's `/v1/episodes/{id}/bundle` endpoint is a proposed internal transport and is not deployed.

A successful `launch` returns verified data for a future native runtime; it does not launch a Fire OS application. Explicit installation can roll back to an older trusted, approved version; no anti-rollback policy is claimed. One current version per episode is retained. Production signing/key rotation, publisher interoperability, CDN delivery, real assets/approval provenance, native storage, and native rendering remain outstanding.

## Tests and validation

- `tests/unit/bundle-loader.test.ts`: 15 tests, fictional signing keys and explicitly fictional approval metadata. Valid bundle, signature, schema, approval, graph, asset, identity/version/format, base64, asset-set, offline, timeout, disk failure and untrusted key paths.
- `tests/contract/bundle-adapters.test.ts`: 3 tests, injected HTTP responses and real temporary filesystem. Download/install/reopen, rejected update retains prior bundle, corrupt cache rejection, path traversal, missing cache, malformed response, authorization failure, oversized body and transport failure.
- `packages/testkit/src/bundle-fixture.ts`: ephemeral Ed25519 keys and fictional bytes/approval labels. Never production approvals or live-integration evidence.

Executed `make lint typecheck test-unit test-contract`, then `make -k lint typecheck test-unit test-contract` to exercise every target after discovering missing Java:

| Check | Current result |
| --- | --- |
| lint | PASS |
| TypeScript strict checking | PASS (TypeScript stage of `make typecheck`) |
| full typecheck | BLOCKED: Java 17 absent; Kotlin stage cannot run |
| TypeScript unit tests | PASS, 29/29 including 15 new bundle tests |
| full test-unit | BLOCKED after TS success: Java 17 absent |
| test-contract | PASS, 7/7 including 3 new adapter tests |

`corepack pnpm install --frozen-lockfile` succeeded. A Temurin 17 runtime download from the official GitHub release was attempted; its redirect to `release-assets.githubusercontent.com` failed under the sandbox network restrictions. No build scripts were weakened and no Kotlin success is claimed for this run. Earlier Java evidence in `docs/preflight.md` describes a prior environment, not the current sandbox.

## Outstanding release gates

FR-CL-001 stays **in_progress**: this independently tested Node/domain slice is not an installable Fire OS implementation. Fire TV/simulator, Android toolchain, real approved signed assets, live content delivery, publisher compatibility, device accessibility/failure UX and native end-to-end evidence remain blocked/unimplemented. AC-CL-001 and SEC-CL-006 have local implementation evidence only. No coverage threshold or live security/device certification is claimed.

# CurioLab review

## 1. Scope and verdict

Repository: `knarayanareddy/curiolab` at pinned SHA `2f933e6324073bac27c03f69e341bfad6700cfd7`. Stage: **prototype**. Runtime status: **NOT RUN**.

This sampled evidence supports a narrow verdict: CurioLab currently shows a local/manual family-science prototype with a browser TV simulator, a deployable-but-undeployed backend slice, bounded text-hint logic, and structured perception rules. It does **not** support claims of a shipped Fire OS application, a deployed AWS integration, a live Bedrock/device path, or validated family/device outcomes.

Confidence is **high** for the sampled static boundaries and contract-grounded documentation below, and **low** for runtime behavior, AWS/provider access, device behavior, release operations, deletion/restore, learning outcomes, and child-safety/accessibility performance because none were executed here. Sampled implementation evidence: `README.md`, `docs/backend-deployment.md`, `.github/workflows/pages.yml`, `services/content/src/local-server.ts`, `packages/bundle-loader/src/index.ts`, `packages/model-gateway/src/index.ts`, `packages/perception/src/index.ts`, and `apps/firetv/src/main.ts`. Uninspected boundaries include the unsampled native/device stacks, real AWS resources, real content signing operations, and any paths not listed in section 6. See [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md).

## 2. Architecture and product boundary

The sampled architecture separates four distinct product boundaries.

1. **Browser TV simulator and local/manual experience.** `README.md` says the current status is a “manual two-trial episode” and that “Fire OS/companion applications [are] not implemented,” while the browser sandbox labels itself “Synthetic observations, not a physical experiment.” ([README.md:4-4](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/README.md#L4-L4), quote: “manual two-trial episode”; [apps/firetv/src/main.ts:35-40](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/apps/firetv/src/main.ts#L35-L40), quote: “Synthetic observations, not a physical experiment.”)
2. **Deployable backend slice, not live service evidence.** The backend document calls the relay/text-director slice “Deployable test-stage source and local evidence, not a deployed/live integration,” and `README.md` separately says “No backend is deployed and no real AWS/device integration is claimed.” ([docs/backend-deployment.md:3-3](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L3-L3), quote: “not a deployed/live integration”; [README.md:18-18](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/README.md#L18-L18), quote: “No backend is deployed”.)
3. **Signed bundle path versus draft local content path.** The bundle loader verifies Ed25519 signatures, schema/graph identity, and asset hashes before install/launch, while the local content server explicitly marks its served health state as `"provenance": "draft-fixture"` and `"signed": false`. ([packages/bundle-loader/src/index.ts:41-58](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/bundle-loader/src/index.ts#L41-L58), quote: “throw new Error("invalid_signature")”; [services/content/src/local-server.ts:18-26](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/services/content/src/local-server.ts#L18-L26), quote: `"provenance": "draft-fixture", "signed": false`.)
4. **Text-only hinting and structured perception, not autonomous science conclusions.** The model gateway only accepts the current approved authored text, and the perception package is an “In-memory structured tracker only.” ([packages/model-gateway/src/index.ts:96-105](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/model-gateway/src/index.ts#L96-L105), quote: “only this node/error's vetted text may pass”; [packages/perception/src/index.ts:123-124](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/perception/src/index.ts#L123-L124), quote: “In-memory structured tracker only”.)

## 3. Findings ledger

### CL-01 — High — owner decision
**Prototype/product boundary must stay narrower than a native or deployed product claim.**

Evidence:
1. [README.md:4-18](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/README.md#L4-L18) — quote: “Fire OS/companion applications not implemented” and “No backend is deployed and no real AWS/device integration is claimed.”
2. [README.md:96-96](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/README.md#L96-L96) — quote: “Fire OS SDK/signing/device or permitted simulator ... remain blocked or unimplemented.”

Impact: publication or release language that implies deployed device/cloud coverage would overstate the sampled evidence.

Recommended correction: keep all public scope, demos, and acceptance gates explicitly limited to the local/manual prototype until native/device/cloud evidence exists.

### CL-02 — Medium — confirmed static
**The sampled content server is a draft unsigned fixture and must not be confused with approved release content.**

Evidence:
1. [services/content/src/local-server.ts:18-26](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/services/content/src/local-server.ts#L18-L26) — quote: `"provenance": "draft-fixture", "signed": false`.
2. [services/content/src/local-server.ts:47-48](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/services/content/src/local-server.ts#L47-L48) — quote: “Draft fixture content on :8081; not signed/approved content”.

Impact: any deployment or demo path that presents this fixture as approved signed content would bypass the reviewed content/publication boundary.

Recommended correction: isolate fixture delivery from release delivery, and make signed-bundle provenance and key custody explicit before any broader pilot claim.

### CL-03 — Medium — confirmed static
**Scoped auth/session controls are visible in the sampled backend design, but public production pairing is still incomplete.**

Evidence:
1. [docs/backend-deployment.md:47-54](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L47-L54) — quote: “Production pairing/session creation is not implemented by this slice”.
2. [docs/backend-deployment.md:66-68](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L66-L68) — quote: “Authentication is in the first `session.hello` frame” and credentials “are rechecked against durable state on every event.”

Impact: the sampled slice supports a constrained authorization design, but not a completed public issuer, consent UX, or release-ready session lifecycle.

Recommended correction: keep auth claims limited to the sampled controlled-test slice until the real issuer/revocation/deletion path is observed end to end.

### CL-04 — Medium — confirmed static
**Model-backed hints are tightly bounded text-only requests with authored fallback, not autonomous model control.**

Evidence:
1. [packages/model-gateway/src/index.ts:50-59](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/model-gateway/src/index.ts#L50-L59) — quote: “const fallback ... text: approvedText ... source: "authored"”.
2. [packages/model-gateway/src/index.ts:96-105](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/model-gateway/src/index.ts#L96-L105) — quote: “only this node/error's vetted text may pass. Models cannot introduce materials, actions or conclusions.”
3. [docs/backend-deployment.md:89-91](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L89-L91) — quote: “there are no image/audio/video blocks, tools, autonomous actions or branch writes.”

Impact: the hint system is intentionally conservative; it cannot be marketed or assessed as open-ended adaptive instruction from the sampled evidence.

Recommended correction: preserve this bounded claim unless and until live-model behavior is independently reviewed and broader output classes are intentionally approved.

### CL-05 — Medium — unverified risk
**Perception thresholds and simulator state do not establish real-world accuracy, learning, accessibility, or child-safety outcomes.**

Evidence:
1. [packages/perception/src/index.ts:1-6](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/perception/src/index.ts#L1-L6) — quote: “MINIMUM_DETECTOR_CONFIDENCE = 0.65” and “STABLE_DURATION_MS = 500”.
2. [packages/perception/src/index.ts:123-124](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/perception/src/index.ts#L123-L124) — quote: “In-memory structured tracker only”.
3. [apps/firetv/src/main.ts:214-215](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/apps/firetv/src/main.ts#L214-L215) — quote: “this is synthetic browser play, not a real camera or experiment”.

Impact: threshold constants and simulator copy do not prove accuracy under lighting/occlusion variance or safe/effective family use on real devices.

Recommended correction: require measured device trials, caregiver review, and explicit manual fallback before making outcome or safety claims.

## 4. Five-discipline assessment

### 4.1 Correctness / code review
Confirmed in sampled source:
- [packages/bundle-loader/src/index.ts:55-58](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/packages/bundle-loader/src/index.ts#L55-L58) — quote: “if (!verify ... ) throw new Error("invalid_signature")”.
- [docs/backend-deployment.md:77-79](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L77-L79) — quote: “Older/out-of-order sequences cannot change state.”

Unverified or blocked: end-to-end signed-content issuance, deployed broker behavior, and native engine/device integration were not observed.

### 4.2 Automation / testing
Confirmed in sampled source:
- [`.github/workflows/pages.yml`:26-29](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/.github/workflows/pages.yml#L26-L29) — quote: “pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build” and “Verify simulator and recording artifact”.
- [README.md:73-75](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/README.md#L73-L75) — quote: “Native integration, E2E, infrastructure, and deployment targets intentionally fail while unavailable.”

Unverified or blocked: none of these checks were rerun here, and workflow success is not equivalent to device/cloud evidence.

### 4.3 DevOps / operations
Confirmed in sampled source:
- [docs/backend-deployment.md:3-3](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L3-L3) — quote: “Deployable test-stage source and local evidence, not a deployed/live integration.”
- [docs/backend-deployment.md:46-57](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L46-L57) — quote: “Attach alarm notifications and cost/abuse monitoring” and “Resource deletion/restore must be rehearsed before release.”

Unverified or blocked: deployment permissions, quotas, live alarms, stack teardown, retained-data cleanup, and restore behavior remain unobserved.

### 4.4 OWASP / security
Confirmed in sampled source:
- [docs/backend-deployment.md:66-68](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L66-L68) — quote: “`$connect` itself is public and confers no session access” and credentials are “rechecked ... on every event.”
- [docs/backend-deployment.md:91-91](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/docs/backend-deployment.md#L91-L91) — quote: “malformed/stale requests fail closed”.
- [services/content/src/local-server.ts:5-6](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/services/content/src/local-server.ts#L5-L6) — quote: “never serve private datasets, reviews, filesystem paths or secrets.”

Unverified or blocked: unauthenticated-socket expiry alarms, production issuer UX, signing-key custody, backup erasure, and live privacy logging practices remain unverified.

### 4.5 UI / UX / accessibility
Confirmed in sampled source:
- [apps/firetv/src/main.ts:20-22](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/apps/firetv/src/main.ts#L20-L22) — quote: “Tab also works. No timed actions.”
- [apps/firetv/src/main.ts:156-180](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/apps/firetv/src/main.ts#L156-L180) — quote: “display.setAttribute("aria-live", "polite")”.
- [apps/firetv/src/main.ts:214-219](https://github.com/knarayanareddy/curiolab/blob/2f933e6324073bac27c03f69e341bfad6700cfd7/apps/firetv/src/main.ts#L214-L219) — quote: “No child account, name, video or audio is collected” and “Use a stable low table”.

Unverified or blocked: real remote behavior, real screen-reader behavior, caregiver comprehension, and child usability on permitted devices were not observed.

## 5. Production blockers and owner questions

1. **Release scope:** Is the next claim only a local/manual prototype, or is a wider pilot being proposed despite `README.md` still listing native/device/backend blockers?
2. **AWS/operator access:** Which approved AWS account, region, budget, and exact Converse-compatible text model ARN will be used for controlled tests?
3. **Pairing/auth ownership:** Who owns the future adult-consent pairing issuer, grant revocation flow, and retention/deletion policy for session records?
4. **Content signing:** Who reviews content, controls the Ed25519 signing key, and approves when draft fixtures may be replaced by signed release bundles?
5. **Device and family validation:** Which permitted Fire TV/device path, accessibility reviewers, and adult-supervised family trials will supply the first real device evidence?
6. **Recovery evidence:** Who is responsible for deletion rehearsal, retained-data inspection, rollback evidence, and restore acceptance before any broader release statement?

## 6. Evidence inventory and limitations

Inspected local evidence ranges for this pass:

- `fleet-hardening-review/AUTHOR_CONTRACT.md:1-30`
- `fleet-hardening-review/qa/curiolab-independent-verdict.json:1-273`
- `fleet-hardening-review/drafts/curiolab/REVIEW.md:1-15` and `drafts/curiolab/REMEDIATION_PLAN.md:1-32` before revision
- `fleet-hardening-review/evidence/curiolab/numbered-sources/README.md.txt:1-98`
- `fleet-hardening-review/evidence/curiolab/numbered-sources/docs/backend-deployment.md.txt:1-123`
- `fleet-hardening-review/evidence/curiolab/numbered-sources/.github/workflows/pages.yml.txt:1-46`
- `fleet-hardening-review/evidence/curiolab/numbered-sources/services/content/src/local-server.ts.txt:1-49`
- `fleet-hardening-review/evidence/curiolab/numbered-sources/packages/bundle-loader/src/index.ts.txt:1-139`
- `fleet-hardening-review/evidence/curiolab/numbered-sources/packages/model-gateway/src/index.ts.txt:1-140`
- `fleet-hardening-review/evidence/curiolab/numbered-sources/packages/perception/src/index.ts.txt:1-180`
- `fleet-hardening-review/evidence/curiolab/numbered-sources/apps/firetv/src/main.ts.txt:1-220`

Explicitly **not** performed: install, build, test, browser run, device run, AWS/SAM deployment, model/provider access, content signing, restore rehearsal, or scientific/family validation. Historical/local documentation about checks and deployment procedures is cited as documentation evidence only, not as independently reproduced runtime proof. Absence from the sampled files above is not evidence of whole-repository absence.

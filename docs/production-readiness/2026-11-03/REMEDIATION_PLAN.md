# CurioLab remediation plan

This plan addresses the sampled prototype boundaries in [REVIEW.md](REVIEW.md). All command/run/deploy examples below are future work items, not actions executed in this QA recovery pass.

## 1. Phased roadmap with entry and exit criteria

### Phase 0 — Baseline and claim boundary
- **Entry:** owner accepts that the current evidence supports a prototype-only review boundary.
- **Exit:** every public/internal status artifact distinguishes local/manual prototype evidence from blocked native/device/cloud claims.

### Phase 1 — Confirmed content, auth, and model-control boundaries
- **Entry:** Phase 0 exit artifacts are approved.
- **Exit:** the team has a written boundary map for draft content, signed bundles, session grants, and text-hint constraints, plus planned negative checks for each fail-closed claim.

### Phase 2 — Device, accessibility, and scientific validation
- **Entry:** owner approves adult-supervised testing scope, permitted hardware/simulator path, and family-safety review process.
- **Exit:** measured device/perception/accessibility evidence exists for the chosen pilot scope, and every unmeasured domain remains explicitly labeled unverified.

### Phase 3 — Release, rollback, and recovery rehearsal
- **Entry:** staging-only infrastructure and prior-version retention are available.
- **Exit:** staged release, rollback, deletion, and restore evidence has been recorded and reviewed before any broader release claim.

### Phase 4 — Independent acceptance
- **Entry:** outputs from Phases 0-3 are assembled in a review packet.
- **Exit:** an independent reviewer can trace each allowed claim to either pinned source or observed staged evidence, and blocked items remain blocked.

## 2. Tasks

### T-01 — Product-truth baseline and claim matrix
- **Links to:** CL-01
- **Prerequisites:** owner confirms that current publication language must stay within prototype scope.
- **Observed paths:** `README.md`, `docs/backend-deployment.md`
- **Steps:**
  1. Compare all current product claims against the sampled prototype evidence and mark each claim as supported, blocked, or future-only.
  2. Write a scope matrix that separates browser simulator, local services, deployable backend source, native/device work, and live AWS/model work.
  3. Define one pilot-ready success statement for the current stage and list every still-blocked native/device/backend capability as unavailable.
- **Expected output:** claim/scope matrix with a single approved prototype-stage status statement.
- **Verification:** an independent reader can pick any public claim and trace it to a sampled source citation or to a “blocked/unavailable” label.
- **Definition of Done:**
  - [ ] Fire OS, companion, device, and live AWS claims are separated from local/manual prototype claims.
  - [ ] One approved stage statement exists and does not overclaim deployment or device proof.
  - [ ] Blocked features are listed as unavailable rather than implied.

### T-02 — Signed-content, session-auth, and hint-boundary map
- **Links to:** CL-02, CL-03, CL-04
- **Prerequisites:** T-01 complete.
- **Observed paths:** `services/content/src/local-server.ts`, `packages/bundle-loader/src/index.ts`, `docs/backend-deployment.md`, `packages/model-gateway/src/index.ts`
- **Steps:**
  1. Trace the difference between draft fixture content, signed bundle verification, and future approved release content, including who controls signing keys and provenance labels.
  2. Trace the session lifecycle from grant issuance assumptions through `session.hello`, per-event rechecks, revocation, and retained-data/deletion boundaries.
  3. Define planned negative checks for unsigned/tampered bundles, replayed or wrong-session grants, stale snapshots, malformed hint payloads, and unavailable live hints.
- **Expected output:** boundary/threat matrix plus a planned negative-test catalog tied to exact observed code paths.
- **Verification:** a reviewer can map each fail-closed claim to a specific sampled path and see what future negative observation would prove it.
- **Definition of Done:**
  - [ ] Draft unsigned content is clearly separated from approved signed content.
  - [ ] Grant scope, revocation, and incomplete production issuer boundaries are documented without overclaiming deployment.
  - [ ] Hint behavior remains described as text-only, vetted, and fallback-based unless new evidence changes that boundary.

### T-03 — Device, accessibility, and scientific validation protocol
- **Links to:** CL-05
- **Prerequisites:** T-01 complete; owner approves adult-supervised device/family testing scope.
- **Observed paths:** `packages/perception/src/index.ts`, `apps/firetv/src/main.ts`, `README.md`
- **Steps:**
  1. Define representative trial conditions for calibration, lighting, occlusion, count correction, and manual fallback, with explicit adult stop criteria.
  2. Define real-device accessibility checks for remote navigation, visible focus, reduced-motion behavior, screen-reader alternatives, and caregiver comprehension.
  3. Define how to record false counts, unavailable services, and aborted trials so failures remain visible rather than silently counted as success.
- **Expected output:** measured-validation protocol for the chosen pilot scope.
- **Verification:** the protocol requires observed measurements, recorded failures, and explicit blocked outcomes; passing cannot be inferred from constants or simulator copy alone.
- **Definition of Done:**
  - [ ] Calibration/occlusion/lighting cases are listed with explicit observation fields.
  - [ ] Accessibility and caregiver-review checks are defined for a permitted real-device path.
  - [ ] Manual fallback and stop conditions are written before field testing begins.

### T-04 — Controlled release, rollback, and recovery rehearsal
- **Links to:** CL-01, CL-02, CL-03; preventive release requirement
- **Prerequisites:** T-02 complete; staging resources and prior-version retention are available; owner approves controlled operator testing.
- **Observed paths:** `docs/backend-deployment.md`, `README.md`
- **Steps:**
  1. Define the staging-only release gate, including required approvals, exact retained artifacts, and the rule that prototype/demo evidence must not be relabeled as production evidence.
  2. Rehearse planned deletion, grant revocation, stack teardown, retained-data inspection, and restore/rollback capture on staging only.
  3. Record rollback triggers, recovery time expectations, and evidence-retention requirements for the prior signed bundle and prior backend configuration.
- **Expected output:** staged release-and-recovery runbook with rollback decision points.
- **Verification:** an independent reviewer can inspect the staged evidence packet and confirm that release, rollback, deletion, and restore were observed rather than assumed.
- **Definition of Done:**
  - [ ] Release gate names required approvals and retained prior versions.
  - [ ] Rollback triggers and recovery evidence requirements are documented.
  - [ ] Deletion/restore rehearsal is required before any broader release claim.

### T-05 — Independent acceptance packet
- **Links to:** preventive acceptance requirement
- **Prerequisites:** T-01 through T-04 complete.
- **Observed paths:** outputs of T-01 through T-04; future co-located review artifacts
- **Steps:**
  1. Assemble a packet that links each allowed claim to either pinned source evidence or staged observed evidence, with blocked items listed separately.
  2. Perform a negative-control review to confirm that deliberately broken conditions would fail the acceptance story instead of being masked by fallback/demo behavior.
  3. Obtain explicit owner sign-off on what remains unverified and prohibit broader release language until the independent reviewer accepts the packet.
- **Expected output:** independent-acceptance packet and sign-off record.
- **Verification:** a fresh reviewer can reproduce the claim boundaries without relying on oral context, unstated provider access, or undocumented assumptions.
- **Definition of Done:**
  - [ ] Every accepted claim is traceable to evidence.
  - [ ] Negative controls are specified for the critical fail-closed paths.
  - [ ] Remaining unknowns are listed as unknowns, not implied passes.

## 3. Task dependency map

| Task | Depends on | Unblocks |
| --- | --- | --- |
| T-01 | Owner prototype-scope decision | T-02, T-03 |
| T-02 | T-01 | T-04 |
| T-03 | T-01 + owner device/family approval | T-04, T-05 |
| T-04 | T-02 + staging/owner release approval | T-05 |
| T-05 | T-01, T-02, T-03, T-04 | Independent publication review |

## 4. Changes requiring owner approval

- Any move from prototype wording to broader pilot/release wording.
- Any use of AWS accounts, Bedrock/converse-compatible model entitlements, or billable infrastructure.
- Any child/family participation, permitted device use, or caregiver/usability study.
- Any signing-key custody process or replacement of draft fixture content with approved signed content.
- Any retention/deletion policy, restore target, or recovery objective that affects user/session data handling.

## 5. Production acceptance checklist

- [ ] T-01 through T-05 complete.
- [ ] Current scope statement still matches observed evidence.
- [ ] Draft fixture content is not presented as approved release content.
- [ ] Auth/session claims remain limited to observed staged behavior.
- [ ] Model-hint claims remain limited to vetted text-only behavior unless new evidence is independently reviewed.
- [ ] Device/accessibility/scientific claims are backed by measured evidence for the exact released path.
- [ ] Release, rollback, deletion, and restore evidence is retained for review.
- [ ] An independent reviewer accepts the evidence packet without relying on unstated assumptions.

## 6. Release, rollback, and recovery policy

- **Release policy:** release only from an approved staging path whose evidence matches the exact artifact/configuration being promoted; no demo-only, simulator-only, or undeployed-source evidence may be relabeled as production evidence.
- **Rollback policy:** keep the prior signed content bundle, prior backend configuration, and prior access-control settings available until the new staged release passes acceptance and the agreed observation window.
- **Recovery policy:** treat deletion, revocation, retained-data inspection, and restore as required acceptance work, not follow-up cleanup. Recovery is incomplete until the team records what data remained, what was removed, and how the service returned to a known state.

## 7. Independent verification rules

1. Negative tests must show a real fail-closed result for tampered content, wrong-session/replayed grants, malformed or stale hint requests, and unavailable services.
2. Device/accessibility/scientific acceptance must rely on observed trials and recorded failures, not simulator copy, threshold constants, or documentation promises.
3. Release/recovery acceptance requires observed staged evidence of rollback and restore behavior; build/test counts alone are insufficient.

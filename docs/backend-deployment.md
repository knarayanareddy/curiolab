# Structured relay, text director and voice intent slice

Recorded 2026-10-24. **Deployable test-stage source and local evidence, not a deployed/live integration.** This extracted checkout is the CurioLab project root. No controlled specification/schema/UI contract or shared project standard was changed. The user confirmed the canonical scope: structured observations, text-only hints, directional/select/back remote intents, and companion push-to-talk transcript parsing.

## Preflight

- Node 22.22.3, pnpm 10.17.1, Kotlin compiler 2.4.21, Java 17.0.9 (local harness via pinned `jdk4py==17.0.9.2`). The sandbox's Java installation is `/home/user/.cache/curiolab-java/jdk4py/java-runtime`; set `JAVA_HOME` to that directory here, or use your own Java 17 installation.
- AWS SDK v3 clients/document adapter pinned to **3.1156.0**. esbuild **0.28.2** creates self-contained Node 22 ESM Lambda bundles. Vite remains 7.3.7.
- Verified the current official SDK command contracts through GitHub's contents API and the installed SDK types: [ConverseCommand](https://github.com/aws/aws-sdk-js-v3/blob/main/clients/client-bedrock-runtime/src/commands/ConverseCommand.ts), [PostToConnectionCommand](https://github.com/aws/aws-sdk-js-v3/blob/main/clients/client-apigatewaymanagementapi/src/commands/PostToConnectionCommand.ts). These establish text content blocks, model ID, inference configuration, abort signal, connection ID and byte payload mappings—not account/model availability.
- CloudFormation/SAM template linted locally with **cfn-lint 1.58.0**. This validates the SAM transform/resource schema, not deployment permissions, service quotas, or real resource behavior.
- **BLOCKED:** AWS CLI and SAM CLI are absent; no AWS credential environment was present. No deployment, real DynamoDB transaction, API Gateway socket, Bedrock model invocation, model/region access check, or device run occurred. Outbound sandbox networking is also restricted to development/package hosts.

Do not assume Claude 3.5 Sonnet is still available in a particular account/region. The operator must select an available **Converse-compatible text model or inference profile** and grant its exact ARN. Nova Canvas is not a text-hint model and is explicitly rejected. No unavailable model ID or live response has been fabricated.

## Local checks

```sh
make bootstrap
# Java 17 on PATH, or export JAVA_HOME=/path/to/java17
make lint typecheck test-unit test-contract test-infra test-security
corepack pnpm build:backend
corepack pnpm build:firetv
# Optional tool, installed separately:
cfn-lint infra/backend.template.json
```

`make deploy` remains an explicit blocker, not an unattended cloud command. Deployment can create billable resources and must follow the operator procedure below. `make test-infra` now executes actual template policy/resource tests; it no longer just prints a placeholder.

## Operator deployment procedure (not executed here)

1. Install/configure AWS CLI and SAM CLI in an authorized environment. Use an IAM role/SSO/normal SDK credential chain; never put keys in source, browser code, query strings, chat, or committed configuration.
2. Run `aws sts get-caller-identity` and explicitly confirm the target account, region, budget and permission to create IAM, API Gateway, Lambda, CloudWatch and DynamoDB resources. Check API Gateway/Node 22/Lambda concurrency availability in that region.
3. Inspect `aws bedrock list-foundation-models --by-output-modality TEXT --region "$AWS_REGION"` and any chosen inference profile. Verify current lifecycle, Converse support, model entitlement and invocation quota. Verify the model ARN matches its ID. The policy intentionally grants `bedrock:InvokeModel` only to `TextModelArn`. A cross-region inference profile can require *additional exact underlying model ARNs*: review/extend the policy explicitly before using it; do not replace it with `Resource: "*"`.
4. Build the backend and deploy the **test** stack with operator-selected real values:

   ```sh
   corepack pnpm build:backend
   sam validate --lint --template-file infra/backend.template.json
   sam deploy --template-file infra/backend.template.json \
     --stack-name curiolab-backend-test --region "$AWS_REGION" \
     --resolve-s3 --capabilities CAPABILITY_IAM \
     --parameter-overrides TextModelId="$TEXT_MODEL_ID" \
       TextModelArn="$TEXT_MODEL_ARN" LiveHintsEnabled=false
   ```

5. Retrieve `WebSocketUrl`, `HintUrl`, and `SessionTable` outputs. First test with hints disabled, then explicitly enable live hints only after confirming model access and budgets. The stack provides an encrypted on-demand DynamoDB table with PITR and TTL, throttled WebSocket routes, application-authorized HTTP hint route, bounded Lambda concurrency/timeouts, seven-day Lambda log retention and Lambda error alarms. Attach alarm notifications and cost/abuse monitoring before opening access beyond operator testing.
6. Production pairing/session creation is **not** implemented by this slice. For an explicitly adult-approved operator test only, use:

   ```sh
   # Set RELAY_TABLE to the actual SessionTable output before running this command.
   corepack pnpm backend:test-session --adult-approved-test-session
   ```

   The utility uses real SDK calls, creates one TV and one companion grant with 12-hour expiry and hashes in DynamoDB, and writes plaintext test credentials **only** to a new mode-0600 file in ignored `.private/`. It prints no credential. Restrict access, never share/commit the file, revoke/delete test rows when finished and remove the local file. This is an operator test handoff, **not** a one-time six-character pairing service or an adult-consent UX implementation. Normal operation still requires the future durable issuer to integrate the canonical pairing lifecycle.
7. Open two real WSS clients using their scoped *application* credentials, authenticate with `session.hello`, and exercise the protocol below. Publish an actual committed TV snapshot before requesting a hint. A browser deployment must reverse-proxy `/v1/hints` to the emitted stage URL; pass application bearer/session/device headers using `HttpHintTransport`'s header supplier. Do not give the browser AWS credentials. The development simulator is deliberately still cloud-disabled and is not silently connected to the stack.
8. Run the live failure matrix: expired/revoked grant, reconnect/replaced socket, replay/out-of-order event, media/oversize rejection, wrong role/session, dropped/Gone peer, concurrent snapshot updates, throttling, model timeout/malformed output, disabled hints, offline/manual completion and device latency. Confirm logs never contain tokens/transcripts/observations/private media, API data tracing is disabled, and account-level model invocation logging complies with privacy policy. Record real results separately.
9. After testing, disable hints/revoke grants, delete the stack and inspect retained DynamoDB data. The table is intentionally retained on stack deletion; remove test rows/table/backups under the approved deletion policy. Resource deletion/restore must be rehearsed before release.

## Relay implementation and wire contract

- `services/session-relay/src/broker.ts`: typed broker, grants and storage/delivery ports. Each message is limited to 16 KiB; binary/base64 events, unexpected fields and raw media are rejected. Authorized companions may send only candidate/stopped observations and bounded transcript text. Only the authorized TV may publish committed snapshots. Measurements are not computed or committed by the broker/model. TV engine/content validation remains the source of graph authority.
- `aws-adapters.ts`: strongly consistent DynamoDB reads, conditional aggregate replacement for session version, TTL connection binding, and API Gateway management post/delete commands.
- `lambda.ts`: `$connect`, `$disconnect`, `$default` API Gateway routes; fixed deployment-owned management endpoint, safe status/request ID/duration logs, bad/unauthorized sender closure. SDK connect/request timeouts are explicit; model and management calls are not retried. Dynamo conditional conflicts retry at most three read/CAS cycles; idempotent SDK Dynamo requests have at most two SDK attempts.
- `infra/backend.template.json`: test-stage SAM/CloudFormation and narrow table/model/API policies. No raw payload tracing, public credential issuer, or direct browser AWS keys.

Authentication is in the **first `session.hello` frame**, not the URL. `$connect` itself is public and confers no session access. Unauthenticated open sockets rely on gateway idle limits and connect throttling; they are closed on invalid/unauthorized messages. Dedicated unauthenticated-socket expiry/abuse alarms and full ingress hardening remain release work. This is one reason the stack is for controlled operator testing, not public production release.

All frames carry the canonical envelope (`schema_version`, `message_id`, `session_id`, `device_id`, `sequence`, `sent_at`, `type`, `payload`). Credentials bind to session, device, role and expiry and are rechecked against durable state on **every** event. A reconnect replaces only that device's connection binding. A stale socket cannot send after replacement; stale disconnect events do not remove the new binding. Setting a grant `revoked` or a session `completed` using an authorized, version-conditional issuer/admin update immediately denies further events. Adult revocation/completion HTTP wiring remains future issuer work.

Supported payloads:

- Client `session.hello`: `{credential, last_acknowledged_sequence}`.
- Server `session.hello` reply: `{resume_sequence, snapshot, stopped}` (each state nullable); envelope device is `relay`. Clients resume their own sending cursor above `resume_sequence`, validate the snapshot, and can recover the last pending stopped observation. `last_acknowledged_sequence` is accepted for compatibility; this is last-state hydration, **not** an arbitrary historical event replay API.
- Companion `observation.candidate`: `{trial, observed_count, confidence, calibration, frame_sequence}`. Calibration is the existing client's restricted status string. Candidate frames are transient, best effort, never cached as measurements.
- Companion `observation.stopped`: `{trial, last_stable_count, confidence, stop_reason: "adult_marked_stop"}`. The pending structured stop is durably retained for reconnect until the next committed TV snapshot.
- Companion `voice.transcript`: `{transcript, confidence, push_to_talk_session}`. Bounded text is forwarded transiently; no transcript/audio is persisted. Native adapter must send only the final transcript after a visible, held companion recording.
- TV `state.snapshot`: `{state, expected_state_sequence}`. State contains `current_node_id`, `content_version`, `state_sequence`, authored prediction enums and confirmed measurement counts. Values are validated, measurements require predictions, prior committed values cannot be changed, and expected sequence/CAS prevents stale overwrites. The TV remains responsible for valid graph progression and actual adult confirmation; the broker is not an alternate graph engine.

Messages have per-device durable cursors and a bounded 64-ID recent deduplication window. Older/out-of-order sequences cannot change state. A successful CAS precedes forwarding; failed peer delivery yields unavailable. Candidates may be dropped; snapshots and the pending stop can be recovered by reconnect. There is **no general event outbox/exactly-once network delivery**. A new TV snapshot clears the pending stop; TV adapters must publish only genuine committed engine state, not optimistic confirmations. Client callbacks must hydrate the native engine through its validation/recovery API, not write measurements directly.

The client now validates hello/resume, snapshots and transcripts, and provides `send` for typed observation/snapshot/transcript payloads only after hello acknowledgement. `connected` still labels an open transport; `send` separately requires authenticated handshake. No automatic credential refresh or infinite reconnect/retry loop is added.

Per-session relay rate is capped at 40 accepted events/second, with gateway throttling and reserved concurrency as additional caps. This favors the specified target 15 fps but is **not** hardware/network latency evidence. The 700 ms p95 integration requirement remains blocked pending deployment/device measurements.

Durable state expires logically after seven days; grants expire after 12 hours and connection bindings carry TTL. DynamoDB TTL is asynchronous and **does not prove physical deletion at exactly seven days**. Automatic deletion jobs, issuer revocation/completion wiring, backup erasure, restore and retention evidence remain incomplete.

## Text-only Bedrock director

`services/hints/src/bedrock-director.ts` implements the existing shared `HintTransport` with AWS SDK `ConverseCommand`. The model ID is deployment-owned configuration. Requests include only system/user **text** blocks, fixed `hint_generate.v1` / `hint_v1` instructions, temperature zero and 180-token cap; there are no image/audio/video blocks, tools, autonomous actions or branch writes. Output must be one completed text block containing the expected JSON, then pass the existing shared ModelGateway schema, same-level recovery, 5–45 words, markup/control rejection and node/error-specific vetted-text allowlist. The current conservative director returns the active context's authored wording; it does not claim unconstrained creative generation. Catalog safety/human approval is still development-only, not release evidence.

`services/hints/src/lambda.ts` authenticates the TV grant using server-side durable state, verifies the requested node matches the last committed snapshot, rejects unknown/media fields and bounds the request. It permits six hint requests per session/minute with version-conditional spend limiting. A storage outage returns 503; malformed/stale requests fail closed; the client retains authored fallback on HTTP failure. Model failure, truncation, unsafe/malformed output, timeout or disabled live transport returns the authored hint in the canonical response shape. The provider has a 1,200 ms request timeout; ModelGateway imposes a 1,500 ms default total provider budget with abort. No model output can select or mutate a graph variable.

Actual Bedrock invocation, prompt/catalog approval, regional access, cost/error evaluation and shared-gateway native product-path evidence remain **blocked**. No Canvas or scene director was added.

## Directional and push-to-talk intents

- `packages/episode-engine/.../InputIntents.kt`: pure Kotlin Android-key-code mapping for D-pad, select/Enter and Back. Key-up/repeated activation is ignored; the OS-owned voice-assist key is not intercepted as a microphone API. Native Fire TV event plumbing still needs a real application/device.
- `predictionVoiceOption` maps only final, finite confidence ≥0.85, short, exact/synonym phrases for the **current trial**, with matching active PTT session. Ambiguous/composite phrases do not select a prediction.
- `EpisodeCoordinator.acceptVoicePrediction` only works at prediction stages after preflight. Successful PTT IDs cannot be replayed into a second trial. It stores selected options/consumed IDs only, never raw text.
- `packages/voice/src/push-to-talk.ts`: companion lifecycle policy for explicit permission, visible foreground hold, release, 10-second hold cap, five-second final-transcript window, cancellation, and one-shot mapping/discard. This is an adapter contract, not actual microphone capture or a timer-driven native service. A future native adapter must stop audio on release/background/permission loss and drive the deadline check; it must discard audio/text after mapping.
- The web simulator uses the shared remote parser. Back dismisses hints or opens a focused pause/return/clear sheet without discarding committed values. No simulator microphone or continuous listening was introduced.

**Blocked:** CameraX/Android/Fire TV hardware, native PTT indicator/permissions/capture, Amazon Transcribe Streaming, real remote/voice-assist platform behavior and accessibility validation. These parsers are not evidence that a real voice integration ran.

## Validation, paths and remaining release work

Passing local checks on this slice:

| Check | Result |
| --- | --- |
| `make lint typecheck` | Pass, strict TS and Kotlin compile |
| TypeScript unit | 67 passed (9 broker, 8 voice, 6 TV UI among existing suites) |
| Kotlin engine/domain | 24 passed (3 new input/voice scenarios) |
| Contract | 24 passed, including SDK mappings, Lambda routes, privacy-safe logs, director failures, HTTP auth/spend limiting and bidirectional real-client/broker logic over injected transport |
| Infrastructure policy/resource tests | 2 passed |
| Existing publication security test + npm audit | Pass; no known vulnerabilities reported |
| Backend bundles + module import smoke | Pass; imports do not invoke AWS |
| Web production build | Pass |
| `cfn-lint 1.58.0` template validation | Pass, no diagnostics |

Tests: `tests/unit/relay-backend.test.ts`, `tests/unit/voice.test.ts`, `tests/unit/firetv-ui.test.ts`, `packages/episode-engine/src/test/kotlin/com/curiolab/episode/EpisodeEngineTestSuite.kt`, `tests/contract/backend-adapters.test.ts`, `tests/contract/relay-lambda.test.ts`, `tests/contract/client-broker-session.test.ts`, `tests/infra/backend-template.test.ts`.

`packages/testkit/src/backend-fixture.ts` is explicitly local in-memory test state/SDK transport evidence, not DynamoDB or AWS connectivity. Contract tests use genuine SDK command classes with injected responses, not provider observations. No real network WebSocket, deployed data store, model response, physical device, family approval, performance outcome or branch-coverage threshold is claimed. Infrastructure validation/build success does not close those gates. Integration requirements stay `in_progress`; their live/deployment gates are blocked as listed above.

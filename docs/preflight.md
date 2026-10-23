# CurioLab preflight

Recorded 2026-10-23 for the initial local foundation. This records available tools and explicit blockers; it is not a device or release certification.

## Available and exercised

| Capability | Recorded version/state |
| --- | --- |
| Node.js / pnpm | Node 22.22.3; pnpm 10.17.1 through Corepack |
| TypeScript / tests | TypeScript 5.9.3; Vitest 5.0.5 |
| Kotlin compiler | Official npm `kotlin-compiler` 2.4.21, pinned and lockfile-controlled |
| Java runtime | Temurin 17.0.9+9, sufficient for the pure Kotlin compiler harness |
| Schema validation | Ajv 2020 8.20.0 and ajv-formats 3.0.1 |

The Kotlin harness compiles main and test sources directly and runs a main-class test suite. It needs `JAVA_HOME` or `java` on `PATH`. It does not need Gradle for this phase and does not create an Android artifact.

## Blocked or not implemented

- Full JDK/javac, Android SDK, Fire OS SDK, signing material, and Fire TV device or permitted simulator.
- Android companion, CameraX perception, physical mat/coins, and real experiment observations.
- Deployed pairing/session relay, API Gateway WebSocket, AWS credentials, Bedrock, Polly, and Transcribe.
- Real episode assets, cryptographic bundle signing/verification, human reviews, and publication.
- Family safety/accessibility studies, learning outcomes, performance measurements, and release evidence.

The available Java runtime is not a full Android toolchain. `apps/`, `services/`, and `infra/` placeholders do not imply those implementations exist.

## First local checks

```bash
node --version
java -version                 # or use JAVA_HOME
make bootstrap
make lint typecheck test-unit test-contract test-security build
corepack pnpm validate:content
make dev
```

Publication preflight (`corepack pnpm validate:content -- --publish`) must currently fail. Draft success means only that schema/graph checks passed.

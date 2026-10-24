# Dependency and local demo tooling manifest

Recorded 2026-10-24. `pnpm-lock.yaml` pins the complete graph; the table lists direct versions. No real AWS model invocation, Docker image build or native SDK run is implied.

## Runtime/toolchain

- Node 22.x; local execution: 22.22.3. Docker recipe: `node:22.22.0-bookworm-slim` (not built here).
- pnpm 10.17.1 via Corepack.
- Java 17; local compiler runtime: jdk4py 17.0.9.2. Native Android/Fire OS SDK absent.
- Same pinned Kotlin compiler below builds JVM and Kotlin/JS; no second episode engine.
- Video execution tool caches only: Chromium 153.0.8010.0 (`@sparticuz/chromium@153.0.0`), FFmpeg 7.0.2 (`imageio-ffmpeg==0.6.0`). These are not product dependencies; normal recorder setup uses Playwright's installer. See `local-demo.md`.
- AWS model ID remains operator configuration; live hints are disabled in the simulator.

## Direct dependencies

| Package | Version | Scope |
| --- | --- | --- |
| `@aws-sdk/client-apigatewaymanagementapi` | `3.1156.0` | dependencies |
| `@aws-sdk/client-bedrock-runtime` | `3.1156.0` | dependencies |
| `@aws-sdk/client-dynamodb` | `3.1156.0` | dependencies |
| `@aws-sdk/lib-dynamodb` | `3.1156.0` | dependencies |
| `@eslint/js` | `10.0.1` | devDependencies |
| `@types/node` | `22.18.6` | devDependencies |
| `@types/ws` | `8.18.2` | devDependencies |
| `ajv` | `8.20.0` | devDependencies |
| `ajv-formats` | `3.0.1` | devDependencies |
| `esbuild` | `0.28.2` | devDependencies |
| `eslint` | `10.13.0` | devDependencies |
| `jsdom` | `26.1.0` | devDependencies |
| `kotlin-compiler` | `2.4.21` | devDependencies |
| `playwright` | `1.64.1` | devDependencies |
| `prettier` | `3.6.2` | devDependencies |
| `tsx` | `4.20.6` | devDependencies |
| `typescript` | `5.9.3` | devDependencies |
| `typescript-eslint` | `8.72.0` | devDependencies |
| `vite` | `7.3.7` | devDependencies |
| `vitest` | `5.0.5` | devDependencies |
| `ws` | `8.22.0` | devDependencies |
| `yaml` | `2.9.1` | devDependencies |

No unpinned runtime browser download or provider call occurs during Pages execution. The compiler-generated ES module is rebuilt from source and excluded from Git.

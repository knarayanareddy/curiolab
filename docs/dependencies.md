# CurioLab dependencies

## Locked local toolchain

- Node.js 22.x, Corepack, and pnpm 10.17.1.
- TypeScript 5.9.3, ESLint 10.13.0, Prettier 3.6.2, and Vitest 5.0.5.
- Ajv 8.20.0 and ajv-formats 3.0.1.
- Official npm `kotlin-compiler` 2.4.21 for the pure Kotlin harness.
- Java 17 runtime supplied by the workstation; Java is an external prerequisite, not a bundled Android JDK.

All npm packages are development dependencies in this phase. `pnpm-lock.yaml` controls the resolved graph. Only `esbuild` install scripts are explicitly allowed. The Kotlin harness invokes the compiler directly; no Gradle dependency resolution or Android artifact exists.

## Security audit

The first audit found Vitest/Tinypool and Ajv advisories. Vitest was updated from 3.2.4 to 5.0.5 and Ajv from 8.17.1 to 8.20.0. After lockfile updates and test reruns, this command reported no known vulnerabilities on 2026-10-23:

```bash
corepack pnpm audit --audit-level=moderate
```

This does not audit the external Java runtime, Android/Fire OS dependencies, or future AWS SDKs; those are not yet present. License, native supply-chain, and release security reviews remain separate gates.

## External dependencies still blocked

Fire OS/Android SDKs and devices, CameraX, relay/pairing infrastructure, Bedrock, Polly, Transcribe, signed content assets, and credentials remain absent. The npm Kotlin compiler must not be represented as an Android toolchain.

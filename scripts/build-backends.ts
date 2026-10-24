import { build } from "esbuild";
await build({
  entryPoints: {
    relay: "services/session-relay/src/lambda.ts",
    hints: "services/hints/src/lambda.ts",
  },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: "build/backend",
  outExtension: { ".js": ".mjs" },
  sourcemap: true,
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});
console.log(
  "Built relay.mjs and hints.mjs; no deployment or AWS invocation performed.",
);

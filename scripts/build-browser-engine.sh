#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPILER="$ROOT/node_modules/kotlin-compiler"
SOURCE="$ROOT/packages/episode-engine/src/main/kotlin/com/curiolab/episode"
OUT="$ROOT/build/kotlin-browser"
mkdir -p "$OUT" "$ROOT/apps/firetv/src/generated"
# The persistence/JVM stdin adapters are intentionally excluded, not reimplemented.
SOURCES=()
for name in AdultPreflight EpisodeEngine ManualEpisodeSession EpisodeCoordinator InputIntents SimulatorProtocol; do
  SOURCES+=("$SOURCE/$name.kt")
done
SOURCES+=("$ROOT/packages/episode-engine/src/jsMain/kotlin/com/curiolab/episode/BrowserSimulator.kt")
"$COMPILER/bin/kotlinc-js" "${SOURCES[@]}" \
  -ir-output-dir "$OUT" -ir-output-name engine \
  -libraries "$COMPILER/lib/kotlin-stdlib-js.klib"
"$COMPILER/bin/kotlinc-js" -Xir-produce-js -Xir-dce -Xinclude="$OUT/engine.klib" \
  -libraries "$COMPILER/lib/kotlin-stdlib-js.klib" -module-kind es -target es2015 \
  -ir-output-dir "$OUT/js" -ir-output-name engine
cp "$OUT/js/engine.mjs" "$ROOT/apps/firetv/src/generated/engine.mjs"

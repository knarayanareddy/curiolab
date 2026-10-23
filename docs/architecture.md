# CurioLab foundation architecture

## Implemented boundaries

```text
authored draft episode ──► canonical schema + graph/publication preflight

prediction intents ──► immutable EpisodeState ──► confirmed trial measurements
                              │                         │
                              │                         ▼
                              │              exact scene parameter values
                              │                         │
                              └──────────────► deterministic comparison
```

- `packages/episode-engine/` is pure Kotlin. Predictions must precede their measurements; counts are bounded; expected state sequences reject stale commits; repeated identical commits are idempotent.
- Scene parameters and summaries read committed confirmed counts. Greater/equal/lower comparisons have no model or network dependency.
- A committed state can be reconstructed from an `EpisodeState` value. Durable process-death storage is not implemented.
- `packages/content-compiler/` validates the canonical schema, references, reachability, cycles, and publication prerequisites. Draft graph success is not asset/signature verification.
- `content/episodes/bridge-to-moon-base/reviews.json` records pending human reviews and forbids publication.

## Deliberately absent

No Fire OS scene renderer, Android companion, CameraX count observation, pairing, WebSocket relay, model/voice service, persistence, or signed bundle loader exists. Reserved directories are not implementations.

Future observation adapters may propose measurements, but only adult/family-confirmed values may enter the episode domain. Model-generated hints must remain separate from branch and measurement authority.

## Independence and output limits

CurioLab shares no production runtime or database with sibling projects. The walking object executes two fictional trials and prints a branch/values summary. It does not claim a physical experiment, actual child response, network outage test, or learning outcome.

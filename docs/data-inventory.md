# CurioLab data inventory

Inventory date: 2026-10-23. All current episode values are synthetic development fixtures.

| Data | Current location | Classification/provenance | Retention and use |
| --- | --- | --- | --- |
| Draft episode graph | `examples/`, `content/episodes/bridge-to-moon-base/` | Authored fictional science content; placeholder hashes | Source-controlled draft; schema/graph tests only |
| Review registry | `content/episodes/bridge-to-moon-base/reviews.json` | Pending statuses and null reviewers | Publication remains forbidden |
| Prediction/measurement state | Kotlin tests, walking object, temporary snapshot files | Fictional predictions, stopped/corrected coin counts, reflection, stage/sequence, and accessibility mode | In-memory values plus checksummed atomic fixture-file reopen; walking/test directories are removed; no database, retention schedule, or production snapshot store |
| Schema copy | `packages/content-compiler/` | Non-sensitive content contract | Byte-identical drift test |
| Configuration examples | `.env.example` | Safe local placeholders | Real `.env*` files are Git-ignored |

## Not present or collected

No child name/account, precise location, camera frame, raw video/audio, voice transcript, behavioral profile, advertising identifier, pairing credential, real family response, or learning assessment is present. No analytics, cloud storage, model prompt log, or physical experiment record exists.

Future companion frames must remain in on-device memory and be reduced to structured observations. Child-facing session snapshots, hints, transient voice, and caches require the specified consent, minimization, seven-day/short-lived retention, and verified deletion behavior before implementation can be release-verified.

The empty `content/datasets/` boundary contains no observation or training dataset. Placeholder hashes and empty asset directories are not signed content or real media.

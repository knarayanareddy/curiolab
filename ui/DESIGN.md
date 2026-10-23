# CurioLab — Visual and Component Design

**Direction:** storybook laboratory
**Tokens:** [tokens.json](./tokens.json)
**Screens:** [WIREFRAMES.md](./WIREFRAMES.md) and [browser wireframes](./wireframe.html)

## 1. Design thesis

The television is a moon-base story stage; the companion is a calm lab instrument. Deep ink-blue surfaces make the warm paper experiment and solar-yellow result visually prominent. Mint is used for collaborative/helpful states, coral only for errors. There are no classroom dashboards, lesson carousels, or toy-like inflated cards.

The generated Fredoka suggestion is retained only as an optional display face. The recommendation to avoid dark mode is rejected because a controlled dark scene is appropriate for TV, provided captions and controls meet the stronger contrast budget.

## 2. Fire TV layout

- 1920×1080 reference with 96 px safe inset.
- Story scene occupies the full artboard; critical content sits in two stable zones: narrative/instruction left, action/measurement right.
- A bottom caption band holds at most three lines, 46 characters maximum per line, on an opaque surface.
- Prediction choices appear as two large horizontal options per row, never a grid of tiny cards.
- Lab instructions use at most three numbered steps on screen; detailed safety remains accessible through a focused adult panel.
- Measurement confirmation is a dedicated quiet scene, not an overlay on a moving animation.

### Focus behavior

Focused controls receive a 4 px solar outline, a small left marker, and a text label when icon meaning is not obvious. Scale never exceeds 1.02. Disabled controls remain readable and explain why disabled. Focus returns to the triggering control after a sheet closes.

## 3. Companion layout

- Single-column 360–480 px utility layout with 16 sp body and 48 dp controls.
- Camera preview appears only during adult calibration; regular play shows status and current stable count.
- Top status is explicit: `Mat aligned`, `Coin count needs review`, or `Camera unavailable`.
- Primary controls: `Mark stop`, `Retry calibration`, `Use TV instead` according to state. `Mark stop` is visually distinct from camera permission.
- Debug contours are off by default and enabled only in the adult setup panel.

## 4. Typography and color

- Fredoka/Trebuchet fallback for short scene titles only.
- Atkinson Hyperlegible/Verdana fallback for instructions, captions, measurements, and companion UI.
- Body 30 px on TV, 26 px minimum secondary text, 16 sp on companion.
- Exact counts use 64–96 px display type with tabular figures and the unit `coins` in words.
- Warm off-white text is used on dark surfaces; muted text still exceeds 4.5:1.

## 5. Component contracts

| Component | Anatomy and behavior | Accessibility/content requirement |
| --- | --- | --- |
| `CL-StoryFrame` | Authored scene, stable instruction/caption zones, optional scene parameters | Scene cannot obscure text; essential action has audio description |
| `CL-PredictionChoice` | 2–4 large options, current focus, selected marker, prediction prompt | Selection does not reveal correctness; remote focus order is geographic |
| `CL-LabSteps` | Step number, short instruction, material icon/text, adult safety entry | No more than three steps; non-camera route visible |
| `CL-PairingSheet` | QR, short code, expiry, pairing state, manual-mode action | Code is read aloud in grouped characters and is not a password |
| `CL-CalibrationStatus` | Preview or schematic, four marker states, quality message, retry/manual actions | Marker success uses icon + number + text, not green corners alone |
| `CL-StableCount` | Current observed count, stability, confidence/quality, stop action | Clearly labeled `Observed`, never final until confirmed |
| `CL-MeasurementConfirm` | Large count, minus/plus, observed-vs-confirmed label, confirm | Minimum 44/48 px controls; announces corrected value once |
| `CL-ComparisonScene` | Two actual values, greater/equal/lower text, reflection prompt | Pattern/labels distinguish trials; no universal scientific claim |
| `CL-HintBubble` | Character, one short hint, level, dismiss action | Does not cover lab controls or reveal result prematurely |
| `CL-OfflineNotice` | Last downloaded episode, unavailable camera/hint, manual continuation | Never blocks a downloaded remote-only episode |

## 6. Scene and illustration rules

Moon-base scenery uses broad geometric silhouettes, paper texture, and warm practical lights. Characters have expressive silhouettes but no lip-sync requirement. Measurement-driven crates/bridge elements use authored scene parameters; the exact number always remains in text even when the visual count is capped.

No generated room imagery, child photos, or camera frames enter the story. LabMat illustrations use high-contrast line art and numbered markers.

## 7. Motion and audio

- Scene transitions 450 ms maximum with a static end state under reduced motion.
- No bounce, sparkle rain, confetti, flashing, or continuous particle backgrounds during instructions.
- Verification uses a steady progress line rather than flickering detections.
- All character dialogue has captions; audio description covers essential visual changes.
- Sounds do not autoplay on the companion and are never the sole success cue.

## 8. Required visual states

Pairing: unpaired, waiting, connected, expired, denied, offline. Calibration: aligned, missing marker, blur, occlusion, poor light, permission denied. Measurement: observing, needs review, stopped, corrected, confirmed. Content: downloading, verified, cached, corrupt/rejected. Each state has a named next action.

## 9. Implementation handoff

Fire TV Leanback views and libGDX scenes share a `SceneUiModel` containing instructions, captions, focus target, and exact scene parameters. The renderer never owns text measurement logic. Android companion colors and control semantics derive from the same token roles but use native dp/sp dimensions.

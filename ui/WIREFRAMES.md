# CurioLab — Low-Fidelity Wireframes

Open [wireframe.html](./wireframe.html). TV artboards use a 16:9 composition and scale to the browser; the companion uses a narrow phone artboard. These are static layout studies, not Fire OS/Android builds, and all episode and measurement values are fictional.

## Screen inventory

| Anchor | Screen | Purpose | Primary path |
| --- | --- | --- | --- |
| `#story` | Story and prediction | Understand the mission and commit a prediction | Choose a prediction |
| `#lab` | Lab instruction | Perform the experiment with adult safety and pairing context | Start observation or use remote-only route |
| `#measurement` | Measurement confirmation | Reconcile observed and family-confirmed count | Correct if needed, then confirm |
| `#comparison` | Trial comparison | Compare two actual trials and reflect | State a pattern or continue story |
| `#setup` | TV pairing | Pair companion without making camera mandatory | Scan QR/enter code or continue on TV |
| `#companion` | Android camera status | Understand calibration and stable-count state | Mark stop, retry, or switch to TV |

## 1. Story and prediction

**Composition:** moon-base establishing scene, mission dialogue left, two prediction choices right, caption band and focus hint at bottom.

**Fictional content:** `The Bridge of Twelve`, prepare a crate bridge across a moon-base channel.

**Annotations**

- Prediction selection is not scored right/wrong.
- Remote focus is visible on exactly one control.
- Caption and objective remain readable without audio.

**State variants:** intro; focused choice; selected choice; replay narration; reduced motion; offline downloaded episode.

## 2. Lab instruction

**Composition:** authored lab bench scene, three numbered steps, material list, camera/companion status, adult safety entry.

**Annotations**

- `Use TV instead` remains visible before pairing and after camera errors.
- Safety information is available without leaving the episode.
- Instructions do not depend on recognizing real-world objects.

**State variants:** companion connected; unpaired; camera denied; LabMat missing; content still downloading; remote-only.

## 3. Measurement confirmation

**Composition:** quiet scene, large exact count, observed status, minus/plus controls, `Confirm 12 coins`, correction explanation.

**Fictional content:** observed count 11, family corrected to 12 before confirmation. The browser artboard shows the corrected stable state.

**Annotations**

- Observed and confirmed values are never conflated.
- A capped visual crate representation cannot override the exact number.
- Focus lands on the correction control first when review is required, not on a destructive/reset action.

**State variants:** observing; needs review; stable observed; corrected; confirmed; manual entry; camera unavailable.

## 4. Trial comparison

**Composition:** two authored trial scenes with pattern + numeric values, comparison sentence, reflection choices, story continuation.

**Fictional content:** 8 coins/3 crates versus 12 coins/4 crates, family-confirmed for this episode only.

**Annotations**

- Copy says `In our two trials`, avoiding a universal law.
- Equal and lower outcomes have equivalent layouts.
- The actual values remain in text even if the renderer caps repeated objects.

**State variants:** greater; equal; lower; missing trial; replay comparison; reduced motion.

## 5. TV pairing

**Composition:** short code and QR placeholder, five-minute expiry, connected-player status, `Continue without camera`.

**Annotations**

- QR is an intentionally nonfunctional wireframe placeholder, not a real pairing payload.
- Code expiry is stated without a rapidly announcing live countdown.
- TV-only route has equal discoverability.

## 6. Android companion

**Composition:** camera-status panel, LabMat corner schematic, observed count/stability, `Mark stop`, retry and TV-mode actions.

**Annotations**

- Debug contours are not shown in normal play.
- `Coin count needs review` is not a failure screen.
- Camera permission denial replaces preview with instructions and manual route.

**State variants:** unpaired; calibrating; aligned; blur/occlusion; stable count; permission denied; reconnecting; offline.

## Flow contract

`Downloaded episode → Story/prediction → Lab setup → Optional pairing/calibration → Observe/manual count → Family confirmation → Deterministic comparison → Reflection/story`

Camera or pairing failure routes to TV/manual interaction without resetting episode progress. The browser page does not access a camera, render a real QR, or run inference.

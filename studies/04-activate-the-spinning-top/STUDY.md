# Study 4 — Activate the spinning top

Source: published artifact "Activate the spinning top" (single self-contained `index.html`, exported unmodified).

## What it does

A small clock reading **3:17** sits above a stationary spinning top, with three numbered marks below it, laid out left to right as **1, 7, 3**. The clock is the clue: the player presses the marks in the order **3 → 1 → 7** (right mark, then left, then middle). When the third correct mark is pressed, the top starts spinning: a marker orbits its cone and light and dark bands sweep across it. A wrong press clears progress after a short beat.

## Main visual and interactive components

| Component | What it is | Where |
|---|---|---|
| Scene | One SVG, `viewBox 0 0 360 400`, scaled by `--s` | `#scene` |
| Clock | Static clock face showing 3:17 | first `<g>` in the SVG |
| Spinning top | Handle, cone, edge highlight, band, top disc, contact shadow, orbiting marker, shine and dusk bands clipped to the cone | `#top`, `#top-body`, `#top-mark`, `#shine`, `#dusk`, `#coneclip` |
| Marks (x3) | Bevelled numbered tiles, built at runtime with `createElementNS` | `#marks`, `.mark`, `ORDER`, `DIGIT` |
| Reset button | Round icon button | `#reset` |

## User actions, feedback, states, transitions

| Action | Feedback / transition | State |
|---|---|---|
| Hover a mark (not locked, not active) | Outlines brighten | idle |
| Press a mark (pointer down, or Enter/Space) | Face nudges 2 px, shadow fades to 25%, outlines go white (all 50 ms linear) | `.down` |
| Drag off while pressed | Pressed look toggles off; releasing outside does nothing | `.down` via `inside()` |
| Release on the correct next mark | Mark stays lit (`.active`); progress `p++` | `.active` |
| Release on a wrong mark | Input locks, mark goes dark (`.error`, no transition). After 250 ms all marks clear, `p = 0`, input unlocks | `.error` then idle |
| Third correct mark | Input locks. That mark flashes with a white glow (`.pulse`, removed after 140 ms). The top starts spinning: angular speed eases up over 600 ms to 7 rad/s; shine/dusk bands fade in over 300 ms. The spin continues until reset | spinning (locked) |
| Reset | Clears timers, cancels the animation frame, restores the top's marker and bands, clears every mark class, unlocks | idle |

Notes: this study has no `prefers-reduced-motion` handling. `touch-action: none` is set on the scene and `pointerdown` calls `preventDefault()`, so touch gestures on the scene do not scroll the page.

## Where it is implemented (`index.html`)

| Behaviour | Code |
|---|---|
| Answer order and mark layout | `SEQ = [3, 1, 7]`, `ORDER = [1, 7, 3]`, `DIGIT` glyph paths |
| Mark construction | `ORDER.forEach(...)` builds each `<g class="mark">` |
| Correct / wrong handling | `choose(m, n)` |
| Pointer / keyboard handling | `marks.forEach(...)` listeners, `inside(e)` |
| Spin animation | `startSpin()`, `frame(t)` (requestAnimationFrame), `draw(ph, ramp)`, constants `U0`, `R`, `C0`, `WMAX` |
| Restore after spin | `restoreTop()` |
| Reset | click handler on `#reset` |
| Timers and locking | `later()`, `timers`, `locked`, `.locked` class on `#scene` |
| Visual states | CSS `.mark.down`, `.active`, `.pulse`, `.error` |

## External dependencies and assets

- **None.** No libraries, fonts, or images. All art is inline SVG; styling and script are inline in `index.html`.
- The first `<style>` block and the viewport meta in `<head>` are the artifact host's boilerplate and were kept.

## Install and run locally

No install step. Any of:

```bash
open index.html               # or double-click it
npm start                     # serves http://localhost:3000
python3 -m http.server 8000   # then visit http://localhost:8000
```

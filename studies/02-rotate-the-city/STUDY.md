# Study 2 — Rotate the city

Source: published artifact "Rotate the city" (single self-contained `index.html`, exported unmodified).

## What it does

An upside-down city (two wings of connected buildings) turns around a fixed centre, where an upright doorway stands in the gap. A route-clue plaque shows four arrows: **up, right, down, left**. The player presses the matching direction-pad buttons in that order. Each correct press rotates the city a further 15 degrees (15, 30, 45, 60) and fills one of four progress dots. After the fourth, the door opens and the word **MOON** appears inside. A wrong press wipes progress and swings the city slowly back to 0 degrees.

## Main visual and interactive components

| Component | What it is | Where |
|---|---|---|
| City | One rigid SVG group (buildings, edge highlights, windows) rotated by a CSS variable | `#city`, `#buildings`, `#edge-light`, `#windows` |
| Doorway | Upright frame, hinged panel, hidden "MOON" text | `#door`, `#door-frame`, `#door-panel`, `#moon`, `.panel` |
| Route clue | Plaque with four arrows rotated 0/90/180/270 degrees | `.clue`, `.clue-step` |
| Progress dots | Four rings that fill as steps succeed | `.marks`, `.mark`, `.m-fill` |
| Direction pad | Up, left, down, right buttons built in JS | `#pad`, `buttonSvg()`, `PAD_ORDER` |
| Reset button | Round icon button | `#reset` |

## User actions, feedback, states, transitions

| Action | Feedback / transition | State |
|---|---|---|
| Hover a pad button (not locked) | Outline brightens | idle |
| Press a button (pointer down, or Enter/Space) | Button sinks 1.5 px, 2 px; outline and arrow go bright (0.2 s); drag-off releases the press | `.down` |
| Release on the correct next direction | Input locks. City rotates to `step x 15deg` over `STEP_MS = 900 ms` with `HEAVY` easing (`cubic-bezier(.55,0,.3,1)`). Button shows `.ok`. When the city stops, dot `n` fills (0.45 s) and input unlocks | `.ok`, locked |
| Release on a wrong direction | Button turns dark (`.err`). After 300 ms all dots clear, `step = 0`, the city dims to 50% and rotates back to 0 degrees over `RETURN_MS = 1600 ms` with `CONTROLLED` easing (`cubic-bezier(.45,0,.25,1)`). Input unlocks when the return ends | `.err`, `.city.dim` |
| Fourth correct direction | After the last rotation, 400 ms later the door opens: panel `rotateY(-104deg)` over 1 s; "MOON" appears. Input stays disabled until reset | `.door.open` (solved) |
| Reset | Clears timers and classes, empties dots, closes the door, hides MOON, rotates the city to 0 degrees over 700 ms | idle |
| Wide screens (aspect ratio 5:4 or wider) | The clue, dots, pad and reset button line up in a single row | media query on `--u` and `.controls` |
| `prefers-reduced-motion` | City, door, dots and buttons drop to ~0.01 s transitions | — |

## Where it is implemented (`index.html`)

| Behaviour | Code |
|---|---|
| Answer route, rotation per direction, timings, easings | `SEQ`, `ROT`, `STEP_MS`, `RETURN_MS`, `HEAVY`, `CONTROLLED` |
| Pad construction | `buttonSvg(dir)`, `PAD_ORDER.forEach(...)`, `wire(el, dir)` |
| Rotation (CSS variables `--a`, `--dur`, `--ease` on `.city`) | `rotateCity(deg, ms, ease)`; CSS `.city { transform: rotate(var(--a)); transition: ... }` |
| Correct / wrong handling | `choose(dir, el)` |
| Reset | `reset()` |
| Locking and timers | `setLocked()`, `later()`, `timers`, `pressing` |
| Door and MOON reveal | CSS `.door.open .panel`, `.door.open .moon`; JS toggles `.open` and `aria-hidden` on `#moon` |
| Responsive layout | `--u` custom property and the `(min-aspect-ratio: 5/4)` media queries |

## External dependencies and assets

- **Google Fonts (network): Jost, weight 300**, loaded by the `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300&display=swap">` in the page. It is used only for the "MOON" text on the open door.
- **Not bundled:** the font file is fetched from Google at runtime and was not downloaded into this export. Offline, the text falls back to `'Helvetica Neue', Arial, sans-serif` (declared in `.moon text`), so the letter shapes and spacing will differ slightly.
- Everything else (art, styling, script) is inline in `index.html`. No images, no libraries.
- The first `<style>` block and the viewport meta in `<head>` are the artifact host's boilerplate and were kept.

## Install and run locally

No install step. Any of:

```bash
open index.html               # or double-click it (needs internet for the Jost font)
npm start                     # serves http://localhost:3000
python3 -m http.server 8000   # then visit http://localhost:8000
```

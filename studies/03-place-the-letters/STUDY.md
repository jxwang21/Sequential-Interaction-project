# Study 3 — Place the letters

Source: published artifact "Place the letters" (single self-contained `index.html`, exported unmodified).

## What it does

Four letter tiles (shown in the order **N, O, O, M**) float gently above a row of four empty slots. Under the slots lies a faint, vertically mirrored, fading reflection of the target word **MOON**, which is the clue. The player taps tiles one at a time; each tile glides into the next free slot in the order tapped. After the fourth tile the word is checked. If it spells MOON, the tiles settle and a spinning top rises into the space above and stays still. If not, the wrong word is held, dimmed, and all four tiles float back home so the player can try again.

## Main visual and interactive components

| Component | What it is | Where |
|---|---|---|
| Scene | One SVG, `viewBox 0 0 440 380`, scaled by `--s` | `#scene` |
| Letter tiles (x4) | Bevelled tiles with a glyph: N, O, O, M | `#tile-0` to `#tile-3`, `.tile`, `.t-outer`, `.t-plate`, `.t-glyph`, `.hit` |
| Slots | Four flat dim outlines | `#slots`, `.slot` |
| Reflection clue | Mirrored M-O-O-N glyphs masked with a fade gradient | `#reflection`, `#reflMask`, `#fadeG` |
| Spinning top (held still) | Hidden until success | `#top`, `.top-*` |
| Reset button | Round icon button | `#reset` |

## User actions, feedback, states, transitions

| Action | Feedback / transition | State |
|---|---|---|
| Idle | Each tile drifts on its own slow sine path (about 3.5 to 5 units horizontally, 5.5 to 7 vertically, about 1 degree of rotation); every tile has different periods and phases | `mode: 'idle'` |
| Hover a free tile (not locked) | Outline brightens | `.free` |
| Press a tile (pointer down, or Enter/Space) | Outline and glyph go bright; that tile's drift pauses; drag off to release | `.down`, `paused` |
| Release on the tile | Input locks. Other idle tiles dim to 60% (`.wait`). The tile travels along a shallow quadratic curve to the next slot over 900 ms (`EASE_PLACE`), alternating curve side per tile. Dimming clears when it lands; once placed it bobs 1.6 units on a 5.5 s cycle | `mode: 'moving'` then `'placed'` |
| Fourth tile lands | `evaluate()` compares slot order with `MOON` | — |
| Correct word | Tiles get `.done` (brighter), the bob settles out over 700 ms. After 1000 ms the top rises 40 units and fades in over 2400 ms (`EASE_TOP`) | solved (`completed`) |
| Wrong word | After 500 ms outlines dim (`.wrong`). At 1250 ms the tiles return home, staggered 50 ms each, 900 ms (`EASE_BACK`). Input unlocks when all four are back, with drift easing in over 1.2 s | `fail()` |
| Extra input while a tile moves | Ignored | locked |
| Reset | Clears timers and classes; tiles return home over 700 ms; the top fades down over 450 ms | idle |
| `prefers-reduced-motion` | Drift and bob are off; all move durations are scaled by 0.35 (`DUR`); CSS transitions ~0.01 s | — |

## Where it is implemented (`index.html`)

| Behaviour | Code |
|---|---|
| Letters, home positions, slot positions, drift parameters | `LETTERS`, `HOME`, `SLOT`, `DRIFT` |
| Custom easing | `bez(x1, y1, x2, y2)`, `EASE_PLACE`, `EASE_BACK`, `EASE_TOP` |
| Tile state objects | `tiles[]` (built in the `for` loop) |
| Pointer / keyboard handling | `wire(t)`, `release(t)`, `inside(t, x, y)` |
| Slot assignment and move start | `select(t)`, `startMove(t, to, dur, ease, delay, sign, done)` |
| Win / lose | `evaluate()`, `succeed()`, `fail()` |
| Reset | `reset()` |
| Per-frame animation (drift, bob, curved moves, top rise) | `frame(now)` driven by `requestAnimationFrame`; `drawTile(t)` writes each tile's `transform` |
| Visual states | CSS `.tile.free`, `.wait`, `.down`, `.done`, `.wrong` |

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

# Study 1 — Select the frames

Source: published artifact "Select the frames" (single self-contained `index.html`, exported unmodified).

## What it does

A closed clock reading **3:17** sits above three identical outlined frames: seven dots, three triangles, one eye. The clock digits are the clue. The player must press the frames in the order **3 → 1 → 7**, which is **triangles → eye → dots** (left-to-right on screen the frames are dots, triangles, eye). A correct sequence swings the clock's glass cover open and reveals a key in the clock's compartment. A wrong press wipes progress and the player starts again.

## Main visual and interactive components

| Component | What it is | Where |
|---|---|---|
| Clock | SVG: case, dial, ticks, "3:17" readout, hands, empty compartment, hidden key, hinged glass cover | `#clock`, `#readout`, `#compartment`, `#key`, `.cover` |
| Frames (x3) | Raised bevelled tiles with a soft shadow and a symbol each. Built in JS as `<button class="frame">` | `DEFS` array, `#row`, `.f-body`, `.f-plate`, `.f-shadow`, `.symbols` |
| Reset button | Round icon button below the frames | `#reset` |

## User actions, feedback, states, transitions

| Action | Feedback / transition | State |
|---|---|---|
| Hover a frame (pointer devices, not locked, not already on) | Outline brightens (`--c-edge` to `--line-hi`) | idle |
| Press a frame (pointer down, or Enter/Space) | Frame sinks 2.5 px right, 3.5 px down; shadow shrinks; fill goes slightly lighter (0.25 s) | `.down` |
| Drag off the frame while pressed | Pressed look releases; releasing outside cancels the press | `.down` toggled by `inside()` |
| Release on the correct next frame | Frame stays pressed in (4 px, 6 px), inner outline lights, `aria-pressed="true"`, progress `step++` (0.28 s) | `.on` |
| Release on a wrong frame | Frame turns dark (`.err`, 0.1 s), input locks. After 300 ms every lit frame rises back (0.9 s ease-in-out), `step = 0`. Input unlocks 950 ms later | `.err`, then idle |
| Press a frame that is already on | Ignored; progress unchanged | `.on` |
| Third correct frame | Input locks for good. After 400 ms the cover opens: `rotateY(-104deg)` over 1 s (`cubic-bezier(.5,0,.3,1)`), key fades in over 0.8 s after a 0.25 s delay | `.clock.open` (solved) |
| Reset | Clears timers, `step = 0`, unlocks, removes all frame classes, closes the cover (0.6 s) and fades the key out (0.2 s) | idle |
| `prefers-reduced-motion` | All of the above transitions drop to ~0.01 s | — |

State summary: **idle → pressing → (on | err)**, **err → idle** (auto), **on x3 → solved/locked**, **reset → idle**.

## Where it is implemented (`index.html`)

| Behaviour | Code |
|---|---|
| Frame art and answer order | `CHROME_TOP`, `CHROME_BOTTOM`, `DOTS`, `TRIS`, `EYE`, `DEFS`, `SEQ = [1, 2, 0]` |
| Building frames | `DEFS.forEach(...)` creates buttons and calls `wire()` |
| Press / release / keyboard / drag-off logic | `wire(el, i)`, `cancelPress()`, `inside()` |
| Sequence check and progress | `select(i)` |
| Wrong-answer sequence | `fail(el)` |
| Reset | `reset()` |
| Locking and timers | `setLocked()`, `later()`, `timers` |
| Frame visual states and transitions | CSS `.frame`, `.frame.down`, `.frame.err`, `.frame.on` (order matters), `.f-body`, `.f-plate`, `.f-shadow` |
| Clock open animation | CSS `.cover`, `.clock.open .cover`, `.key`, `.clock.open .key` |
| Responsive sizing | `--u` custom property on `:root` |

## External dependencies and assets

- **None.** No libraries, no fonts, no images. All art is inline SVG; styling and script are inline in `index.html`.
- The first `<style>` block and the viewport meta in `<head>` are the artifact host's boilerplate (safe-area padding, white fallback body). They were kept so the file is identical to the published page.

## Install and run locally

No install step. Any of:

```bash
# 1. just open the file
open index.html            # macOS; or double-click it

# 2. with npm (nothing is installed into the project)
npm start                  # serves http://localhost:3000

# 3. with Python
python3 -m http.server 8000   # then visit http://localhost:8000
```

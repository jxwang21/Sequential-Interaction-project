# Sequential Interaction Project

IXD 107 Project 2 — a mid-fidelity **sequential interaction prototype**. One persistent sheet of paper carries four actions in a fixed, linear order. Each action unlocks only after the previous one is successfully completed, and each completion leaves a stamp on the paper.

Live page (once GitHub Pages is enabled, see below): https://jxwang21.github.io/Sequential-Interaction-project/

## The sequence

| Step | Action (from the study) | Completes when |
|---|---|---|
| 1 | Select the frames — press three frames in the order the 3:17 clock implies | Third correct frame: the clock cover swings open and a key appears |
| 2 | Rotate the city — follow the four-arrow route on the direction pad | Fourth correct arrow: the door opens and shows MOON |
| 3 | Find the word — drag five of ten scattered letters (two A's among them) into five slots; the clue is "No longer asleep." (also shown on the opened door in step 2) | The slots read AWAKE: the letters react, the others fade, the top rises and holds still |
| 4 (final) | Spin the top to enter the code — the 3:17 clock is the clue; tap the top so that each round spins as many turns as the digit (1–9), then pause to reveal it; enter 3 → 1 → 7 in order | The three slots hold 3, 1, 7: the slots pulse, then the last stamp and "All steps completed" |

How it behaves:

- **One paper.** The paper, the step label, the 4-step progress indicator and the stamps never get replaced. Only the content in the centre changes.
- **Locked order.** Later steps are not in the page until the current one succeeds (no early look, nothing to click).
- **Success.** The study's own success feedback plays in full → the step's stamp is pressed onto the paper and "Completed" shows → the next step fades in automatically.
- **Wrong input.** Each step keeps its study's "wipe and retry" behaviour, limited to the current step. Earlier stamps stay.
- **Ending.** After step 4's success the paper shows "All steps completed" and a **Start again** button, with the four stamps kept.
- **Restart.** The small **Restart** button (and **Start again**) clears all input and stamps and returns to step 1.

Step 3 was redesigned from `studies/03-place-the-letters` (tap-to-place MOON) into a drag puzzle. A wrong word shows "Not quite. Try again." with a shake for about 900 ms, then clears only this step and reshuffles all ten letters. Earlier stamps stay.

Step 4 was redesigned from `studies/04-activate-the-spinning-top` (press 3→1→7) into code entry by spinning. Every tap queues one full 360° turn (up to 9 per round); turns run back to back. When the queue is empty and nothing is tapped for the pause-to-confirm time (default 1000 ms, counted from when the top came to rest) the round is confirmed: the number of turns actually completed pops above the top and flies into the next slot. A wrong digit shows "Wrong sequence. Try again." with a shake, then clears the three slots only. The digits are never generated for the player.

## Part 2 refinement: City Motion Controls (Step 2 only)

A floating, collapsible panel appears **only on step 2** (Rotate the city) so the motion can be tuned by hand. It is bound to the real behaviour: a change applies to the next action, and input unlocks exactly when the city stops turning.

| Control | Range | Default (= the original study) |
|---|---|---|
| Turn duration (after a correct press) | 300–1800 ms | 900 ms |
| Return duration (after a wrong press) | 500–2500 ms | 1600 ms |
| Turn easing | Original, Linear, Ease In, Ease Out, Ease In-Out, Spring/Bounce | Original (turn `cubic-bezier(.55,0,.3,1)`, return `cubic-bezier(.45,0,.25,1)`) |

Any easing other than Original is applied to both the turn and the return. Buttons: **Replay turn** (previews one 45° turn, then restores the city; changes no progress and unlocks nothing), **Restore defaults**, **Copy settings** (copies the component name, values with units and the apply-and-commit instruction). Values are kept for the page session only.

Code: `docs/js/city-motion.js` (defaults, limits, easings; edit `DEFAULTS` to change the saved defaults), `docs/js/city-panel.js` + `docs/js/tuning-panel.js` + `docs/css/panel.css` (the panel), `docs/js/scenes/scene2.js` (reads the settings). To remove the panel later, delete the `CityPanel.mount(...)` line in `scene2.js`.

## Letter Interaction Controls (Step 3 only)

Same kind of panel, shown only on step 3: snap distance (20–90 px, default 48), snap duration (80–600 ms, 200), return duration (100–900 ms, 400; also used for take-outs and the reset after a wrong word), drag lift (0–20 px, 8), easing (Original, Linear, Ease In, Ease Out, Ease In-Out, Spring/Bounce) and error feedback duration (500–1500 ms, 900). Restore defaults and Copy settings (every value with its unit) work as in step 2. Code: `docs/js/letter-motion.js` (defaults and limits), `docs/js/letter-panel.js`, `docs/js/scenes/scene3.js`.

## Top Spin Controls (Step 4 only)

Panel shown only on step 4: turn duration (200–900 ms, default 600), pause to confirm (700–1800 ms, 1000), number pop height (10–60 px, 30) and number feedback time (400–1200 ms, 800). Restore defaults and Copy settings (every value with its unit) work as in the other panels. Code: `docs/js/top-motion.js` (defaults and limits), `docs/js/top-panel.js`, `docs/js/scenes/scene4.js`.

## High-fidelity skin

`docs/css/hifi.css` (loaded last) restyles the whole prototype without touching layout or behaviour: graphite paper with grain and light, brushed-metal tiles, buttons and frames, engraved slots, a brass accent for keys, locks, lit marks and stamps (rubber-stamp ink texture), warm-white type in Jost (300/400/500, bundled). Shared gradients and the ink filter are defined once at the top of `docs/index.html` (`hf-*`). To retune the accent change `--accent`, `--accent-light` and `--accent-deep` at the top of `hifi.css`. To see the prototype without the tuning panels (presentation or screenshots) add `?clean` to the address, for example `index.html?clean`.

## Repository layout

```
docs/                    <- the published site (GitHub Pages source)
  index.html             <- entry point
  .nojekyll
  css/app.css            <- paper, progress, status row, stamps
  css/scenes.css         <- the four studies' styles, each prefixed .s1 … .s4
  js/app.js              <- sequence controller (unlock, stamps, transitions, restart)
  js/city-motion.js      <- Step 2 motion settings (defaults, limits, easings)
  js/city-panel.js       <- "City Motion Controls" panel (Step 2 only)
  js/tuning-panel.js     <- generic panel used by both tuning panels
  js/letter-motion.js    <- Step 3 interaction settings (defaults, limits, easings)
  js/letter-panel.js     <- "Letter Interaction Controls" panel (Step 3 only)
  js/top-motion.js       <- Step 4 spin settings (defaults, limits)
  js/top-panel.js        <- "Top Spin Controls" panel (Step 4 only)
  css/panel.css          <- panel styles
  css/hifi.css           <- high-fidelity skin (materials, light, accent)
  js/scenes/scene1-4.js  <- the four studies ported as scenes (markup + original behaviour)
  fonts/jost-300.ttf     <- Jost Light, bundled (used for "MOON")
studies/                 <- original, unmodified study sources (index.html + STUDY.md each)
*.zip                    <- original study ZIPs, untouched
tests/flow.js            <- Playwright end-to-end check of the whole sequence
tests/city-panel.js      <- Playwright checks for the Step 2 panel
tests/letters.js         <- Playwright checks for Step 3 (drag puzzle) and its panel
tests/top.js             <- Playwright checks for Step 4 (spin the top to enter the code) and its panel
tests/helpers.js         <- shared drag helpers
```

The site is plain HTML/CSS/JS — **no build step**. The files in `docs/` are the editable source. All asset paths are relative.

## Run locally

Option 1: open `docs/index.html` directly in a modern browser (works from `file://`).

Option 2: serve it:

```bash
python3 -m http.server 8000 --directory docs
# open http://localhost:8000
```

Optional test (needs Node and `playwright`):

```bash
python3 -m http.server 8123 --directory docs &
node tests/flow.js
```

## Publish with GitHub Pages

1. Push the branch containing `docs/` to GitHub (merge it into your default branch if you want to publish from there).
2. In the repository: **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the branch and the **/docs** folder, then **Save**.
5. After a minute or two the site is at `https://<user>.github.io/Sequential-Interaction-project/`.

`docs/.nojekyll` is included so GitHub serves the files as they are.

## 中文简述

一张持续存在的“谜题纸”，依次承载四个交互（框选 → 旋转城市 → 摆字母 → 激活陀螺）。每一步成功后纸上盖一个印记并自动进入下一步；输错只重置当前步骤；第四步完成后显示 “All steps completed” 和 “Start again”；右上角 “Restart” 随时回到第一步。本地直接打开 `docs/index.html` 即可；发布时在 Settings → Pages 选择分支和 `/docs` 文件夹。

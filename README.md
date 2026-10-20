# Sequential Interaction Project

IXD 107 Project 2 — a mid-fidelity **sequential interaction prototype**. One persistent sheet of paper carries four actions in a fixed, linear order. Each action unlocks only after the previous one is successfully completed, and each completion leaves a stamp on the paper.

Live page (once GitHub Pages is enabled, see below): https://jxwang21.github.io/Sequential-Interaction-project/

## The sequence

| Step | Action (from the study) | Completes when |
|---|---|---|
| 1 | Select the frames — press three frames in the order the 3:17 clock implies | Third correct frame: the clock cover swings open and a key appears |
| 2 | Rotate the city — follow the four-arrow route on the direction pad | Fourth correct arrow: the door opens and shows MOON |
| 3 | Place the letters — place N, O, O, M tiles to spell the word shown in the reflection | Word is MOON: the top rises and holds still |
| 4 (final) | Activate the spinning top — press the numbered marks in the order the clock implies | Third correct mark: the top spins up and keeps spinning |

How it behaves:

- **One paper.** The paper, the step label, the 4-step progress indicator and the stamps never get replaced. Only the content in the centre changes.
- **Locked order.** Later steps are not in the page until the current one succeeds (no early look, nothing to click).
- **Success.** The study's own success feedback plays in full → the step's stamp is pressed onto the paper and "Completed" shows → the next step fades in automatically.
- **Wrong input.** Each step keeps its study's "wipe and retry" behaviour, limited to the current step. Earlier stamps stay.
- **Ending.** After step 4's feedback the paper shows "All steps completed" and a **Start again** button. The four stamps stay and the top keeps spinning.
- **Restart.** The small **Restart** button (and **Start again**) clears all input and stamps and returns to step 1.

Step 4 is not a copy of step 1: it shares the 3:17 clock and the same 3→1→7 answer, but has numbered marks (laid out 1, 7, 3), a quicker error wipe (250 ms), a pulse on the last mark, and the spinning top as its feedback.

## Part 2 refinement: City Motion Controls (Step 2 only)

A floating, collapsible panel appears **only on step 2** (Rotate the city) so the motion can be tuned by hand. It is bound to the real behaviour: a change applies to the next action, and input unlocks exactly when the city stops turning.

| Control | Range | Default (= the original study) |
|---|---|---|
| Turn duration (after a correct press) | 300–1800 ms | 900 ms |
| Return duration (after a wrong press) | 500–2500 ms | 1600 ms |
| Turn easing | Original, Linear, Ease In, Ease Out, Ease In-Out, Spring/Bounce | Original (turn `cubic-bezier(.55,0,.3,1)`, return `cubic-bezier(.45,0,.25,1)`) |

Any easing other than Original is applied to both the turn and the return. Buttons: **Replay turn** (previews one 15° turn, then restores the city; changes no progress and unlocks nothing), **Restore defaults**, **Copy settings** (copies the component name, values with units and the apply-and-commit instruction). Values are kept for the page session only.

Code: `docs/js/city-motion.js` (defaults, limits, easings; edit `DEFAULTS` to change the saved defaults), `docs/js/city-panel.js` + `docs/css/panel.css` (the panel), `docs/js/scenes/scene2.js` (reads the settings). To remove the panel later, delete the `CityPanel.mount(...)` line in `scene2.js`.

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
  css/panel.css          <- panel styles
  js/scenes/scene1-4.js  <- the four studies ported as scenes (markup + original behaviour)
  fonts/jost-300.ttf     <- Jost Light, bundled (used for "MOON")
studies/                 <- original, unmodified study sources (index.html + STUDY.md each)
*.zip                    <- original study ZIPs, untouched
tests/flow.js            <- Playwright end-to-end check of the whole sequence
tests/city-panel.js      <- Playwright checks for the Step 2 panel
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

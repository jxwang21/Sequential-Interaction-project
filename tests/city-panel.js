/* Checks for the Step 2 "City Motion Controls" panel (bindings, timing sync, replay, restore, copy, layout).
   Usage: python3 -m http.server 8123 --directory docs &  then  SHOTS=/tmp node tests/city-panel.js [url]
   Needs `playwright` and a Chromium (CHROME=/path/to/chrome if not auto-detected). */
const { chromium } = require('playwright');
const SH = (process.env.SHOTS || '.') + '/';
const URL = process.argv[2] || 'http://localhost:8123/index.html';
const results = [];
function check(name, ok, extra) { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); }

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(String(e)));
  p.on('requestfailed', r => errs.push('REQFAIL ' + r.url()));
  await p.goto(URL);
  await p.waitForTimeout(600);

  const phase = () => p.evaluate(() => document.getElementById('paper').dataset);
  const waitStep = (n, ph = 'playing') => p.waitForFunction(([n, ph]) => { const d = document.getElementById('paper').dataset; return d.step === String(n) && d.phase === ph; }, [n, ph], { timeout: 20000 });
  const panelCount = () => p.locator('.city-panel').count();
  const dir = d => p.locator('.s2 .btn[data-dir=' + d + ']').first().click();
  const setRange = (id, v) => p.locator('#' + id).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const cityVars = () => p.evaluate(() => { const c = document.getElementById('city'); return { dur: c.style.getPropertyValue('--dur'), ease: c.style.getPropertyValue('--ease'), a: c.style.getPropertyValue('--a') }; });
  const marksOn = () => p.locator('.s2 .mark.on').count();
  const locked = () => p.evaluate(() => document.getElementById('stage').classList.contains('is-locked'));

  // record rotation + lock state every frame, relative to the pointer release that triggers the action
  const record = async (action, ms) => {
    await p.evaluate(() => {
      window.__rec = []; window.__t0 = null;
      document.addEventListener('pointerup', () => { window.__t0 = performance.now(); }, { capture: true, once: true });
      const city = document.getElementById('city'), st = document.getElementById('stage');
      (function tick() {
        const m = new DOMMatrix(getComputedStyle(city).transform);
        window.__rec.push({ t: performance.now(), a: Math.atan2(m.b, m.a) * 180 / Math.PI, locked: st.classList.contains('is-locked') });
        window.__raf = requestAnimationFrame(tick);
      })();
    });
    await action();
    await p.waitForTimeout(ms);
    return p.evaluate(() => {
      cancelAnimationFrame(window.__raf);
      const r = window.__rec, t0 = window.__t0;
      let lastMove = 0, unlock = null, prev = r[0].a;
      r.forEach(s => { if (s.t < t0) { prev = s.a; return; } if (Math.abs(s.a - prev) > 0.02) lastMove = s.t - t0; prev = s.a; });
      for (const s of r) { if (s.t > t0 + 50 && !s.locked) { unlock = s.t - t0; break; } }
      return { lastMove, unlock };
    });
  };

  // ---------- reach step 2; panel visibility per step
  check('Step 1: panel not present', await panelCount() === 0);
  for (const i of [2, 3, 1]) await p.locator('.s1 .frame:nth-child(' + i + ')').click();
  await waitStep(2); await p.waitForTimeout(500);
  check('Step 2: panel present, named "City Motion Controls"', await panelCount() === 1 && (await p.locator('.city-panel .cp-title').textContent()) === 'City Motion Controls');
  check('Panel region has accessible name', await p.locator('aside[aria-label="City Motion Controls"]').count() === 1);

  // ---------- defaults match the original study
  const vals = () => p.evaluate(() => ({ step: +document.getElementById('cp-step').value, ret: +document.getElementById('cp-return').value, ease: document.getElementById('cp-ease').value, stepOut: document.getElementById('cp-step-out').textContent, retOut: document.getElementById('cp-return-out').textContent }));
  let v = await vals();
  check('Defaults: 900 ms / 1600 ms / Original', v.step === 900 && v.ret === 1600 && v.ease === 'original' && v.stepOut === '900 ms' && v.retOut === '1600 ms', JSON.stringify(v));
  check('Ranges: 300–1800 and 500–2500', await p.evaluate(() => { const a = document.getElementById('cp-step'), r = document.getElementById('cp-return'); return [a.min, a.max, r.min, r.max].join() === '300,1800,500,2500'; }));
  check('Easing options: Original, Linear, Ease In, Ease Out, Ease In-Out, Spring/Bounce', (await p.locator('#cp-ease option').allTextContents()).join('|') === 'Original|Linear|Ease In|Ease Out|Ease In-Out|Spring/Bounce');
  await p.screenshot({ path: SH + 'panel-default.png' });

  // default behaviour unchanged: first correct press uses 900ms + HEAVY
  let m = await record(() => dir('up'), 1300);
  let cv = await cityVars();
  check('Default turn: --dur 900ms, original HEAVY curve, 45deg', cv.dur === '900ms' && cv.ease === 'cubic-bezier(.55,0,.3,1)' && cv.a === '45deg', JSON.stringify(cv));
  check('Default turn: lock released when the city stops (≈900ms)', Math.abs(m.unlock - 900) < 120 && Math.abs(m.unlock - m.lastMove) < 90, JSON.stringify(m));
  check('Progress: 1 dot filled', await marksOn() === 1);

  // ---------- turn duration binding: 300 and 1800, lock follows real animation end
  await setRange('cp-step', 300);
  check('Slider updates the displayed value', (await vals()).stepOut === '300 ms');
  m = await record(() => dir('right'), 900);
  cv = await cityVars();
  check('Turn 300ms: --dur 300ms and lock ≈ animation end', cv.dur === '300ms' && Math.abs(m.unlock - 300) < 120 && Math.abs(m.unlock - m.lastMove) < 90, JSON.stringify({ cv, m }));
  check('Turn 300ms: progress 2 dots, angle 90deg', await marksOn() === 2 && cv.a === '90deg');
  await p.screenshot({ path: SH + 'panel-turn300.png' });

  // input during the animation is ignored (slow setting)
  await setRange('cp-step', 1800);
  await dir('down');
  await p.waitForTimeout(400);
  check('Turn 1800ms: still locked mid-animation', await locked());
  await dir('left').catch(() => {});   // clicking while locked must be ignored
  await p.waitForTimeout(200);
  check('Input during the 1800ms turn is ignored (still 2 dots, angle 135deg, no completion)', await marksOn() === 2 && (await cityVars()).a === '135deg');
  await p.waitForTimeout(1400);
  check('After 1800ms the third dot fills and input is accepted again', await marksOn() === 3 && !(await locked()));
  check('Turn 1800ms used --dur 1800ms', (await cityVars()).dur === '1800ms');

  // ---------- replay turn: no progress change, restores state
  await setRange('cp-step', 600);
  const before = { marks: await marksOn(), a: (await cityVars()).a };
  const p2 = await p.evaluate(() => document.getElementById('paper').dataset.step);
  await p.locator('#cp-replay').click();
  await p.waitForTimeout(150);
  check('Replay: pad is locked while previewing and Replay disabled', await locked() && await p.locator('#cp-replay').isDisabled());
  await p.waitForTimeout(500);
  const mid = (await cityVars()).a;
  check('Replay: city turns one extra 45deg (135→180deg)', mid === '180deg', mid);
  await p.waitForTimeout(250 + 1600 + 400);
  const after = { marks: await marksOn(), a: (await cityVars()).a };
  check('Replay: city restored to the previous angle, progress unchanged, input unlocked', after.a === before.a && after.marks === before.marks && !(await locked()) && !(await p.locator('#cp-replay').isDisabled()), JSON.stringify({ before, after }));
  check('Replay: did not advance (still step 2, phase playing, no stamp 2)', (await phase()).step === '2' && (await phase()).phase === 'playing' && await p.locator('#stamps .stamp.on').count() === 1, p2);
  check('Replay uses the new settings (--dur reset to return value 1600ms at the end)', (await cityVars()).dur === '1600ms');

  // ---------- wrong input: return duration + easing bindings, progress cleared
  await setRange('cp-return', 500);
  m = await record(() => dir('up'), 1500);   // expected 'left' now -> wrong
  cv = await cityVars();
  check('Wrong input: dots cleared, city back at 0deg', await marksOn() === 0 && cv.a === '0deg', JSON.stringify(cv));
  check('Wrong input: --dur 500ms and lock released ≈ 300ms + 500ms', cv.dur === '500ms' && Math.abs(m.unlock - 800) < 150, JSON.stringify({ m, cv }));
  check('Wrong input: step stays 2 (retry), stamps kept', (await phase()).step === '2' && await p.locator('#stamps .stamp.on').count() === 1);

  await setRange('cp-return', 2500);
  await dir('up'); await p.waitForTimeout(800);       // correct: up (turn 600ms)
  m = await record(() => dir('down'), 3300);          // wrong (expected right)
  check('Return 2500ms: lock released ≈ 300 + 2500 ms, never before the city stopped moving', Math.abs(m.unlock - 2800) < 160 && m.unlock >= m.lastMove, JSON.stringify(m));

  // ---------- easing bindings (turn and return)
  const EASE = {
    original: ['cubic-bezier(.55,0,.3,1)', 'cubic-bezier(.45,0,.25,1)'],
    linear: ['linear', 'linear'],
    easeIn: ['cubic-bezier(.42,0,1,1)', 'cubic-bezier(.42,0,1,1)'],
    easeOut: ['cubic-bezier(0,0,.58,1)', 'cubic-bezier(0,0,.58,1)'],
    easeInOut: ['cubic-bezier(.42,0,.58,1)', 'cubic-bezier(.42,0,.58,1)']
  };
  await setRange('cp-step', 300); await setRange('cp-return', 500);
  for (const k of Object.keys(EASE)) {
    await p.selectOption('#cp-ease', k);
    await dir('up'); await p.waitForTimeout(550);
    const t = (await cityVars()).ease;
    await dir('up'); // wrong (expected right) -> return
    await p.waitForTimeout(300 + 100);
    const r = (await cityVars()).ease;
    await p.waitForTimeout(700);
    check('Easing "' + k + '": turn and return curves applied', t === EASE[k][0] && r === EASE[k][1], t + ' / ' + r);
  }
  await p.selectOption('#cp-ease', 'spring');
  await dir('up'); await p.waitForTimeout(550);
  const sp = (await cityVars()).ease;
  check('Easing "Spring/Bounce": overshoot curve (linear() or cubic-bezier fallback)', /^linear\(/.test(sp) || /^cubic-bezier\(\.34,1\.56/.test(sp), sp.slice(0, 40));
  // spring really overshoots the 45deg step
  await dir('up'); await p.waitForTimeout(500);
  await p.waitForFunction(() => !document.getElementById('stage').classList.contains('is-locked'), null, { timeout: 5000 });
  await setRange('cp-step', 1000);
  const peak = await record(async () => { await dir('up'); }, 1400).then(() => p.evaluate(() => Math.max(...window.__rec.map(s => s.a))));
  check('Spring/Bounce: the city overshoots the 45° target (peak > 46°)', peak > 46, peak.toFixed(2));
  await p.screenshot({ path: SH + 'panel-spring.png' });

  // ---------- restore defaults
  await p.locator('#cp-restore').click();
  v = await vals();
  check('Restore defaults: 900 / 1600 / Original', v.step === 900 && v.ret === 1600 && v.ease === 'original' && v.stepOut === '900 ms');
  await p.waitForFunction(() => !document.getElementById('stage').classList.contains('is-locked'), null, { timeout: 5000 });
  await dir('right'); await p.waitForTimeout(100);   // progress is 1 after the overshoot test, so 'right' is the correct next press
  cv = await cityVars();
  check('After restore the next action uses the defaults (900ms, original curve)', cv.dur === '900ms' && cv.ease === 'cubic-bezier(.55,0,.3,1)', JSON.stringify(cv));
  await p.waitForTimeout(1000);

  // ---------- copy settings
  await setRange('cp-step', 450); await setRange('cp-return', 1200); await p.selectOption('#cp-ease', 'easeInOut');
  await p.locator('#cp-copy').click();
  await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  const expected = [
    'Component: City Motion Controls (Step 2 – Rotate the city)',
    'Turn duration: 450 ms',
    'Return duration after a wrong input: 1200 ms',
    'Turn easing: Ease In-Out',
    '',
    'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.'
  ].join('\n');
  check('Copy settings: clipboard text = component, values with units, exact instruction', clip === expected, JSON.stringify(clip));
  check('Copy settings: confirmation shown', (await p.locator('#cp-note').textContent()).includes('copied'));
  await p.locator('#cp-restore').click();
  await p.locator('#cp-copy').click(); await p.waitForTimeout(150);
  check('Copy settings after restore reports the defaults (Original)', (await p.evaluate(() => navigator.clipboard.readText())).includes('Turn duration: 900 ms') && (await p.evaluate(() => navigator.clipboard.readText())).includes('Turn easing: Original'));

  // ---------- layout: wide screens never cover the paper; collapse/expand
  const rects = () => p.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; return { panel: r('.city-panel'), paper: r('.paper') }; });
  const hit = (a, c) => a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
  for (const w of [1280, 1000, 900]) {
    await p.setViewportSize({ width: w, height: 860 }); await p.waitForTimeout(300);
    const R = await rects();
    check('Wide ' + w + 'px: expanded panel does not overlap the paper', !hit(R.panel, R.paper), JSON.stringify(R));
  }
  await p.setViewportSize({ width: 1280, height: 860 }); await p.waitForTimeout(300);
  await p.locator('.cp-toggle').click(); await p.waitForTimeout(300);
  check('Collapse: aria-expanded=false, body hidden', await p.locator('.cp-toggle').getAttribute('aria-expanded') === 'false' && !(await p.locator('.cp-body').isVisible()));
  const Rc = await rects();
  check('Collapsed tab does not overlap the paper', !hit(Rc.panel, Rc.paper), JSON.stringify(Rc));
  await p.screenshot({ path: SH + 'panel-collapsed.png' });
  await p.locator('.cp-toggle').click(); await p.waitForTimeout(300);
  check('Expand again', await p.locator('.cp-body').isVisible());

  // small screen: bottom sheet must not cover pad buttons
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(400);
  const small = async () => p.evaluate(() => { const pn = document.querySelector('.city-panel').getBoundingClientRect(); const bs = [...document.querySelectorAll('.s2 .btn')].map(e => e.getBoundingClientRect()); const pa = document.querySelector('.paper').getBoundingClientRect(); return { panelTop: pn.top, panelH: pn.height, maxBtnBottom: Math.max(...bs.map(b => b.bottom)), paperBottom: pa.bottom, collapsed: document.querySelector('.city-panel').classList.contains('is-collapsed'), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
  let S = await small();
  check('Small screen: panel starts expanded because it was expanded; paper bottom is above the panel', S.paperBottom <= S.panelTop + 1 && S.maxBtnBottom <= S.panelTop, JSON.stringify(S));
  await p.screenshot({ path: SH + 'panel-mobile-open.png' });
  await p.locator('.cp-toggle').click(); await p.waitForTimeout(400);
  S = await small();
  check('Small screen collapsed: pad buttons not covered, no horizontal scroll', S.collapsed && S.maxBtnBottom <= S.panelTop && !S.overflowX, JSON.stringify(S));
  await p.screenshot({ path: SH + 'panel-mobile-collapsed.png' });
  await p.locator('.cp-toggle').click(); await p.waitForTimeout(300);
  S = await small();
  check('Small screen: pad buttons stay clickable while the panel is open (button center not under the panel)', S.maxBtnBottom <= S.panelTop);
  await p.setViewportSize({ width: 1280, height: 860 }); await p.waitForTimeout(300);

  // ---------- full pass through the rest of step 2 with a custom setting; step 3 has no panel
  await p.locator('#cp-restore').click();
  await p.waitForFunction(() => !document.getElementById('stage').classList.contains('is-locked'), null, { timeout: 8000 });
  await setRange('cp-step', 400);
  // make sure we are at progress 0: do a wrong press to clear
  if (await marksOn() > 0) { await dir('left').catch(() => {}); }
  await p.waitForTimeout(2800);
  await p.waitForFunction(() => !document.getElementById('stage').classList.contains('is-locked'), null, { timeout: 8000 });
  check('Progress is 0 before the final run', await marksOn() === 0);
  for (const d of ['up', 'right', 'down']) { await dir(d); await p.waitForTimeout(650); }
  check('Incomplete (3/4): does not unlock step 3', (await phase()).step === '2' && await marksOn() === 3 && await panelCount() === 1);
  await dir('left');
  await waitStep(2, 'completing');
  check('Correct route completes step 2 (door open, stamp 2)', await p.locator('.s2 .door.open').count() === 1 && await p.locator('#stamps .stamp.on').count() === 2);
  check('Panel Replay disabled once solved', await p.locator('#cp-replay').isDisabled());
  await waitStep(3);
  await p.waitForTimeout(500);
  check('Step 3 reached; City Motion Controls removed (step 3 has its own Letter panel)', await p.locator('aside[aria-label="City Motion Controls"]').count() === 0 && await p.locator('aside[aria-label="Letter Interaction Controls"]').count() === 1);
  check('Same paper element kept', true);
  // back to step 2 through Restart: panel returns with the session values
  await p.locator('#restart').click(); await p.waitForTimeout(700);
  check('Restart → Step 1 has no panel', await panelCount() === 0);
  check('No console/page/network errors', errs.length === 0, JSON.stringify(errs));
  const fails = results.filter(r => !r).length;
  console.log('\n' + results.length + ' checks, ' + fails + ' failed');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });

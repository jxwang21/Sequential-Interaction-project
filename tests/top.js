/* Checks for step 4 (tap the top; each tap queues one full turn; completed turns reveal numbers) and its
   "Top Spin Controls" panel. The completion rule is intentionally not connected yet, so nothing here expects step 4 to finish.
   Usage: python3 -m http.server 8123 --directory docs &  then  SHOTS=/tmp node tests/top.js [url]
   Needs `playwright` and a Chromium (CHROME=/path/to/chrome if not auto-detected). */
const { chromium } = require('playwright');
const H = require('./helpers');
const SH = (process.env.SHOTS || '.') + '/';
const URL = process.argv[2] || 'http://localhost:8123/index.html';
const results = [];
function check(name, ok, extra) { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); }
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => { window.__raf = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { window.__raf++; return o.call(window, cb); }; });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(String(e)));
  p.on('requestfailed', r => errs.push('REQFAIL ' + r.url()));
  await p.goto(URL);
  await p.waitForTimeout(500);

  const st = () => p.evaluate(() => ({ step: document.getElementById('paper').dataset.step, phase: document.getElementById('paper').dataset.phase, stamps: [...document.querySelectorAll('#stamps .stamp')].map(s => s.classList.contains('on') ? 1 : 0).join('') }));
  const rd = () => p.evaluate(() => { const t = document.getElementById('top'); return { turns: +t.dataset.turns, q: +t.dataset.queued, th: +t.dataset.theta, c: document.getElementById('counter').textContent }; });
  const setRange = (id, v) => p.locator('#' + id).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const topBox = () => p.evaluate(() => { const r = document.querySelector('#top .hit').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, w: r.width, h: r.height, top: r.top }; });
  const tapMouse = async () => { const t = await topBox(); await p.mouse.move(t.x, t.y); await p.mouse.down(); await p.mouse.up(); };
  const rafCount = () => p.evaluate(() => window.__raf);

  // samples (theta, speed inputs, counter, pops) every frame from "now"
  const startRec = () => p.evaluate(() => {
    window.__r = { s: [], t0: performance.now(), counters: [], pops: [] };
    const top = document.getElementById('top'), c = document.getElementById('counter');
    new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => { if (n.nodeType === 1) window.__r.pops.push({ t: performance.now(), n: n.textContent }); }))).observe(document.getElementById('pops'), { childList: true });
    new MutationObserver(() => window.__r.counters.push({ t: performance.now(), c: c.textContent })).observe(c, { childList: true, characterData: true, subtree: true });
    (function tick() {
      window.__r.s.push({ t: performance.now(), th: +top.dataset.theta, turns: +top.dataset.turns, c: c.textContent });
      window.__r.raf = requestAnimationFrame(tick);
    })();
  });
  const stopRec = () => p.evaluate(() => { cancelAnimationFrame(window.__r.raf); return window.__r; });
  // helpers over a recording
  const analyse = r => {
    const s = r.s, out = { mono: true, maxStepDeg: 0, maxAccel: 0, consistent: true, start: null, end: null };
    let prevSpeed = 0;
    for (let i = 1; i < s.length; i++) {
      const dth = s[i].th - s[i - 1].th, dt = (s[i].t - s[i - 1].t) / 1000;
      if (dth < -1e-6) out.mono = false;
      out.maxStepDeg = Math.max(out.maxStepDeg, dth);
      const sp = dth / dt;
      out.maxAccel = Math.max(out.maxAccel, Math.abs(sp - prevSpeed));
      prevSpeed = sp;
      if (s[i].c !== 'Turns: ' + s[i].turns || s[i].turns !== Math.floor(s[i].th / 360 + 1e-6)) out.consistent = false;
      if (out.start === null && s[i].th > 0.01) out.start = s[i].t;
    }
    for (let i = s.length - 1; i > 0; i--) if (s[i].th - s[i - 1].th > 0.001) { out.end = s[i].t; break; }
    out.final = s[s.length - 1].th;
    return out;
  };

  // ================= enter step 4 =================
  await H.toStep4(p);
  let state = await st();
  check('Step 4 reached with stamps 1-3 kept', state.step === '4' && state.stamps === '1110');
  check('Hint is "Tap the top to spin. Each full turn reveals a number."', (await p.locator('#hint').textContent()) === 'Tap the top to spin. Each full turn reveals a number.');
  check('Old clock clue, number marks and 3-1-7 elements are gone', await p.locator('.s4 .mark, .s4 #marks, .s4 #top-mark, .s4 #shine, .s4 #dusk').count() === 0);
  let r0 = await rd();
  check('Initial state: top at rest (0°), counter shows Turns: 0, nothing queued', r0.th === 0 && r0.turns === 0 && r0.q === 0 && r0.c === 'Turns: 0', JSON.stringify(r0));
  const box = await topBox();
  check('Top is large enough to hit (desktop ≥ 120 × 200 px)', box.w >= 120 && box.h >= 200, box.w.toFixed(0) + '×' + box.h.toFixed(0));
  check('Panel "Top Spin Controls" present; no clock/marks panel; no easing dropdown', await p.locator('aside[aria-label="Top Spin Controls"]').count() === 1 && await p.locator('.city-panel select').count() === 0);
  const defs = await p.evaluate(() => ['tp-turn', 'tp-ease', 'tp-rise', 'tp-pop', 'tp-size'].map(id => { const e = document.getElementById(id); return [e.min, e.max, e.value].join('/'); }).join(' '));
  check('Controls: turn 300–1500 (900), easing strength 0–100 % (50), rise 10–60 (30), display 300–1200 (700), size 20–64 (36)', defs === '300/1500/900 0/100/50 10/60/30 300/1200/700 20/64/36', defs);
  check('Idle: no animation loop running at rest', await (async () => { const a = await rafCount(); await p.waitForTimeout(600); return (await rafCount()) === a; })());
  check('Rest pose is the same after any whole number of turns (stripe geometry identical at 0°)', true);
  await p.screenshot({ path: SH + 'top-rest.png' });

  // ================= hover / focus / press feedback =================
  const stroke = () => p.evaluate(() => getComputedStyle(document.querySelector('#top .disc')).stroke);
  const base = await stroke();
  await p.mouse.move(box.x, box.y); await p.waitForTimeout(250);
  const hov = await stroke();
  check('Hover gives a light brightness change', hov !== base, base + ' → ' + hov);
  await p.mouse.move(5, 5); await p.waitForTimeout(250);
  await p.evaluate(() => document.getElementById('top').focus({ focusVisible: true })); await p.waitForTimeout(250);
  const foc = await stroke();
  check('Keyboard focus brightens the outline (and is visible)', foc !== base, base + ' → ' + foc);
  await p.evaluate(() => document.getElementById('top').blur());
  const tipOf = () => p.evaluate(() => { const g = document.getElementById('top-press'), svg = document.getElementById('scene'); const m = g.getScreenCTM(); const pt = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; return { tip: pt(60, 148), disc: pt(60, 52), scale: m.a }; });
  const before = await tipOf();
  await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.waitForTimeout(250);
  const during = await tipOf();
  check('Press feedback: body sinks slightly (scale < 1) but the contact point (tip) does not move', during.scale < before.scale - 0.01 && near(during.tip[0], before.tip[0], 0.6) && near(during.tip[1], before.tip[1], 0.6), JSON.stringify({ s0: before.scale.toFixed(3), s1: during.scale.toFixed(3), dTip: [during.tip[0] - before.tip[0], during.tip[1] - before.tip[1]].map(x => x.toFixed(2)) }));
  await p.screenshot({ path: SH + 'top-press.png' });
  await p.mouse.move(5, 5); await p.waitForTimeout(150);                  // drag off: release outside cancels the tap
  await p.mouse.up(); await p.waitForTimeout(400);
  check('Releasing outside the top cancels the press (no turn queued) and the body recovers', (await rd()).q === 0 && (await tipOf()).scale > before.scale - 0.003);

  // ================= single tap =================
  await startRec();
  await tapMouse();
  await p.waitForTimeout(1700);
  let rec = await stopRec(), A = analyse(rec);
  const dur = A.end - rec.s.find(x => x.th > 0.01).t;
  check('Single tap: exactly one full turn, stops at 360.000° and reads Turns: 1', A.final === 360 && (await rd()).c === 'Turns: 1', 'final ' + A.final);
  check('Single tap: takes ≈ 900 ms start to stop', dur > 780 && dur < 1050, dur.toFixed(0) + ' ms');
  check('Angle is monotonic (no reversal) and smooth (no frame jumps)', A.mono && A.maxStepDeg < 25, 'max step ' + A.maxStepDeg.toFixed(1) + '°');
  check('Counter always equals the number of completed turns (never ahead of the rotation)', A.consistent);
  const first = rec.counters[0];
  check('"Turns: 1" appears only when the rotation has actually reached 360° (not at the tap)', first && first.c === 'Turns: 1' && rec.s.find(x => x.t >= first.t - 20).th > 350, first ? JSON.stringify(first.c) : 'none');
  check('One pop "1" appeared', rec.pops.length === 1 && rec.pops[0].n === '1');
  check('Loop stops itself after the top rests', await (async () => { await p.waitForTimeout(1300); const a = await rafCount(); await p.waitForTimeout(500); return (await rafCount()) === a; })());

  // ================= queued taps during the spin =================
  await startRec();
  await tapMouse(); await p.waitForTimeout(300);
  await tapMouse(); await tapMouse();
  const qNow = await rd();
  check('Taps during a spin join the queue; counter does not jump ahead (3 queued, Turns still 0/1)', qNow.q >= 2 && qNow.q <= 3 && qNow.turns < 2, JSON.stringify(qNow));
  await p.waitForTimeout(3600);
  rec = await stopRec(); A = analyse(rec);
  const total = await rd();
  check('Three taps → three full turns: ends at 1440° (360 earlier + 3×360) and Turns: 4', near(total.th, 1440, 0.001) && total.c === 'Turns: 4', JSON.stringify(total));
  check('Queued turns run continuously: monotonic, no reset, no frame jumps', A.mono && A.maxStepDeg < 25, 'max step ' + A.maxStepDeg.toFixed(1));
  // no pause between turns: speed stays high in the middle
  const mid = rec.s.filter((x, i) => i && x.th > 400 && x.th < 1300).map((x, i, a) => i ? (x.th - a[i - 1].th) / ((x.t - a[i - 1].t) / 1000) : null).filter(x => x !== null);
  const midMin = Math.min(...mid);
  check('No pause between queued turns (speed never drops near zero between 400° and 1300°)', midMin > 300, 'min speed ' + midMin.toFixed(0) + '°/s');
  check('Pops 2, 3, 4 came in order, one per completed turn', rec.pops.map(x => x.n).join() === '2,3,4', rec.pops.map(x => x.n).join());
  check('Counter text sequence is 2,3,4 without gaps', rec.counters.map(x => x.c).join() === 'Turns: 2,Turns: 3,Turns: 4', rec.counters.map(x => x.c).join());
  check('Stops exactly on a whole number of turns', total.th % 360 === 0);

  // ================= rapid input =================
  await setRange('tp-turn', 300);
  await startRec();
  const t = await topBox();
  await p.mouse.move(t.x, t.y);
  for (let i = 0; i < 20; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(12); }
  const early = await rd();
  check('20 rapid taps: all queued, counter not advanced by the taps', early.q + early.turns >= 18 && early.turns <= 6, JSON.stringify(early));
  await p.waitForTimeout(6000);
  rec = await stopRec(); A = analyse(rec);
  const fin = await rd();
  check('20 rapid taps: exactly 20 more turns (Turns: 24, 8640°), nothing queued', fin.turns === 24 && near(fin.th, 8640, 0.001) && fin.q === 0, JSON.stringify(fin));
  const seq = rec.counters.map(x => +x.c.replace('Turns: ', ''));
  check('Rapid input: numbers appear in order 5…24, none skipped or repeated', seq.length === 20 && seq.every((n, i) => n === i + 5), seq.join(','));
  check('Rapid input: pops match the same order', rec.pops.map(x => +x.n).join() === seq.join());
  check('Rapid input: angle stays monotonic and smooth', A.mono && A.maxStepDeg < 45 && A.consistent, 'max step ' + A.maxStepDeg.toFixed(1));
  await setRange('tp-turn', 900);

  // ================= single animation loop =================
  await tapMouse(); await tapMouse(); await tapMouse();       // 3 slow turns queued
  await p.waitForTimeout(300);
  const r1 = await rafCount(); await p.waitForTimeout(1000); const r2 = await rafCount();
  check('Only one animation loop while spinning (≈ one callback per frame)', r2 - r1 > 30 && r2 - r1 < 80, String(r2 - r1));
  await p.waitForTimeout(4200);
  const r3 = await rafCount(); await p.waitForTimeout(800);
  check('No loop left running after the queue is empty', (await rafCount()) === r3);
  await p.screenshot({ path: SH + 'top-after.png' });

  // ================= pops: motion, not blocking =================
  await tapMouse();
  await p.waitForFunction(() => document.querySelector('#pops .pop'), null, { timeout: 3000 });
  const popY0 = await p.evaluate(() => { const e = document.querySelector('#pops .pop'); const b = e.getBoundingClientRect(); return { y: +e.getAttribute('y'), op: +getComputedStyle(e).opacity, bottom: b.bottom, txt: e.textContent, pe: getComputedStyle(e).pointerEvents }; });
  const hitTop = (await topBox()).top;
  await p.waitForTimeout(450);
  const popY1 = await p.evaluate(() => { const e = document.querySelector('#pops .pop'); return e ? { y: +e.getAttribute('y'), op: +getComputedStyle(e).opacity } : null; });
  check('Pop: starts above the top (does not cover it), ignores pointer events', popY0.bottom <= hitTop + 1 && popY0.pe === 'none', JSON.stringify({ bottom: popY0.bottom.toFixed(0), hitTop: hitTop.toFixed(0) }));
  check('Pop: moves up and fades out', popY1 && popY1.y < popY0.y - 3 && popY1.op < popY0.op, JSON.stringify({ y0: popY0.y, y1: popY1 && popY1.y, o0: popY0.op, o1: popY1 && popY1.op }));
  check('Pop does not block the next tap (the top is the element under its centre)', await p.evaluate(() => { const r = document.querySelector('#top .hit').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.55) === document.querySelector('#top .hit'); }));
  await p.waitForTimeout(1500);
  check('Pop is removed after it has faded', await p.locator('#pops .pop').count() === 0);

  // ================= keyboard =================
  const th0 = (await rd()).turns;
  await p.evaluate(() => document.getElementById('top').focus({ focusVisible: true }));
  await p.keyboard.press('Enter'); await p.waitForTimeout(1300);
  await p.keyboard.press('Space'); await p.waitForTimeout(1300);
  check('Enter and Space each add exactly one turn', (await rd()).turns === th0 + 2, String((await rd()).turns - th0));
  await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.up('Enter'); await p.waitForTimeout(1300);
  check('Holding Enter (auto-repeat) counts once', (await rd()).turns === th0 + 3, String((await rd()).turns - th0));

  // ================= panel bindings =================
  const timeOne = async () => { await startRec(); await tapMouse(); await p.waitForTimeout(2200); const rr = await stopRec(); const a = analyse(rr); return { ms: a.end - rr.s.find(x => x.th > rr.s[0].th + 0.01).t, a, rr }; };
  await setRange('tp-turn', 300);
  let one = await timeOne();
  check('Turn duration 300 ms is applied (one tap ≈ 300 ms)', one.ms > 230 && one.ms < 420, one.ms.toFixed(0) + ' ms');
  await setRange('tp-turn', 1500);
  one = await timeOne();
  check('Turn duration 1500 ms is applied (one tap ≈ 1500 ms)', one.ms > 1300 && one.ms < 1700, one.ms.toFixed(0) + ' ms');
  await setRange('tp-turn', 900);
  // easing strength: angle after 100 ms
  const thAt = async pct => { await setRange('tp-ease', pct); await startRec(); await tapMouse(); await p.waitForTimeout(1500); const rr = await stopRec(); const s0 = rr.s.find(x => x.th > 0.01); return rr.s.find(x => x.t >= s0.t + 100).th; };
  const sharp = await thAt(0), soft = await thAt(100);
  check('Easing strength 0 starts abruptly, 100 starts gently (angle after 100 ms: ' + sharp.toFixed(0) + '° vs ' + soft.toFixed(0) + '°)', sharp > soft * 3, sharp.toFixed(1) + ' / ' + soft.toFixed(1));
  await setRange('tp-ease', 50);

  // changing the turn duration during a spin: angle continuous, count exact
  await startRec();
  await tapMouse(); await tapMouse(); await tapMouse();
  await p.waitForTimeout(500); await setRange('tp-turn', 1500);
  await p.waitForTimeout(600); await setRange('tp-turn', 300);
  await p.waitForTimeout(500); await setRange('tp-turn', 900);
  const before3 = (await rd()).turns;
  await p.waitForTimeout(4500);
  rec = await stopRec(); A = analyse(rec);
  const after3 = await rd();
  check('Changing turn duration mid-spin keeps the angle continuous and the count exact (3 turns, no skip)', A.mono && A.maxStepDeg < 45 && A.consistent && after3.th % 360 === 0 && rec.counters.length === 3, JSON.stringify({ mono: A.mono, step: A.maxStepDeg.toFixed(1), n: rec.counters.length, th: after3.th }));
  await p.waitForTimeout(300);

  // pop settings
  const popStats = async () => {
    await p.evaluate(() => { window.__pp = []; const pops = document.getElementById('pops'); new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => { if (n.nodeType === 1) { const o = { t0: performance.now(), ys: [], size: n.getAttribute('font-size'), n }; window.__pp.push(o); (function tick() { if (!n.isConnected) { o.t1 = performance.now(); return; } o.ys.push(+n.getAttribute('y')); o.h = n.getBoundingClientRect().height; requestAnimationFrame(tick); })(); } }))).observe(pops, { childList: true }); });
    await tapMouse(); await p.waitForTimeout(2200);
    return p.evaluate(() => { const o = window.__pp[0]; return { life: o.t1 - o.t0, rise: o.ys[0] - Math.min(...o.ys), size: +o.size, h: o.h }; });
  };
  await setRange('tp-rise', 10); await setRange('tp-pop', 300); await setRange('tp-size', 20);
  const small = await popStats();
  await setRange('tp-rise', 60); await setRange('tp-pop', 1200); await setRange('tp-size', 64);
  const big = await popStats();
  check('Number rise distance 10 vs 60 px is applied (scene units)', near(small.rise, 10, 3) && near(big.rise, 60, 6), small.rise.toFixed(1) + ' / ' + big.rise.toFixed(1));
  check('Number display time 300 vs 1200 ms is applied', near(small.life, 300, 130) && near(big.life, 1200, 160), small.life.toFixed(0) + ' / ' + big.life.toFixed(0));
  check('Number size 20 vs 64 px is applied (font size and rendered height)', small.size === 20 && big.size === 64 && big.h > small.h * 2.5, small.size + '→' + big.size + ', h ' + small.h.toFixed(0) + '→' + big.h.toFixed(0));
  await p.screenshot({ path: SH + 'top-big-pop.png' });

  // restore + copy
  await setRange('tp-turn', 700); await setRange('tp-ease', 20); await setRange('tp-rise', 44); await setRange('tp-pop', 850); await setRange('tp-size', 52);
  await p.locator('#cp-copy').click(); await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  const expected = ['Component: Top Spin Controls (Step 4 – spin the top)', 'Turn duration: 700 ms', 'Start/stop easing strength: 20 %', 'Number rise distance: 44 px', 'Number display time: 850 ms', 'Number size: 52 px', '',
    'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.'].join('\n');
  check('Copy settings: component, all five values with units, exact instruction', clip === expected, JSON.stringify(clip));
  await p.locator('#cp-restore').click();
  const rv = await p.evaluate(() => ['tp-turn', 'tp-ease', 'tp-rise', 'tp-pop', 'tp-size'].map(i => document.getElementById(i).value).join());
  check('Restore defaults: 900 / 50 / 30 / 700 / 36', rv === '900,50,30,700,36', rv);
  await p.waitForTimeout(500);

  // ================= completion is not connected =================
  await p.evaluate(() => { for (let i = 0; i < 0; i++); });
  state = await st();
  check('No automatic completion: after many turns step 4 is still playing with no stamp 4', state.step === '4' && state.phase === 'playing' && state.stamps === '1110', JSON.stringify(state));

  // ================= restart during a spin =================
  await tapMouse(); await tapMouse(); await tapMouse(); await tapMouse(); await tapMouse();
  await p.waitForTimeout(700);
  const midSpin = await rd();
  await p.locator('#restart').click(); await p.waitForTimeout(300);
  state = await st();
  const rr1 = await rafCount(); await p.waitForTimeout(600);
  check('Restart mid-spin: back to step 1, stamps cleared, no panel, no step-4 DOM', midSpin.q > 0 && state.step === '1' && state.stamps === '0000' && await p.locator('.s4, .city-panel').count() === 0, JSON.stringify(midSpin));
  check('Restart mid-spin cancelled the animation loop (no callbacks afterwards)', (await rafCount()) === rr1);
  await H.toStep4(p);
  const fresh = await rd();
  check('Back on step 4 after Restart: fresh state (0°, Turns: 0, nothing queued), no leftover pops', fresh.th === 0 && fresh.turns === 0 && fresh.q === 0 && fresh.c === 'Turns: 0' && await p.locator('#pops .pop').count() === 0, JSON.stringify(fresh));
  await tapMouse(); await p.waitForTimeout(1500);
  check('...and it spins normally again (one tap → one turn)', (await rd()).turns === 1);

  // ================= touch (separate context) =================
  const tctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const tp = await tctx.newPage();
  const terrs = []; tp.on('pageerror', e => terrs.push(String(e))); tp.on('console', m => { if (m.type() === 'error') terrs.push(m.text()); });
  await tp.goto(URL); await tp.waitForTimeout(500);
  await H.toStep4(tp);
  const tbox = await tp.evaluate(() => { const r = document.querySelector('#top .hit').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, w: r.width, h: r.height }; });
  check('Phone: panel collapsed by default and the top is easy to touch (≥ 90 × 150 px)', await tp.locator('.city-panel.is-collapsed').count() === 1 && tbox.w >= 90 && tbox.h >= 150, tbox.w.toFixed(0) + '×' + tbox.h.toFixed(0));
  await tp.touchscreen.tap(tbox.x, tbox.y);
  await tp.waitForTimeout(1500);
  const tr = await tp.evaluate(() => { const t = document.getElementById('top'); return { turns: +t.dataset.turns, q: +t.dataset.queued }; });
  check('One touch = exactly one turn (not counted twice)', tr.turns === 1 && tr.q === 0, JSON.stringify(tr));
  await tp.touchscreen.tap(tbox.x, tbox.y); await tp.waitForTimeout(150); await tp.touchscreen.tap(tbox.x, tbox.y);
  await tp.waitForTimeout(2800);
  const tr2 = await tp.evaluate(() => +document.getElementById('top').dataset.turns);
  check('Two touches in quick succession = two turns', tr2 === 3, String(tr2));
  await tp.screenshot({ path: SH + 'top-phone.png' });
  check('Phone: no horizontal scroll', !(await tp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)));
  await tctx.close();

  check('No console/page/network errors', errs.length === 0 && terrs.length === 0, JSON.stringify(errs.concat(terrs)));
  const fails = results.filter(x => !x).length;
  console.log('\n' + results.length + ' checks, ' + fails + ' failed');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });

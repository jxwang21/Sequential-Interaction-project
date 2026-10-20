/* Checks for step 4 (spin the top to enter the code 3 -> 1 -> 7 read from the 3:17 clock) and its "Top Spin Controls" panel.
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
  const rd = () => p.evaluate(() => { const t = document.getElementById('top'); return { ph: t.dataset.phase, round: +t.dataset.round, q: +t.dataset.queued, th: +t.dataset.theta, ent: document.getElementById('scene').dataset.entered, digits: [...document.querySelectorAll('.s4 .slot')].map(s => s.dataset.digit).join('|') }; });
  const setRange = (id, v) => p.locator('#' + id).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const topBox = () => p.evaluate(() => { const r = document.querySelector('#top .hit').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, w: r.width, h: r.height, top: r.top }; });
  const taps = async (n, gap = 70) => { const t = await topBox(); await p.mouse.move(t.x, t.y); for (let i = 0; i < n; i++) { await p.mouse.down(); await p.mouse.up(); if (gap) await p.waitForTimeout(gap); } };
  const rafCount = () => p.evaluate(() => window.__raf);
  const waitEntered = (len, t = 25000) => p.waitForFunction(l => { const s = document.getElementById('scene'); return s && s.dataset.entered.split(',').filter(Boolean).length >= l; }, len, { timeout: t });
  const waitIdle = (t = 15000) => p.waitForFunction(() => { const e = document.getElementById('top'); return e && e.dataset.phase === 'idle'; }, null, { timeout: t });
  const slotsCleared = () => p.waitForFunction(() => { const s = document.getElementById('scene'); return s && s.dataset.entered === '' && document.getElementById('top').dataset.phase === 'idle'; }, null, { timeout: 8000 });

  const startRec = () => p.evaluate(() => {
    if (window.__R && window.__R.raf) cancelAnimationFrame(window.__R.raf);
    const R = window.__R = { s: [], raf: 0 };
    const top = document.getElementById('top'), scene = document.getElementById('scene'), msg = document.getElementById('msg'), slots = document.getElementById('slots');
    (function tick() {
      const f = document.querySelector('#fly text');
      R.s.push({ t: performance.now(), th: +top.dataset.theta, ph: top.dataset.phase, round: +top.dataset.round, q: +top.dataset.queued, ent: scene.dataset.entered, fx: f ? +f.getAttribute('x') : null, fy: f ? +f.getAttribute('y') : null, ft: f ? f.textContent : null, msg: msg.classList.contains('show') ? msg.textContent : '', locked: scene.classList.contains('locked'), ready: scene.classList.contains('ready'), sx: slots.getAttribute('transform'), next: [...document.querySelectorAll('.s4 .slot.next')].map(e => e.id).join() });
      R.raf = requestAnimationFrame(tick);
    })();
  });
  const stopRec = () => p.evaluate(() => { cancelAnimationFrame(window.__R.raf); return window.__R.s; });
  const first = (s, f, from = 0) => { for (let i = from; i < s.length; i++) if (f(s[i], i)) return i; return -1; };
  const analyse = s => {
    let mono = true, maxStep = 0;
    for (let i = 1; i < s.length; i++) { const d = s[i].th - s[i - 1].th; if (d < -1e-6) mono = false; maxStep = Math.max(maxStep, d); }
    return { mono, maxStep };
  };
  const nEnt = x => x.split(',').filter(Boolean).length;
  let A;

  // ================= entering step 4: layout and content =================
  await H.toStep4(p);
  let state = await st();
  check('Step 4 reached with stamps 1-3 kept', state.step === '4' && state.stamps === '1110');
  check('Hint is "Tap to spin. Pause to reveal each number."', (await p.locator('#hint').textContent()) === 'Tap to spin. Pause to reveal each number.');
  check('Clock reading 3:17 is shown as the clue', await p.locator('.s4 [aria-label="Clock showing 3:17"]').count() === 1);
  let r0 = await rd();
  check('Three empty code slots; top at rest; nothing entered', await p.locator('.s4 .slot').count() === 3 && r0.digits === '||' && r0.ent === '' && r0.th === 0 && r0.ph === 'idle' && r0.q === 0, JSON.stringify(r0));
  check('Old number buttons, math symbols and answer input are absent', await p.locator('.s4 .mark, .s4 #marks, .s4 input, .s4 button').count() === 0 && !/[+×÷=]/.test(await p.locator('#stage').textContent()));
  check('The code is not written anywhere and no digit is pre-filled', !/3\s*(→|->|,)\s*1/.test(await p.locator('#stage').textContent()) && r0.digits === '||');
  const box = await topBox();
  check('Top is large enough to hit (desktop ≥ 100 × 150 px)', box.w >= 100 && box.h >= 150, box.w.toFixed(0) + '×' + box.h.toFixed(0));
  check('Panel "Top Spin Controls" present with exactly four sliders and no dropdown', await p.locator('aside[aria-label="Top Spin Controls"]').count() === 1 && await p.locator('.city-panel input[type=range]').count() === 4 && await p.locator('.city-panel select').count() === 0);
  const defs = await p.evaluate(() => ['tp-turn', 'tp-confirm', 'tp-pop', 'tp-feedback'].map(id => { const e = document.getElementById(id); return [e.min, e.max, e.value].join('/'); }).join(' '));
  check('Controls: turn 200–900 (600), pause to confirm 700–1800 (1000), pop height 10–60 (30), feedback 400–1200 (800)', defs === '200/900/600 700/1800/1000 10/60/30 400/1200/800', defs);
  check('Idle at rest: no animation loop running', await (async () => { const a = await rafCount(); await p.waitForTimeout(600); return (await rafCount()) === a; })());
  await p.screenshot({ path: SH + 'code-rest.png' });

  // ================= hover / focus / press =================
  const stroke = () => p.evaluate(() => getComputedStyle(document.querySelector('#top .disc')).stroke);
  const base = await stroke();
  await p.mouse.move(box.x, box.y); await p.waitForTimeout(250);
  const hov = await stroke();
  check('Hover gives a light brightness change', hov !== base, base + ' → ' + hov);
  await p.mouse.move(5, 5); await p.waitForTimeout(250);
  await p.keyboard.press('Shift'); await p.evaluate(() => document.getElementById('top').focus()); await p.waitForTimeout(250);
  const foc = await stroke();
  check('Keyboard focus brightens the outline', foc !== base, base + ' → ' + foc);
  await p.evaluate(() => document.getElementById('top').blur());
  const tipOf = () => p.evaluate(() => { const g = document.getElementById('top-press'), m = g.getScreenCTM(); const pt = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; return { tip: pt(60, 148), scale: m.a }; });
  const before = await tipOf();
  await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.waitForTimeout(250);
  const during = await tipOf();
  check('Press feedback: body sinks slightly, the contact point (tip) stays put', during.scale < before.scale - 0.01 && near(during.tip[0], before.tip[0], 0.6) && near(during.tip[1], before.tip[1], 0.6), JSON.stringify({ s0: before.scale.toFixed(3), s1: during.scale.toFixed(3) }));
  await p.mouse.move(5, 5); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(400);
  check('Releasing outside the top cancels the tap (nothing queued)', (await rd()).q === 0 && (await rd()).ph === 'idle');

  // ================= round 1: keyboard Enter, Space, held Enter = 3 turns -> digit 3 =================
  await p.evaluate(() => document.getElementById('top').focus());
  await startRec();
  await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  await p.keyboard.press('Space'); await p.waitForTimeout(80);
  await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.up('Enter');
  await waitEntered(1); await p.waitForTimeout(200);
  let s = await stopRec();
  let ent = await rd();
  check('Keyboard: Enter, Space and a held Enter count once each → 3 turns → slot 1 shows 3', ent.digits === '3||' && ent.ent === '3', JSON.stringify(ent));
  const iw = first(s, x => x.ph === 'waiting'), ic = first(s, x => x.ph === 'feedback', iw);
  check('Pausing: the round is confirmed ≈ 1000 ms after the queue emptied', iw > 0 && ic > iw && near(s[ic].t - s[iw].t, 1000, 150), iw > 0 ? (s[ic].t - s[iw].t).toFixed(0) + ' ms' : 'no waiting phase');
  const lastTapTurns = s[iw].round;
  check('Number comes from the turns actually completed: 3 turns done when the pause started, popped number is 3', lastTapTurns === 3 && s.some(x => x.ft === '3'), 'round ' + lastTapTurns);
  const analysis = analyse(s);
  check('Angle monotonic (no reversal/reset) and smooth during the three queued turns', analysis.mono && analysis.maxStep < 40, analysis.maxStep.toFixed(1) + '°/frame');
  const moving = s.filter((x, i) => i && x.th > 200 && x.th < 900).map((x, i, a) => i ? (x.th - a[i - 1].th) / ((x.t - a[i - 1].t) / 1000) : null).filter(v => v !== null);
  check('No pause between queued turns (speed never drops near 0 between 200° and 900°)', Math.min(...moving) > 200, Math.min(...moving).toFixed(0) + '°/s');
  const flyS = s.filter(x => x.fx !== null);
  check('Number pops above the top, then travels into slot 1', flyS.length > 5 && near(flyS[0].fx, 180, 2) && flyS[flyS.length - 1].fx < 140 && Math.min(...flyS.map(x => x.fy)) < flyS[0].fy - 20, flyS.length ? JSON.stringify({ x0: flyS[0].fx, xN: flyS[flyS.length - 1].fx, y0: flyS[0].fy, yMin: Math.min(...flyS.map(x => x.fy)) }) : 'none');
  const lockedDuring = s.filter(x => x.ph === 'feedback').every(x => x.locked);
  check('Input is locked (top dimmed) during the number feedback', lockedDuring && s.some(x => x.ph === 'feedback'));
  const il = first(s, x => nEnt(x.ent) === 1);
  const unl = first(s, x => !x.locked, il);
  check('When the feedback ends the next slot is highlighted and the top is ready again', unl > 0 && s.slice(unl).some(x => x.next === 'slot-1'), unl > 0 ? 'unlocked ' + (s[unl].t - s[il].t).toFixed(0) + ' ms after landing' : 'never');
  await p.screenshot({ path: SH + 'code-slot1.png' });

  // ================= round 2: tap, then extra taps inside the confirm countdown stay in the same round =================
  await startRec();
  await taps(1, 0);
  await p.waitForFunction(() => document.getElementById('top').dataset.phase === 'waiting', null, { timeout: 5000 });
  await p.waitForTimeout(600);                                 // inside the 1000 ms pause
  const midWait = await rd();
  await taps(1, 0);                                            // extends the current round
  await waitEntered(2);
  await p.waitForTimeout(150);                                 // the error feedback is on screen now
  const dTap = await rd();
  await taps(1, 0); await p.waitForTimeout(100);
  const dTap2 = await rd();
  await p.waitForTimeout(1000);                                // keep recording through the rest of the feedback
  s = await stopRec();
  const iw2 = first(s, x => x.ph === 'waiting'), ic2 = first(s, x => x.ph === 'feedback');
  const second = first(s, x => x.ph === 'spinning', iw2);
  check('A tap during the pause continues the same round (spins again, waits again)', midWait.ph === 'waiting' && second > iw2, JSON.stringify(midWait));
  check('...the pause restarts: confirmed ≈ 1000 ms after the second spin ended', ic2 > 0 && near(s[ic2].t - s[first(s, x => x.ph === 'waiting', second)].t, 1000, 150));
  check('...and the revealed number is 2 (both taps counted, one round)', s.some(x => x.ft === '2') && !s.some(x => x.ft === '1'));
  check('Wrong digit (2 is not 1): number shown first, then "Wrong sequence. Try again."', first(s, x => x.ft === '2') >= 0 && first(s, x => x.msg === 'Wrong sequence. Try again.') > first(s, x => x.ft === '2'), '');
  const sh = s.filter(x => x.msg).map(x => /translate\(([\d.]+)/.exec(x.sx)).filter(Boolean).map(m => +m[1]);
  check('Wrong digit: slots shake (not colour alone)', Math.max(...sh) - Math.min(...sh) > 2, (Math.max(...sh) - Math.min(...sh)).toFixed(1));
  await p.screenshot({ path: SH + 'code-wrong.png' });
  check('Taps during the error feedback are ignored (nothing queued, round unchanged)', dTap.ph === 'feedback' && dTap2.q === dTap.q && dTap2.round === dTap.round && dTap2.ph === 'feedback', JSON.stringify([dTap, dTap2]));
  await slotsCleared();
  ent = await rd(); state = await st();
  check('After the error all three slots, the round and the queue are cleared; steps 1-3 and stamps untouched; still step 4', ent.digits === '||' && ent.ent === '' && ent.q === 0 && ent.round === 0 && state.step === '4' && state.stamps === '1110', JSON.stringify(ent));

  // ================= maximum 9 turns per round =================
  await startRec();
  await taps(12, 12);
  const limitMsg = await p.locator('#msg').textContent();
  const limitShown = await p.locator('#msg.show').count();
  await waitEntered(1);
  s = await stopRec();
  const nine = s.find(x => x.ft);
  check('Round is capped at 9 turns: 12 quick taps → digit 9, no extra rotation queued', s.some(x => x.ft === '9') && Math.max(...s.map(x => x.th)) - s[0].th <= 9 * 360 + 0.01, 'turns ' + ((Math.max(...s.map(x => x.th)) - s[0].th) / 360).toFixed(2));
  check('Reaching the limit gives a gentle cue ("Maximum is 9 turns.")', limitMsg === 'Maximum is 9 turns.' && limitShown === 1, limitMsg);
  await slotsCleared();

  // ================= single animation loop =================
  await taps(4, 20);                                            // a long spin; the digit 4 will be wrong at slot 1, which is fine here
  await p.waitForTimeout(400);
  const r1 = await rafCount(); await p.waitForTimeout(1000); const r2 = await rafCount();
  check('Only one animation loop while spinning (≈ one callback per frame)', r2 - r1 > 30 && r2 - r1 < 80, String(r2 - r1));
  await waitEntered(1); await slotsCleared();
  await p.waitForTimeout(700);                                  // the short "ready" highlight after a reset ends
  const r3 = await rafCount(); await p.waitForTimeout(800);
  check('No loop left running once the round is finished and the top is idle', (await rafCount()) === r3);

  // ================= rapid taps: 3, 1, 7 with real mouse presses =================
  await startRec();
  await taps(3, 12);
  await waitEntered(1);
  await waitIdle();
  await p.waitForTimeout(200);
  s = await stopRec();
  A = analyse(s);
  check('3 rapid taps → exactly 3 turns, popped number is 3 (not ahead of the rotation)', s.some(x => x.ft === '3') && Math.max(...s.map(x => x.th)) - s[0].th === 1080 && (await rd()).ent === '3', '');
  check('Rapid taps: angle monotonic and smooth', A.mono && A.maxStep < 40, A.maxStep.toFixed(1));
  // taps while the number is being shown
  await taps(1, 0);                                             // slot 1 is not locked now (idle)
  await waitEntered(2);
  check('1 tap → slot 2 shows 1; slot 1 keeps 3 (not overwritten)', (await rd()).digits === '3|1|' && (await rd()).ent === '3,1', JSON.stringify(await rd()));
  await waitIdle();

  // ================= wrong third digit clears all three =================
  await taps(5, 40);
  await waitEntered(3);
  await p.waitForTimeout(300);
  check('Wrong last digit (5): "Wrong sequence. Try again." and the earlier 3 and 1 are shown first', (await p.locator('#msg').textContent()) === 'Wrong sequence. Try again.' && (await rd()).digits === '3|1|5');
  await slotsCleared();
  ent = await rd();
  check('...then everything in step 4 is cleared and entry restarts at slot 1', ent.digits === '||' && ent.ent === '' && (await st()).stamps === '1110');

  // ================= panel bindings (use one-tap rounds; every digit 1 here is wrong at slot 1, which is fine) =================
  const oneRound = async () => { await startRec(); await taps(1, 0); await waitEntered(1); await p.waitForTimeout(300); const x = await stopRec(); await slotsCleared(); return x; };
  const turnDur = x => { const a = first(x, y => y.th > x[0].th + 0.5), z = first(x, y => y.ph === 'waiting', a); return x[z].t - x[a].t; };
  await setRange('tp-turn', 200);
  let rec1 = await oneRound();
  const d200 = turnDur(rec1);
  await setRange('tp-turn', 900);
  rec1 = await oneRound();
  const d900 = turnDur(rec1);
  check('Turn duration 200 ms and 900 ms are applied (one tap)', near(d200, 200, 90) && near(d900, 900, 130), d200.toFixed(0) + ' / ' + d900.toFixed(0) + ' ms');
  await setRange('tp-turn', 600);
  await setRange('tp-confirm', 700);
  rec1 = await oneRound();
  const pa = first(rec1, y => y.ph === 'waiting'), pb = first(rec1, y => y.ph === 'feedback', pa);
  const c700 = rec1[pb].t - rec1[pa].t;
  await setRange('tp-confirm', 1800);
  rec1 = await oneRound();
  const pc = first(rec1, y => y.ph === 'waiting'), pd = first(rec1, y => y.ph === 'feedback', pc);
  const c1800 = rec1[pd].t - rec1[pc].t;
  check('Pause to confirm 700 ms and 1800 ms are applied', near(c700, 700, 120) && near(c1800, 1800, 160), c700.toFixed(0) + ' / ' + c1800.toFixed(0) + ' ms');
  await setRange('tp-confirm', 1000);
  await setRange('tp-pop', 10);
  rec1 = await oneRound();
  const f10 = rec1.filter(y => y.fy !== null);
  await setRange('tp-pop', 60);
  rec1 = await oneRound();
  const f60 = rec1.filter(y => y.fy !== null);
  const rise = f => f[0].fy - Math.min(...f.map(y => y.fy));
  check('Number pop height 10 vs 60 px is applied', near(rise(f10), 10, 3) && near(rise(f60), 60, 6), rise(f10).toFixed(1) + ' / ' + rise(f60).toFixed(1));
  await setRange('tp-pop', 30);
  await setRange('tp-feedback', 400);
  rec1 = await oneRound();
  const fb = x => { const a = first(x, y => y.ph === 'feedback'), z = first(x, y => nEnt(y.ent) === 1, a); return x[z].t - x[a].t; };
  const fb400 = fb(rec1);
  await setRange('tp-feedback', 1200);
  rec1 = await oneRound();
  const fb1200 = fb(rec1);
  check('Number feedback time 400 ms and 1200 ms are applied', near(fb400, 400, 120) && near(fb1200, 1200, 150), fb400.toFixed(0) + ' / ' + fb1200.toFixed(0) + ' ms');
  await p.screenshot({ path: SH + 'code-panel.png' });
  await setRange('tp-feedback', 800);

  // changing the turn duration mid-spin keeps the angle continuous and the turn count exact
  await startRec();
  await taps(3, 10);
  await p.waitForTimeout(300); await setRange('tp-turn', 900);
  await p.waitForTimeout(500); await setRange('tp-turn', 200);
  await p.waitForTimeout(300); await setRange('tp-turn', 600);
  await waitEntered(1);
  s = await stopRec();
  A = analyse(s);
  const wRound = s[first(s, y => y.ph === 'waiting')].round;
  check('Changing turn duration mid-spin: angle continuous, count exact (3 turns, digit 3)', A.mono && A.maxStep < 60 && wRound === 3 && s.some(y => y.ft === '3'), JSON.stringify({ step: A.maxStep.toFixed(1), round: wRound }));
  await waitIdle();
  // ...this entered a correct 3 in slot 1; keep going: 1 then 7 for the success run below

  // restore + copy
  await setRange('tp-turn', 350); await setRange('tp-confirm', 1300); await setRange('tp-pop', 44); await setRange('tp-feedback', 650);
  await p.locator('#cp-copy').click(); await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  const expected = ['Component: Top Spin Controls (Step 4 – spin the top to enter the code)', 'Turn duration: 350 ms', 'Pause to confirm: 1300 ms', 'Number pop height: 44 px', 'Number feedback time: 650 ms', '',
    'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.'].join('\n');
  check('Copy settings: component, all four values with units, exact instruction', clip === expected, JSON.stringify(clip));
  await p.locator('#cp-restore').click();
  const rv = await p.evaluate(() => ['tp-turn', 'tp-confirm', 'tp-pop', 'tp-feedback'].map(i => document.getElementById(i).value).join());
  check('Restore defaults: 600 / 1000 / 30 / 800', rv === '600,1000,30,800', rv);

  // ================= full correct code: 3 (done), 1 (done above? check) then 7 =================
  // slot 1 holds 3 from the mid-spin test; enter 1 with a single tap, then 7 with seven rapid taps
  await taps(1, 0); await waitEntered(2); await waitIdle();
  ent = await rd();
  check('Slots hold 3 and 1 before the last digit', ent.digits === '3|1|', JSON.stringify(ent));
  await p.evaluate(() => { window.__seq = []; const d = document.getElementById('paper'); new MutationObserver(() => { const v = d.dataset.step + ':' + d.dataset.phase; if (window.__seq[window.__seq.length - 1] !== v) window.__seq.push(v); }).observe(d, { attributes: true }); });
  await startRec();
  await taps(7, 12);
  await waitEntered(3);
  await p.waitForTimeout(300);
  s = await stopRec();
  const popped7 = s.some(y => y.ft === '7');
  check('7 rapid taps → 7 turns → digit 7 in slot 3 (the number comes from the completed turns)', popped7 && (await rd()).digits === '3|1|7', JSON.stringify(await rd()));
  const pulsed = s.some(y => /scale\(1\.0[1-9]/.test(y.sx || ''));
  check('Success feedback: the three slots pulse together once', pulsed);
  await p.screenshot({ path: SH + 'code-success.png' });
  await p.waitForFunction(() => document.getElementById('paper').dataset.phase === 'ended', null, { timeout: 12000 });
  const seq = await p.evaluate(() => window.__seq);
  state = await st();
  check('Only 3 → 1 → 7 completes step 4: stamp 4, "All steps completed", Start again', state.stamps === '1111' && (await p.locator('#ending-text').textContent()) === 'All steps completed' && await p.locator('#again').isVisible(), JSON.stringify(state));
  check('Success fires once (4 completing → … → 4 ended, each once)', seq.filter(v => v === '4:completing').length === 1 && seq.filter(v => v === '4:ended').length === 1, seq.join(' > '));
  await p.waitForTimeout(1500);
  check('...and stays on the final state (no second completion)', (await st()).phase === 'ended' && (await p.evaluate(() => window.__seq)).filter(v => v === '4:completing').length === 1);
  await p.screenshot({ path: SH + 'code-ended.png' });
  await p.locator('#again').click(); await p.waitForTimeout(800);
  check('Start again returns to a clean step 1', (await st()).step === '1' && (await st()).stamps === '0000' && await p.locator('.s4, .city-panel').count() === 0);

  // ================= Restart during a spin, and during the confirm countdown =================
  await H.toStep4(p);
  await taps(5, 20);
  await p.waitForTimeout(500);
  const midSpin = await rd();
  await p.locator('#restart').click(); await p.waitForTimeout(300);
  const rA = await rafCount(); await p.waitForTimeout(700);
  check('Restart mid-spin: back to step 1, step 4 DOM and panel removed, animation loop cancelled', midSpin.ph === 'spinning' && (await st()).step === '1' && await p.locator('.s4, .city-panel').count() === 0 && (await rafCount()) === rA, JSON.stringify(midSpin));
  await H.toStep4(p);
  const freshA = await rd();
  check('Back on step 4: fresh state (0°, nothing queued, empty slots)', freshA.th === 0 && freshA.q === 0 && freshA.digits === '||' && freshA.ph === 'idle', JSON.stringify(freshA));
  await taps(2, 20);
  await p.waitForFunction(() => document.getElementById('top').dataset.phase === 'waiting', null, { timeout: 6000 });
  await p.waitForTimeout(300);
  await p.locator('#restart').click(); await p.waitForTimeout(300);
  const rB = await rafCount(); await p.waitForTimeout(1600);
  check('Restart during the confirm countdown: the countdown is cancelled (no loop, no stray confirmation)', (await rafCount()) === rB && (await st()).step === '1');
  await H.toStep4(p);
  await p.waitForTimeout(1800);
  const freshB = await rd();
  check('A cancelled countdown never fires later: step 4 starts empty and idle', freshB.ent === '' && freshB.digits === '||' && freshB.ph === 'idle' && freshB.th === 0, JSON.stringify(freshB));

  // ================= touch (separate context) =================
  const tctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const tp = await tctx.newPage();
  const terrs = []; tp.on('pageerror', e => terrs.push(String(e))); tp.on('console', m => { if (m.type() === 'error') terrs.push(m.text()); });
  await tp.goto(URL); await tp.waitForTimeout(500);
  await H.toStep4(tp);
  const tbox = await tp.evaluate(() => { const r = document.querySelector('#top .hit').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, w: r.width, h: r.height }; });
  check('Phone: panel collapsed by default, top easy to touch (≥ 70 × 110 px)', await tp.locator('.city-panel.is-collapsed').count() === 1 && tbox.w >= 70 && tbox.h >= 110, tbox.w.toFixed(0) + '×' + tbox.h.toFixed(0));
  await tp.touchscreen.tap(tbox.x, tbox.y);
  await tp.waitForTimeout(900);
  const t1 = await tp.evaluate(() => { const t = document.getElementById('top'); return { round: +t.dataset.round, q: +t.dataset.queued }; });
  check('One touch = exactly one turn (not counted twice)', t1.round === 1 && t1.q === 0, JSON.stringify(t1));
  await tp.touchscreen.tap(tbox.x, tbox.y); await tp.waitForTimeout(150); await tp.touchscreen.tap(tbox.x, tbox.y);
  await tp.waitForTimeout(1500);                                // 3 turns done, still inside the confirm pause
  const t3 = await tp.evaluate(() => +document.getElementById('top').dataset.round);
  check('Two more touches in quick succession = 2 more turns in the same round (3 total)', t3 === 3, String(t3));
  await tp.screenshot({ path: SH + 'code-phone.png' });

  // ---- several fingers at once (real two-point touches through the DevTools protocol)
  const cdp = await tctx.newCDPSession(tp);
  const sent = () => tp.evaluate(() => { const t = document.getElementById('top'); return +t.dataset.round + +t.dataset.queued; });   // turns requested this round
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const base0 = await sent();
  await touch('touchStart', [{ x: tbox.x - 14, y: tbox.y, id: 1 }, { x: tbox.x + 14, y: tbox.y - 10, id: 2 }]);
  await tp.waitForTimeout(80);
  await touch('touchEnd', []);
  await tp.waitForTimeout(150);
  const base1 = await sent();
  check('Two fingers tapping together = two turns (one per finger, none doubled)', base1 - base0 === 2, String(base1 - base0));
  await touch('touchStart', [{ x: tbox.x, y: tbox.y, id: 1 }]);
  await tp.waitForTimeout(60);
  await touch('touchMove', [{ x: 8, y: 8, id: 1 }]);
  await tp.waitForTimeout(60);
  await touch('touchEnd', []);
  await tp.waitForTimeout(150);
  check('A finger that slides off the top before lifting is not counted', (await sent()) === base1, String((await sent()) - base1));
  await touch('touchStart', [{ x: tbox.x, y: tbox.y, id: 1 }, { x: 8, y: 8, id: 2 }]);
  await tp.waitForTimeout(60);
  await touch('touchEnd', []);
  await tp.waitForTimeout(150);
  check('One finger on the top plus one elsewhere = one turn', (await sent()) === base1 + 1, String((await sent()) - base1));

  // ---- phone with the panel open: the top stays touchable and nothing is covered
  await tp.waitForTimeout(3500);
  await tp.locator('.cp-toggle').click(); await tp.waitForTimeout(500);
  const open = await tp.evaluate(() => { const r = document.querySelector('#top .hit').getBoundingClientRect(); const pn = document.querySelector('.city-panel').getBoundingClientRect(); const sc = document.getElementById('scene').getBoundingClientRect(); return { w: r.width, h: r.height, panelTop: pn.top, sceneBottom: sc.bottom, panelH: pn.height }; });
  check('Phone with the panel open: top ≥ 44 × 44 px (touch minimum), sheet ≤ 40% of the screen, scene not covered', open.w >= 44 && open.h >= 44 && open.panelH <= 330 && open.sceneBottom <= open.panelTop + 1, JSON.stringify({ w: open.w.toFixed(0), h: open.h.toFixed(0), panelH: open.panelH.toFixed(0) }));
  await tp.screenshot({ path: SH + 'code-phone-open.png' });
  check('Phone: no horizontal scroll', !(await tp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)));
  await tctx.close();

  check('No console/page/network errors', errs.length === 0 && terrs.length === 0, JSON.stringify(errs.concat(terrs)));
  const fails = results.filter(x => !x).length;
  console.log('\n' + results.length + ' checks, ' + fails + ' failed');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });

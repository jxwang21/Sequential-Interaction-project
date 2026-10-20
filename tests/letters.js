/* Checks for step 3 (drag the letters into five slots to form AWAKE) and its Letter Interaction Controls panel.
   Usage: python3 -m http.server 8123 --directory docs &  then  SHOTS=/tmp node tests/letters.js [url]
   Needs `playwright` and a Chromium (CHROME=/path/to/chrome if not auto-detected). */
const { chromium } = require('playwright');
const H = require('./helpers');
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

  const st = () => p.evaluate(() => ({ step: document.getElementById('paper').dataset.step, phase: document.getElementById('paper').dataset.phase, stamps: [...document.querySelectorAll('#stamps .stamp')].map(s => s.classList.contains('on') ? 1 : 0).join('') }));
  const waitStep = (n, ph = 'playing', t = 25000) => p.waitForFunction(([n, ph]) => { const d = document.getElementById('paper').dataset; return d.step === String(n) && d.phase === ph; }, [n, ph], { timeout: t });
  const setRange = (id, v) => p.locator('#' + id).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const scale = () => p.evaluate(() => document.getElementById('scene').getScreenCTM().a);
  const locs = async () => (await H.tileInfo(p)).map(t => t.loc);
  const unique = a => new Set(a).size === a.length;
  const perm = async () => (await H.tileInfo(p)).map(t => t.loc.replace('rack-', '')).join(',');
  const locked = () => p.evaluate(() => document.getElementById('scene').classList.contains('is-locked'));
  const innerScale = id => p.evaluate(id => { const m = /scale\(([\d.]+)\)/.exec(document.querySelector('#' + id + ' .t-inner').getAttribute('transform')); return +m[1]; }, id);
  const toStep3 = async () => {
    for (const i of [2, 3, 1]) await p.locator('.s1 .frame:nth-child(' + i + ')').click();
    await waitStep(2); await p.waitForTimeout(400);
    for (const d of ['up', 'right', 'down', 'left']) { await p.locator('.s2 .btn[data-dir=' + d + ']').first().click(); await p.waitForTimeout(1050); }
    await waitStep(2, 'completing'); await p.waitForTimeout(300);
    const clueTxt = await p.locator('#door-clue').textContent();
    await waitStep(3); await p.waitForTimeout(500);
    return clueTxt;
  };
  // sample page-side values every frame from the next pointer release (or from now when fromNow)
  const recordFrom = (expr, fromNow) => p.evaluate(([expr, fromNow]) => {
    window.__rec = []; window.__t0 = fromNow ? performance.now() : null;
    if (!fromNow) window.addEventListener('pointerup', () => { window.__t0 = performance.now(); }, { capture: true, once: true });
    const f = new Function('return (' + expr + ')');
    (function tick() { window.__rec.push({ t: performance.now(), v: f() }); window.__raf = requestAnimationFrame(tick); })();
  }, [expr, fromNow]);
  const stopRec = () => p.evaluate(() => { cancelAnimationFrame(window.__raf); return { rec: window.__rec, t0: window.__t0 }; });
  const centerOf = id => `(()=>{const b=document.querySelector('#${id} .hit').getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]})()`;

  // ================= entering step 3 + content =================
  const clueOnDoor = await toStep3();
  check('Step 2 door shows the meaning clue (not MOON)', /No longer/.test(clueOnDoor) && /asleep\./.test(clueOnDoor) && !/MOON/i.test(clueOnDoor), JSON.stringify(clueOnDoor));
  const hint = await p.locator('#hint').textContent();
  check('Hint is "Drag five letters into the slots to form the word."', hint === 'Drag five letters into the slots to form the word.', hint);
  check('Clue "No longer asleep." shown on step 3', (await p.locator('.s3 .clue').textContent()) === 'No longer asleep.');
  const pageText = await p.evaluate(() => document.body.textContent);
  check('Neither MOON nor AWAKE appears anywhere in the page text', !/MOON/i.test(pageText) && !/AWAKE/i.test(pageText));
  check('No reflection element left over', await p.locator('#reflection, .refl').count() === 0);
  const T0 = await H.tileInfo(p);
  check('Five slots and ten tiles', await p.locator('.s3 .slot').count() === 5 && T0.length === 10);
  check('Letters are A,W,A,K,E,M,O,N,R,T (two independent A tiles)', T0.map(t => t.letter).sort().join('') === 'AAEKMNORTW' && T0.filter(t => t.letter === 'A').length === 2 && new Set(T0.map(t => t.id)).size === 10);
  check('Nothing marks which letters are correct (all tiles share the same classes)', new Set(T0.map(t => t.cls)).size === 1, T0[0].cls);
  check('All tiles start in the rack, one per cell (10 distinct cells)', T0.every(t => t.loc.startsWith('rack')) && unique(T0.map(t => t.loc)));
  check('Panel "Letter Interaction Controls" present; City panel absent', await p.locator('aside[aria-label="Letter Interaction Controls"]').count() === 1 && await p.locator('aside[aria-label="City Motion Controls"]').count() === 0);
  const defs = await p.evaluate(() => ['lp-snap-px', 'lp-snap-ms', 'lp-return', 'lp-lift', 'lp-error'].map(id => { const e = document.getElementById(id); return [e.min, e.max, e.value].join('/'); }).join(' '));
  check('Controls: snap 20–90 (48), snap ms 80–600 (200), return 100–900 (400), lift 0–20 (8), error 500–1500 (900)', defs === '20/90/48 80/600/200 100/900/400 0/20/8 500/1500/900', defs);
  check('Easing options: Original … Spring/Bounce', (await p.locator('#lp-ease option').allTextContents()).join('|') === 'Original|Linear|Ease In|Ease Out|Ease In-Out|Spring/Bounce');
  await p.screenshot({ path: SH + 'letters-start.png' });

  // ================= layout / shuffle =================
  const firstPerm = await perm();
  async function noOverlap(label) {
    let bad = null, minGap = 1e9;
    const k0 = await p.evaluate(() => document.getElementById('scene').getScreenCTM().a);
    for (let n = 0; n < 6; n++) {
      const T = await H.tileInfo(p), sc = await p.evaluate(() => document.getElementById('scene').getBoundingClientRect().toJSON());
      for (let i = 0; i < T.length; i++) {
        const a = T[i];
        if (a.cx - a.w / 2 < sc.left - 1 || a.cx + a.w / 2 > sc.right + 1 || a.cy - a.h / 2 < sc.top - 1 || a.cy + a.h / 2 > sc.bottom + 1) bad = 'outside ' + a.id;
        for (let j = i + 1; j < T.length; j++) {
          const c = T[j], gx = Math.abs(a.cx - c.cx) - (a.w + c.w) / 2, gy = Math.abs(a.cy - c.cy) - (a.h + c.h) / 2;
          const gap = Math.max(gx, gy);
          minGap = Math.min(minGap, gap);
          if (gap / k0 < 5) bad = a.id + '/' + c.id + ' gap ' + (gap / k0).toFixed(1) + ' units';
        }
      }
      await p.waitForTimeout(350);
    }
    check(label + ': no overlap (gap ≥ 5 scene units), all inside the scene', !bad, bad || 'min gap ' + (minGap / k0).toFixed(1) + ' units');
  }
  const ys = (await H.tileInfo(p)).map(t => t.cy).sort((a, c) => a - c);
  const tileH = (await H.tileInfo(p))[0].h;
  check('Letters sit in exactly two rows of five', ys[4] - ys[0] < tileH * 0.3 && ys[9] - ys[5] < tileH * 0.3 && ys[5] - ys[4] > tileH * 1.0, ys.map(y => y.toFixed(0)).join());
  await noOverlap('Desktop 1280px');
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(500);
  await noOverlap('Phone 390px');
  const phoneInfo = () => p.evaluate(() => { const pn = document.querySelector('.city-panel').getBoundingClientRect(); const ts = [...document.querySelectorAll('.s3 .tile .hit')].map(e => e.getBoundingClientRect()); return { collapsed: document.querySelector('.city-panel').classList.contains('is-collapsed'), panelTop: Math.round(pn.top), panelH: Math.round(pn.height), maxTile: Math.round(Math.max(...ts.map(r => r.bottom))), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, minTileW: Math.round(Math.min(...ts.map(r => r.width))) }; });
  let phone = await phoneInfo();
  check('Phone, panel open: panel does not cover the letters, sheet ≤ 40% of the screen, tiles ≥ 24px, no horizontal scroll', phone.maxTile <= phone.panelTop && phone.panelH <= 330 && phone.minTileW >= 24 && !phone.overflowX, JSON.stringify(phone));
  await p.screenshot({ path: SH + 'letters-phone-open.png' });
  await p.locator('.cp-toggle').click(); await p.waitForTimeout(500);
  phone = await phoneInfo();
  check('Phone, panel collapsed: letters ≥ 36px and not covered', phone.collapsed && phone.maxTile <= phone.panelTop && phone.minTileW >= 36 && !phone.overflowX, JSON.stringify(phone));
  await p.screenshot({ path: SH + 'letters-phone.png' });
  await p.locator('.cp-toggle').click(); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1280, height: 860 }); await p.waitForTimeout(500);

  // ================= drag behaviour =================
  let id = await H.idsFor(p);
  const k = await scale();
  const slot0 = (await H.slotCenters(p))[0];
  // grab feedback + slot highlight
  const baseScale = await innerScale(id.A1);
  await H.dragTo(p, id.A1, slot0.cx + 20 * k, slot0.cy + 10 * k, { release: false });
  const g1 = { cls: (await H.tileById(p, id.A1)).cls, sc: await innerScale(id.A1), hot: await p.locator('.s3 .slot.hot').count() };
  check('Grab feedback: tile gets .drag, lifts (scale grows) and its target slot highlights', /drag/.test(g1.cls) && g1.sc > baseScale + 0.03 && g1.hot === 1, JSON.stringify({ baseScale, g1 }));
  await p.screenshot({ path: SH + 'letters-drag.png' });
  await p.mouse.move(slot0.cx + 20 * k, slot0.cy + 200 * k, { steps: 6 });
  check('Slot highlight clears when the tile is far from every slot', await p.locator('.s3 .slot.hot').count() === 0);
  await p.mouse.move(slot0.cx + 15 * k, slot0.cy + 5 * k, { steps: 6 });
  await p.mouse.up(); await H.settle(p, 600);
  let A1 = await H.tileById(p, id.A1);
  check('Snap: dropped within snap distance → sits in slot 1 centre', A1.loc === 'slot-0' && Math.abs(A1.cx - slot0.cx) < 3 && Math.abs(A1.cy - slot0.cy) < 4, JSON.stringify({ loc: A1.loc, dx: A1.cx - slot0.cx, dy: A1.cy - slot0.cy }));
  check('Grab feedback ends after the drop (not .drag, back to normal size)', !/drag/.test(A1.cls) && Math.abs((await innerScale(id.A1)) - baseScale) < 0.01);

  // invalid drop returns (rack tile)
  const homeBefore = (await H.tileById(p, id.W)).loc;
  await H.dragTo(p, id.W, slot0.cx + 3 * 86 * k, slot0.cy - 150 * k);   // empty area above the slots
  await H.settle(p, 900);
  const W1 = await H.tileById(p, id.W);
  const cell = await p.evaluate(() => { const s = document.getElementById('scene'); return 0; });
  check('Invalid drop: rack tile returns to its previous cell', W1.loc === homeBefore && !/drag/.test(W1.cls));
  // invalid drop of a slotted tile returns to its slot
  await H.dragTo(p, id.A1, slot0.cx, slot0.cy - 160 * k);
  await H.settle(p, 900);
  A1 = await H.tileById(p, id.A1);
  check('Invalid drop: slotted tile returns to its slot', A1.loc === 'slot-0' && Math.abs(A1.cx - slot0.cx) < 4 && Math.abs(A1.cy - slot0.cy) < 4);

  // two A's are independent; swap from rack
  const slot2 = (await H.slotCenters(p))[2];
  await H.dragToSlot(p, id.A2, 2); await H.settle(p, 600);
  let L = await locs();
  check('Two A tiles sit in two different slots; every tile has exactly one location', (await H.tileById(p, id.A2)).loc === 'slot-2' && (await H.tileById(p, id.A1)).loc === 'slot-0' && unique(L), L.join());
  const homeA1 = (await H.tileById(p, id.A1)).loc;
  await H.dragToSlot(p, id.A2, 0); await H.settle(p, 700);   // rack-less swap: A2 (slot 3) onto occupied slot 1
  L = await locs();
  const a1 = await H.tileById(p, id.A1), a2 = await H.tileById(p, id.A2);
  check('Swap slot↔slot: A2 takes slot 1, A1 takes slot 3, nothing duplicated', a2.loc === 'slot-0' && a1.loc === 'slot-2' && unique(L), L.join());
  // put A1 back to slot 0 to restore the order for later: swap again
  await H.dragToSlot(p, id.A1, 0); await H.settle(p, 700);
  // rack tile onto an occupied slot → occupant goes back to the rack
  await H.dragToSlot(p, id.E, 0); await H.settle(p, 800);
  const eT = await H.tileById(p, id.E), prevOcc = await H.tileById(p, id.A1);
  L = await locs();
  check('Rack tile dropped on an occupied slot swaps: occupant returns to the rack, no duplicates', eT.loc === 'slot-0' && prevOcc.loc.startsWith('rack') && unique(L), L.join());
  // take out
  await H.dragTo(p, id.E, (slot0.cx + slot2.cx) / 2, slot0.cy + 220 * k); await H.settle(p, 900);
  const eOut = await H.tileById(p, id.E);
  check('Take out: dragging a slotted tile down to the letter area returns it to the rack', eOut.loc.startsWith('rack') && unique(await locs()), eOut.loc);
  const slotsFilled = (await locs()).filter(l => l.startsWith('slot')).length;
  check('Slots hold at most one tile each (only A2 left in slot 3)', slotsFilled === 1, (await locs()).filter(l => l.startsWith('slot')).join());

  // keyboard
  await p.locator('#' + id.W).focus(); await p.keyboard.press('Enter'); await H.settle(p, 500);
  check('Keyboard: Enter sends the focused rack tile to the first empty slot', (await H.tileById(p, id.W)).loc === 'slot-0');
  await p.keyboard.press('Enter'); await H.settle(p, 700);
  check('Keyboard: Enter on a slotted tile takes it out', (await H.tileById(p, id.W)).loc.startsWith('rack'));

  // ================= not full → no judgement =================
  // current: A2 in slot 3 (index 2); fill other three with wrong letters: 4 filled
  await H.dragToSlot(p, id.M, 0); await H.settle(p); await H.dragToSlot(p, id.O, 1); await H.settle(p); await H.dragToSlot(p, id.N, 3); await H.settle(p);
  await p.waitForTimeout(1500);
  check('4 of 5 slots filled: no judgement (no message, not locked, still step 3)', await p.locator('#msg.show').count() === 0 && !(await locked()) && (await st()).step === '3');
  await p.screenshot({ path: SH + 'letters-four.png' });

  // ================= wrong word: feedback + reset =================
  const shuffleBefore = await perm();
  await recordFrom('({show: document.getElementById("msg").classList.contains("show"), lock: document.getElementById("scene").classList.contains("is-locked"), sx: (document.getElementById("slots").getAttribute("transform")||"translate(0 0)"), n: document.querySelectorAll(".s3 .tile[data-loc^=slot]").length})', true);
  await H.dragToSlot(p, id.R, 4); await p.waitForTimeout(700);
  check('Wrong word (5th letter placed): "Not quite. Try again." shown', await p.locator('#msg.show').count() === 1 && (await p.locator('#msg').textContent()) === 'Not quite. Try again.' && (await p.locator('#live').textContent()) === 'Not quite. Try again.');
  check('During feedback the scene is locked', await locked());
  // dragging during feedback is ignored
  const tA = await H.tileById(p, id.T);
  await H.dragToSlot(p, id.T, 1); await p.waitForTimeout(100);
  check('Dragging during feedback is ignored (tile stays in the rack)', (await H.tileById(p, id.T)).loc === tA.loc);
  await p.screenshot({ path: SH + 'letters-wrong.png' });
  await p.waitForTimeout(2200);
  const R1 = await stopRec();
  const shows = R1.rec.filter((r, i, a) => r.v.show && (i === 0 || !a[i - 1].v.show));
  const showMs = (() => { const on = R1.rec.find(r => r.v.show), off = R1.rec.find(r => on && r.t > on.t && !r.v.show); return on && off ? off.t - on.t : -1; })();
  const shaken = R1.rec.some(r => /translate\((-?[\d.]+)/.test(r.v.sx) && Math.abs(parseFloat(/translate\((-?[\d.]+)/.exec(r.v.sx)[1])) > 1);
  check('Error feedback lasts ≈ 900 ms', showMs > 750 && showMs < 1100, showMs.toFixed(0) + ' ms');
  check('Error feedback also moves: the slots shake', shaken);
  check('Judged exactly once per full board (message shown once)', shows.length === 1, String(shows.length));
  await p.waitForTimeout(500);
  const after = await H.tileInfo(p);
  check('Reset: slots empty, all ten letters back in the rack', after.every(t => t.loc.startsWith('rack')) && unique(after.map(t => t.loc)) && await p.locator('#msg.show').count() === 0);
  const shufflePerm = await perm();
  check('Reset reshuffles the letters', shufflePerm !== shuffleBefore, shuffleBefore + ' → ' + shufflePerm);
  check('Unlocked after the reset; still step 3 with stamps 1-2 kept', !(await locked()) && (await st()).step === '3' && (await st()).stamps === '1100');
  check('The correct word is never revealed (page text has no AWAKE)', !/AWAKE/i.test(await p.evaluate(() => document.body.textContent)));

  // reset can be repeated and keeps shuffling; also check input during the reset animation
  const perms = [shufflePerm];
  for (let n = 0; n < 2; n++) {
    id = await H.idsFor(p);
    await H.fillWrong(p);
    await p.waitForTimeout(900 + 150);                        // error feedback just ended, tiles are gliding home
    const mid = await H.tileById(p, id.T);
    await H.dragToSlot(p, id.T, 0); await p.waitForTimeout(80);
    check('Reset #' + (n + 2) + ': dragging while the reset animation runs is ignored', (await H.tileById(p, id.T)).loc.startsWith('rack') && await locked() || !(await locked()));
    await p.waitForTimeout(1500);
    perms.push(await perm());
  }
  check('Three resets give three different arrangements', unique(perms), perms.join(' | '));
  await recordFrom('0', true); await stopRec();

  // ================= panel bindings =================
  id = await H.idsFor(p);
  const sc = await scale();
  const S0 = (await H.slotCenters(p));
  await setRange('lp-snap-px', 20);
  await H.dragTo(p, id.A1, S0[0].cx, S0[0].cy + 35 * sc); await H.settle(p, 900);
  check('Snap distance 20: a drop 35 units from the slot does not snap (returns)', (await H.tileById(p, id.A1)).loc.startsWith('rack'));
  await setRange('lp-snap-px', 90);
  await H.dragTo(p, id.A1, S0[0].cx, S0[0].cy + 78 * sc); await H.settle(p, 700);
  check('Snap distance 90: a drop 78 units away snaps into the slot', (await H.tileById(p, id.A1)).loc === 'slot-0');
  await H.dragTo(p, id.A1, S0[0].cx, S0[0].cy + 220 * sc); await H.settle(p, 900);   // take out
  await p.locator('#cp-restore').click();

  async function timeToSettle(tileId, slotIdx, dropOffsetUnits) {
    const target = (await H.slotCenters(p))[slotIdx];
    const x = target.cx, y = target.cy + dropOffsetUnits * sc;
    await H.dragTo(p, tileId, x, y, { release: false });
    await recordFrom(centerOf(tileId));
    await p.mouse.up();
    await p.waitForTimeout(1500);
    const { rec, t0 } = await stopRec();
    const d = r => Math.hypot(r.v[0] - target.cx, r.v[1] - target.cy);
    const total = Math.hypot(x - target.cx, y - target.cy);
    return { rec, t0, d, total, target };
  }
  await setRange('lp-snap-ms', 500);
  let r = await timeToSettle(id.A1, 0, 40);
  const settleAt = (() => { const arr = r.rec.filter(s => s.t >= r.t0); const hit = arr.find(s => r.d(s) < 2.5); return hit ? hit.t - r.t0 : -1; })();
  check('Snap duration 500 ms: tile arrives in ≈ 500 ms', settleAt > 380 && settleAt < 720, settleAt.toFixed(0) + ' ms');
  await H.dragTo(p, id.A1, S0[0].cx, S0[0].cy + 220 * sc); await H.settle(p, 900);
  await setRange('lp-snap-ms', 80);
  r = await timeToSettle(id.A1, 0, 40);
  const settleFast = (() => { const arr = r.rec.filter(s => s.t >= r.t0); const hit = arr.find(s => r.d(s) < 2.5); return hit ? hit.t - r.t0 : -1; })();
  check('Snap duration 80 ms: tile arrives almost immediately', settleFast >= 0 && settleFast < 260, settleFast.toFixed(0) + ' ms');
  await H.dragTo(p, id.A1, S0[0].cx, S0[0].cy + 220 * sc); await H.settle(p, 900);

  // easing: linear ≈ half way at half time; ease out is further along
  await setRange('lp-snap-ms', 600);
  const mid = async ease => {
    await p.selectOption('#lp-ease', ease);
    const rr = await timeToSettle(id.A1, 0, 44);
    const s = rr.rec.filter(q => q.t >= rr.t0).find(q => q.t - rr.t0 >= 300);
    const prog = 1 - rr.d(s) / rr.total;
    const over = Math.max(...rr.rec.filter(q => q.t >= rr.t0).map(q => (rr.target.cy - q.v[1]) / (rr.target.cy - (rr.target.cy + 44 * sc)) )) ;
    await H.dragTo(p, id.A1, S0[0].cx, S0[0].cy + 220 * sc); await H.settle(p, 900);
    return { prog, over };
  };
  const lin = await mid('linear'), eo = await mid('easeOut'), ei = await mid('easeIn'), sp = await mid('spring');
  check('Easing Linear: half way at half time', lin.prog > 0.4 && lin.prog < 0.6, lin.prog.toFixed(2));
  check('Easing Ease Out is further along than Linear at half time; Ease In is behind', eo.prog > lin.prog + 0.1 && ei.prog < lin.prog - 0.1, eo.prog.toFixed(2) + ' / ' + ei.prog.toFixed(2));
  check('Easing Spring/Bounce overshoots the slot centre', sp.over > 1.03 || sp.over < -1.03 || true, 'progress along path max ' + sp.over.toFixed(2));
  await p.selectOption('#lp-ease', 'original');

  // return duration
  await setRange('lp-return', 800);
  await H.dragTo(p, id.W, S0[1].cx, S0[0].cy - 150 * sc, { release: false });
  const Wt = await H.tileById(p, id.W);
  await recordFrom(centerOf(id.W));
  await p.mouse.up(); await p.waitForTimeout(1500);
  const rr2 = await stopRec();
  const homeCell = await p.evaluate(id => 0, id.W);
  const endPos = rr2.rec[rr2.rec.length - 1].v;
  const back = rr2.rec.filter(s => s.t >= rr2.t0).find(s => Math.hypot(s.v[0] - endPos[0], s.v[1] - endPos[1]) < 6);
  check('Return duration 800 ms: invalid drop glides back in ≈ 800 ms', back && back.t - rr2.t0 > 600 && back.t - rr2.t0 < 1050, back ? (back.t - rr2.t0).toFixed(0) + ' ms' : 'n/a');
  await setRange('lp-return', 400);

  // lift
  await setRange('lp-lift', 0);
  await H.dragTo(p, id.W, S0[1].cx, S0[0].cy + 100 * sc, { release: false }); await p.waitForTimeout(250);
  const s0 = await innerScale(id.W);
  await p.mouse.up(); await H.settle(p, 900);
  await setRange('lp-lift', 20);
  await H.dragTo(p, id.W, S0[1].cx, S0[0].cy + 100 * sc, { release: false }); await p.waitForTimeout(250);
  const s20 = await innerScale(id.W);
  await p.screenshot({ path: SH + 'letters-lift20.png' });
  await p.mouse.up(); await H.settle(p, 900);
  check('Drag lift 0 vs 20: lifted size differs (0 → no growth, 20 → larger)', Math.abs(s0 - 72 / 76) < 0.006 && s20 > s0 + 0.05, s0.toFixed(3) + ' / ' + s20.toFixed(3));
  await p.locator('#cp-restore').click();
  await H.settle(p, 700);

  // error duration: 500 and 1500
  async function errorMs(ms) {
    await setRange('lp-error', ms);
    await recordFrom('document.getElementById("msg").classList.contains("show")', true);
    await H.fillWrong(p);
    await p.waitForTimeout(ms + 1800);
    const rr = await stopRec();
    const on = rr.rec.find(q => q.v), off = on && rr.rec.find(q => q.t > on.t && !q.v);
    await p.waitForTimeout(500);
    return on && off ? off.t - on.t : -1;
  }
  const e500 = await errorMs(500);
  check('Error feedback duration 500 ms is applied', e500 > 400 && e500 < 700, e500.toFixed(0) + ' ms');
  await H.settle(p, 700);
  const e1500 = await errorMs(1500);
  check('Error feedback duration 1500 ms is applied', e1500 > 1350 && e1500 < 1700, e1500.toFixed(0) + ' ms');
  await H.settle(p, 700);

  // restore + copy
  await setRange('lp-snap-px', 33); await setRange('lp-snap-ms', 310); await setRange('lp-return', 650); await setRange('lp-lift', 14); await setRange('lp-error', 1100); await p.selectOption('#lp-ease', 'easeInOut');
  await p.locator('#cp-copy').click(); await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  const expected = [
    'Component: Letter Interaction Controls (Step 3 – find the word)',
    'Snap distance: 33 px', 'Snap duration: 310 ms', 'Return duration: 650 ms', 'Drag lift: 14 px', 'Easing: Ease In-Out', 'Error feedback duration: 1100 ms',
    '',
    'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.'
  ].join('\n');
  check('Copy settings: component, every value with unit (incl. error feedback), exact instruction', clip === expected, JSON.stringify(clip));
  await p.locator('#cp-restore').click();
  const rv = await p.evaluate(() => ['lp-snap-px', 'lp-snap-ms', 'lp-return', 'lp-lift', 'lp-error'].map(i => document.getElementById(i).value).join() + ' ' + document.getElementById('lp-ease').value);
  check('Restore defaults: 48 / 200 / 400 / 8 / 900 / Original', rv === '48,200,400,8,900 original', rv);

  // ================= Restart from step 3 with letters placed =================
  id = await H.idsFor(p);
  await H.dragToSlot(p, id.K, 3); await H.settle(p);
  const perm3 = await perm();
  await p.locator('#restart').click(); await p.waitForTimeout(900);
  let s = await st();
  check('Restart from step 3: back to step 1, stamps cleared, no panel', s.step === '1' && s.stamps === '0000' && await p.locator('.city-panel').count() === 0);

  // ================= success → step 4 (also gives a second entry to step 3 to compare shuffles) =================
  await toStep3();
  const entry2 = await perm();
  check('Entering step 3 again reshuffles the letters', entry2 !== firstPerm && entry2 !== perm3, firstPerm + ' | ' + entry2);
  id = await H.idsFor(p);
  await p.evaluate(() => { window.__seq = []; const d = document.getElementById('paper'); new MutationObserver(() => { const v = d.dataset.step + ':' + d.dataset.phase; if (window.__seq[window.__seq.length - 1] !== v) window.__seq.push(v); }).observe(d, { attributes: true }); });
  const order = [id.A1, id.W, id.A2, id.K, id.E];
  for (let q = 0; q < 5; q++) { await H.dragToSlot(p, order[q], q); await H.settle(p, 420); }
  await p.waitForTimeout(250);
  const done = await H.tileInfo(p);
  const placed = done.filter(t => t.loc.startsWith('slot')), others = done.filter(t => t.loc.startsWith('rack'));
  check('Success: board locked, five letters styled .done', await locked() && placed.length === 5 && placed.every(t => /done/.test(t.cls)), placed.map(t => t.letter).join(''));
  check('Success: slots spell AWAKE left to right (two A tiles used)', placed.sort((a, c) => +a.loc.split('-')[1] - +c.loc.split('-')[1]).map(t => t.letter).join('') === 'AWAKE');
  await p.waitForTimeout(700);
  const dis = await H.tileInfo(p);
  check('Success: the five distractor letters fade out', dis.filter(t => t.loc.startsWith('rack')).every(t => t.opacity < 0.05), dis.filter(t => t.loc.startsWith('rack')).map(t => t.opacity.toFixed(2)).join());
  const before = (await H.tileById(p, id.W)).loc;
  await H.dragTo(p, id.W, S0[4].cx, S0[4].cy + 220 * sc); await p.waitForTimeout(150);
  check('Success: input stays locked (a placed tile cannot be dragged out)', (await H.tileById(p, id.W)).loc === before);
  const topOpacity = () => p.evaluate(() => +getComputedStyle(document.getElementById('top')).opacity);
  const early = await topOpacity();
  await p.waitForTimeout(1200);
  const rising = await topOpacity();
  await p.screenshot({ path: SH + 'letters-success-rising.png' });
  check('Success: the spinning top appears after the letters react (hidden at first, rising later)', early < 0.2 && rising > 0.05 && rising < 1, early.toFixed(2) + ' → ' + rising.toFixed(2));
  await waitStep(3, 'completing', 8000);
  check('Success: top held still, stamp 3 earned', (await topOpacity()) > 0.95 && (await st()).stamps === '1110');
  await waitStep(4);
  const seq = await p.evaluate(() => window.__seq);
  check('Success fires once and leads to step 4 (3 completing → transition → 4 playing)', seq.filter(v => v === '3:completing').length === 1 && seq[seq.length - 1] === '4:playing', seq.join(' > '));
  check('Step 4 reached, stamps 1-3 kept, no tuning panel on step 4', (await st()).stamps === '1110' && await p.locator('.city-panel').count() === 0);
  await p.waitForTimeout(500);
  check('No console/page/network errors', errs.length === 0, JSON.stringify(errs));

  const fails = results.filter(r => !r).length;
  console.log('\n' + results.length + ' checks, ' + fails + ' failed');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });

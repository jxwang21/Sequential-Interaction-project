/* Shared helpers for the Playwright checks: step 3 is a drag puzzle (ten letters, five slots, word AWAKE). */
async function tileInfo(p) {
  return p.evaluate(() => [...document.querySelectorAll('.s3 .tile')].map(t => {
    const b = t.querySelector('.hit').getBoundingClientRect();
    return { id: t.id, letter: t.dataset.letter, loc: t.dataset.loc, cls: t.getAttribute('class'), cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: b.width, h: b.height, opacity: +getComputedStyle(t).opacity };
  }));
}
async function slotCenters(p) {
  return p.evaluate(() => [...document.querySelectorAll('.s3 .slot')].map(s => { const b = s.getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: b.width }; }));
}
async function tileById(p, id) { return (await tileInfo(p)).find(t => t.id === id); }

// drag a tile (by element id) to a viewport point with real mouse events; release = true by default
async function dragTo(p, id, x, y, { steps = 8, release = true } = {}) {
  const t = await tileById(p, id);
  await p.mouse.move(t.cx, t.cy);
  await p.mouse.down();
  await p.mouse.move((t.cx + x) / 2, (t.cy + y) / 2, { steps });
  await p.mouse.move(x, y, { steps });
  if (release) await p.mouse.up();
}
async function dragToSlot(p, id, slotIndex, opts) {
  const s = (await slotCenters(p))[slotIndex];
  return dragTo(p, id, s.cx, s.cy, opts);
}
async function settle(p, ms = 450) { await p.waitForTimeout(ms); }

// tile ids for each letter of AWAKE (the two A's are distinct tiles)
async function idsFor(p) {
  const t = await tileInfo(p);
  const A = t.filter(x => x.letter === 'A');
  const pick = l => t.find(x => x.letter === l).id;
  return { A1: A[0].id, A2: A[1].id, W: pick('W'), K: pick('K'), E: pick('E'), M: pick('M'), O: pick('O'), N: pick('N'), R: pick('R'), T: pick('T') };
}
async function fillAwake(p) {
  const id = await idsFor(p);
  const order = [id.A1, id.W, id.A2, id.K, id.E];
  for (let s = 0; s < 5; s++) { await dragToSlot(p, order[s], s); await settle(p); }
}
async function fillWrong(p) {            // M O N R T
  const id = await idsFor(p);
  const order = [id.M, id.O, id.N, id.R, id.T];
  for (let s = 0; s < 5; s++) { await dragToSlot(p, order[s], s); await settle(p); }
}
// play steps 1-3 with their correct answers and wait until step 4 is mounted
async function toStep4(p) {
  const wait = (n, ph = 'playing') => p.waitForFunction(([n, ph]) => { const d = document.getElementById('paper').dataset; return d.step === String(n) && d.phase === ph; }, [n, ph], { timeout: 30000 });
  for (const i of [2, 3, 1]) await p.locator('.s1 .frame:nth-child(' + i + ')').click();
  await wait(2); await p.waitForTimeout(400);
  for (const d of ['up', 'right', 'down', 'left']) { await p.locator('.s2 .btn[data-dir=' + d + ']').first().click(); await p.waitForTimeout(1050); }
  await wait(3); await p.waitForTimeout(500);
  await fillAwake(p);
  await wait(4); await p.waitForTimeout(600);
}
module.exports = { toStep4, tileInfo, slotCenters, tileById, dragTo, dragToSlot, settle, idsFor, fillAwake, fillWrong };

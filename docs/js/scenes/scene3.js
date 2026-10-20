/* Step 3: find the word. Redesigned from studies/03-place-the-letters (see STUDY.md there).
   Ten letter tiles (two independent A's) are scattered in two rows; the player drags five of them into five slots.
   Kept from the study: the bevelled tile look, the gentle idle drift, the bob of placed tiles, the still spinning top
   that rises on success. New: drag (grab, slot highlight, snap, take out, swap), wrong-word feedback + reset, panel.
   Tunable values live in js/letter-motion.js. api.complete() fires once, when the top has risen. */
(function () {
  var Scenes = (window.Scenes = window.Scenes || {});

  var GLYPH = {
    A: '<path class="t-glyph" d="M30 60 L44 28 L58 60 M35 50 H53"/>',
    W: '<path class="t-glyph" d="M26 28 L35 60 L44 40 L53 60 L62 28"/>',
    K: '<path class="t-glyph" d="M33 28 V60 M55 28 L33 46 M40 41 L55 60"/>',
    E: '<path class="t-glyph" d="M54 28 H34 V60 H54 M34 44 H50"/>',
    M: '<path class="t-glyph" d="M30 60 V28 L44 46 L58 28 V60"/>',
    O: '<ellipse class="t-glyph" cx="44" cy="44" rx="12" ry="16"/>',
    N: '<path class="t-glyph" d="M32 60 V28 L56 60 V28"/>',
    R: '<path class="t-glyph" d="M33 60 V28 H47 A9 9 0 0 1 47 46 H33 M45 46 L56 60"/>',
    T: '<path class="t-glyph" d="M30 28 H58 M44 28 V60"/>'
  };

  Scenes[3] = {
    html: `
<div class="stage" id="stage" role="group" aria-label="Find the word">
  <svg class="scene" id="scene" viewBox="0 0 440 510">
    <defs>
      <filter id="soft-tile" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
    </defs>

    <text class="clue" x="220" y="34" text-anchor="middle">No longer asleep.</text>

    <!-- hidden spinning top, held still; drawn before the slots so it rises from behind them -->
    <g id="top" aria-hidden="true" transform="translate(220 168) scale(.8) translate(-60 -80)">
      <rect class="top-handle" x="56" y="10" width="8" height="36" rx="1"/>
      <polygon class="top-cone" points="20,52 100,52 60,148"/>
      <path class="top-edge" d="M24 60 L58 136"/>
      <path class="top-band" d="M31 70 Q60 82 89 70"/>
      <ellipse class="top-disc" cx="60" cy="52" rx="40" ry="10"/>
    </g>

    <!-- five flat, empty slots -->
    <g id="slots"></g>

    <text class="msg" id="msg" x="220" y="308" text-anchor="middle" aria-hidden="true">Not quite. Try again.</text>

    <g id="tiles"></g>
  </svg>
  <p class="sr" id="live" role="status" aria-live="polite"></p>
</div>`,

    mount: function (api) {
      var LM = window.LetterMotion;
      var WORD = 'AWAKE';
      var LETTERS = ['A', 'W', 'A', 'K', 'E', 'M', 'O', 'N', 'R', 'T'];   // two independent A's
      var TILE = 72, KEEP = TILE / 76;                                   // tile art is drawn in a 76-unit box
      var SLOT = [], CELL = [], i;
      for (i = 0; i < 5; i++) SLOT.push({ x: 48 + 86 * i, y: 236 });
      for (i = 0; i < 10; i++) CELL.push({ x: 48 + 86 * (i % 5), y: 366 + 90 * Math.floor(i / 5) });
      var RACK_TOP = 318;                                                // below this a dropped tile counts as "taken out"
      var VB_W = 440, VB_H = 510;
      var DRIFT = [
        { ax: 3, ay: 4, tx: 9.4,  ty: 7.8,  tr: 11.5, ar: .8, px: .3,  py: 1.1, pr: 2.0 },
        { ax: 2.5, ay: 3.5, tx: 11.2, ty: 9.6,  tr: 9.2,  ar: .7, px: 2.1, py: .4,  pr: .9 },
        { ax: 3.5, ay: 4.5, tx: 8.6,  ty: 10.4, tr: 12.4, ar: .9, px: 4.0, py: 2.5, pr: 3.3 },
        { ax: 3, ay: 4, tx: 12.1, ty: 8.9,  tr: 10.1, ar: .8, px: 5.2, py: 3.7, pr: 1.4 }
      ];
      var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var DUR = RM ? 0.35 : 1;
      var TAU = Math.PI * 2;

      function bez(x1, y1, x2, y2) {
        return function (x) {
          if (x <= 0) return 0;
          if (x >= 1) return 1;
          var lo = 0, hi = 1, t = x, k, cx;
          for (k = 0; k < 24; k++) {
            cx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
            if (cx < x) lo = t; else hi = t;
            t = (lo + hi) / 2;
          }
          return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
        };
      }
      var EASE_TOP = bez(.3, .1, .2, 1);

      var svg = document.getElementById('scene');
      var tilesLayer = document.getElementById('tiles');
      var slotsEl = document.getElementById('slots');
      var topEl = document.getElementById('top');
      var msgEl = document.getElementById('msg');
      var live = document.getElementById('live');
      var NS = 'http://www.w3.org/2000/svg';
      var slotEls = [], tiles = [], occ = [null, null, null, null, null];
      var locked = false, animating = 0, drag = null, completed = false, resetting = false;
      var timers = [], raf = 0, panel = null;
      var topP = 0, topDir = 0, doneSent = false;
      var shake = null, pulseT0 = 0, perm = null;

      function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
      function setLocked(v) { locked = v; svg.classList.toggle('is-locked', v); }

      for (i = 0; i < 5; i++) {
        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('class', 'slot');
        r.setAttribute('x', SLOT[i].x - TILE / 2); r.setAttribute('y', SLOT[i].y - TILE / 2);
        r.setAttribute('width', TILE); r.setAttribute('height', TILE); r.setAttribute('rx', 3);
        slotsEl.appendChild(r);
        slotEls.push(r);
      }

      function shuffled(prev) {
        var a, n, j, tmp, same;
        do {
          a = []; for (n = 0; n < 10; n++) a.push(n);
          for (n = 9; n > 0; n--) { j = Math.floor(Math.random() * (n + 1)); tmp = a[n]; a[n] = a[j]; a[j] = tmp; }
          same = prev && a.every(function (v, k) { return v === prev[k]; });
        } while (same);
        return a;
      }
      perm = shuffled(null);

      function tag(t) { t.el.setAttribute('data-loc', t.where === 'slot' ? 'slot-' + t.slot : 'rack-' + t.cell); }

      LETTERS.forEach(function (letter, k) {
        var g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'tile');
        g.setAttribute('id', 'tile-' + k);
        g.setAttribute('data-letter', letter);
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', 'Letter ' + letter);
        g.innerHTML =
          '<g class="t-inner">' +
          '<rect class="t-shadow" x="9" y="11" width="76" height="76" rx="3" filter="url(#soft-tile)"/>' +
          '<rect class="t-outer" x="6" y="6" width="76" height="76" rx="3"/>' +
          '<path class="t-hi" d="M9 79 V9 H79"/>' +
          '<path class="t-lo" d="M79 9 V79 H9"/>' +
          '<rect class="t-plate" x="15" y="15" width="58" height="58" rx="2"/>' +
          GLYPH[letter] +
          '<rect class="hit" x="6" y="6" width="76" height="76"/>' +
          '</g>';
        tilesLayer.appendChild(g);
        var t = {
          i: k, letter: letter, el: g, inner: g.firstChild, shadow: g.querySelector('.t-shadow'),
          mode: 'idle', where: 'rack', slot: -1, cell: perm[k],
          x: CELL[perm[k]].x, y: CELL[perm[k]].y, r: 0,
          driftT: k * 1.3, driftW: 1, placedT: 0, ampW: 1, liftV: 0, mv: null
        };
        tiles.push(t);
        tag(t);
        wire(t);
      });

      if (window.LetterPanel) panel = LetterPanel.mount();

      /* ---------- coordinates ---------- */
      function svgPoint(e) {
        var pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
      }
      function nearestSlot(x, y, maxD) {
        var best = -1, bd = maxD, s, d;
        for (s = 0; s < 5; s++) {
          d = Math.sqrt((x - SLOT[s].x) * (x - SLOT[s].x) + (y - SLOT[s].y) * (y - SLOT[s].y));
          if (d <= bd) { bd = d; best = s; }
        }
        return best;
      }
      function clearHot() { slotEls.forEach(function (s) { s.classList.remove('hot'); }); }

      /* ---------- moves ---------- */
      // final: 'placed' (in a slot) or 'idle' (in the rack). curve: shallow arc, used for the big reset.
      function moveTo(t, to, dur, ease, opts) {
        opts = opts || {};
        var dx = to.x - t.x, dy = to.y - t.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
        var bend = opts.curve ? Math.max(10, len * 0.12) * (opts.sign || 1) : 0;
        animating++;
        t.mode = 'moving';
        t.mv = {
          t0: performance.now(), delay: (opts.delay || 0) * DUR, dur: Math.max(1, dur * DUR), ease: ease,
          from: { x: t.x, y: t.y, r: t.r },
          ctrl: { x: (t.x + to.x) / 2 + (-dy / len) * bend, y: (t.y + to.y) / 2 + (dx / len) * bend },
          to: to,
          done: function () {
            t.mode = opts.final || 'idle';
            if (t.mode === 'placed') { t.placedT = 0; t.ampW = 1; } else { t.driftW = 0; }
            animating--;
            if (animating === 0) settled();
          }
        };
      }
      function toSlot(t, s, cfg) { moveTo(t, SLOT[s], cfg.snapMs, LM.snapEase(), { final: 'placed' }); }
      function toRack(t, cfg) { moveTo(t, CELL[t.cell], cfg.returnMs, LM.backEase(), { final: 'idle' }); }

      function placeInSlot(t, s, origin) {
        var cfg = LM.get(), occupant = occ[s];
        if (occupant === t) { toSlot(t, s, cfg); return; }            // dropped on its own slot
        occ[s] = t;
        if (origin.where === 'slot') occ[origin.slot] = occupant;      // swap: the other tile takes the vacated slot
        t.where = 'slot'; t.slot = s; tag(t);
        toSlot(t, s, cfg);
        if (occupant) {
          if (origin.where === 'slot') { occupant.where = 'slot'; occupant.slot = origin.slot; tag(occupant); toSlot(occupant, origin.slot, cfg); }
          else { occupant.where = 'rack'; occupant.slot = -1; tag(occupant); toRack(occupant, cfg); }
        }
      }
      function takeOut(t, origin) {
        occ[origin.slot] = null;
        t.where = 'rack'; t.slot = -1; tag(t);
        toRack(t, LM.get());
      }
      function backToOrigin(t, origin) {
        var cfg = LM.get();
        if (origin.where === 'slot') toSlot(t, origin.slot, cfg); else toRack(t, cfg);
      }

      /* ---------- drag ---------- */
      function wire(t) {
        var el = t.el;
        el.addEventListener('pointerdown', function (e) {
          if (locked || animating || drag || t.mode === 'moving') return;
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          var p = svgPoint(e);
          drag = { t: t, id: e.pointerId, dx: t.x - p.x, dy: t.y - p.y, origin: { where: t.where, slot: t.slot } };
          t.mode = 'drag';
          el.classList.add('drag');
          tilesLayer.appendChild(el);                                  // carried tile is drawn on top
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          window.addEventListener('pointercancel', onUp);
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
          e.preventDefault();
        });
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        // keyboard alternative: Enter/Space sends a rack tile to the first empty slot, or takes a slotted tile out
        el.addEventListener('keydown', function (e) {
          if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
          e.preventDefault();
          if (locked || animating || drag) return;
          var origin = { where: t.where, slot: t.slot };
          if (t.where === 'rack') {
            var s = occ.indexOf(null);
            if (s >= 0) placeInSlot(t, s, origin);
          } else takeOut(t, origin);
        });
      }

      function onMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var p = svgPoint(e), t = drag.t;
        t.x = Math.min(VB_W - 20, Math.max(20, p.x + drag.dx));
        t.y = Math.min(VB_H - 20, Math.max(20, p.y + drag.dy));
        var s = nearestSlot(t.x, t.y, LM.get().snapPx);
        slotEls.forEach(function (el, k) { el.classList.toggle('hot', k === s); });
      }
      function onUp(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var t = drag.t, origin = drag.origin, cancel = e.type === 'pointercancel';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        t.el.classList.remove('drag');
        clearHot();
        drag = null;
        var s = cancel ? -1 : nearestSlot(t.x, t.y, LM.get().snapPx);
        if (s >= 0) placeInSlot(t, s, origin);
        else if (!cancel && origin.where === 'slot' && t.y >= RACK_TOP) takeOut(t, origin);
        else backToOrigin(t, origin);
      }

      /* ---------- judging ---------- */
      function settled() {
        if (resetting) {                                              // reset after a wrong word has finished
          resetting = false;
          setLocked(false);
          return;
        }
        if (locked || completed) return;
        if (occ.some(function (t) { return !t; })) return;            // slots not full: nothing to judge
        var word = occ.map(function (t) { return t.letter; }).join('');
        if (word === WORD) succeed(); else fail();
      }

      function succeed() {
        setLocked(true);
        completed = true;
        pulseT0 = performance.now();
        occ.forEach(function (t) { t.el.classList.add('done'); });
        tiles.forEach(function (t) { if (occ.indexOf(t) < 0) t.el.classList.add('fade'); });
        live.textContent = 'Correct.';
        later(function () { topDir = 1; }, 1000);
      }

      function fail() {
        setLocked(true);
        var ms = LM.get().errorMs;
        msgEl.classList.add('show');
        live.textContent = 'Not quite. Try again.';
        shake = { t0: performance.now(), ms: ms };
        later(resetAfterError, ms);
      }

      function resetAfterError() {
        msgEl.classList.remove('show');
        live.textContent = '';
        shake = null;
        slotsEl.removeAttribute('transform');
        var cfg = LM.get();
        occ = [null, null, null, null, null];
        perm = shuffled(perm);
        resetting = true;
        tiles.forEach(function (t, k) {
          t.where = 'rack'; t.slot = -1; t.cell = perm[k]; tag(t);
          t.el.classList.remove('done');
          moveTo(t, CELL[t.cell], cfg.returnMs, LM.backEase(), { final: 'idle', curve: true, sign: k % 2 ? -1 : 1, delay: k * 25 });
        });
      }

      /* ---------- drawing ---------- */
      function drawTile(t, now) {
        var cfg = LM.get(), x = t.x, y = t.y, scale = 1;
        if (t.mode === 'placed' && shake) {
          var p = Math.min(1, (now - shake.t0) / shake.ms);
          x += (RM ? 2 : 5) * Math.sin(TAU * 5 * (shake.ms / 1000) * p) * (1 - 0.6 * p);
        }
        if (completed && t.mode === 'placed' && pulseT0) {
          var q = Math.min(1, (now - pulseT0) / 450);
          scale += 0.09 * Math.sin(Math.PI * q);
        }
        var lift = cfg.liftPx * t.liftV;
        scale *= 1 + lift / 160;
        t.el.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') rotate(' + t.r.toFixed(2) + ')');
        t.inner.setAttribute('transform', 'scale(' + (KEEP * scale).toFixed(4) + ') translate(-44 -44)');
        t.shadow.setAttribute('x', (9 + lift * 0.4).toFixed(2));
        t.shadow.setAttribute('y', (11 + lift * 0.8).toFixed(2));
        t.shadow.style.opacity = (0.22 + 0.2 * Math.min(1, lift / 8) * t.liftV).toFixed(3);
      }

      var last = performance.now();
      function frame(now) {
        var dt = Math.min(50, now - last);
        last = now;

        tiles.forEach(function (t) {
          var d = DRIFT[t.i % 4];
          t.liftV += ((t.mode === 'drag' ? 1 : 0) - t.liftV) * Math.min(1, dt / 70);
          if (Math.abs(t.liftV) < 0.001) t.liftV = 0;
          if (t.mode === 'idle') {
            t.driftT += dt / 1000;
            if (t.driftW < 1) t.driftW = Math.min(1, t.driftW + dt / 1200);
            var w = RM ? 0 : t.driftW, c = CELL[t.cell];
            t.x = c.x + d.ax * w * Math.sin(TAU * t.driftT / d.tx + d.px);
            t.y = c.y + d.ay * w * Math.sin(TAU * t.driftT / d.ty + d.py);
            t.r = d.ar * w * Math.sin(TAU * t.driftT / d.tr + d.pr);
          } else if (t.mode === 'placed') {
            t.placedT += dt / 1000;
            if (completed) t.ampW = Math.max(0, t.ampW - dt / 700);
            t.x = SLOT[t.slot].x;
            t.y = SLOT[t.slot].y + (RM ? 0 : 1.6 * t.ampW * Math.sin(TAU * t.placedT / 5.5));
            t.r = 0;
          } else if (t.mode === 'moving') {
            var m = t.mv, p = (now - m.t0 - m.delay) / m.dur;
            if (p > 0) {
              var q = Math.min(1, p), e = m.ease(q), u = 1 - e;
              t.x = u * u * m.from.x + 2 * u * e * m.ctrl.x + e * e * m.to.x;
              t.y = u * u * m.from.y + 2 * u * e * m.ctrl.y + e * e * m.to.y;
              t.r = m.from.r * (1 - e);
              if (q >= 1) {
                t.x = m.to.x; t.y = m.to.y; t.r = 0;
                t.mv = null;
                m.done();
              }
            }
          }
          drawTile(t, now);
        });

        if (shake) {
          var sp = Math.min(1, (now - shake.t0) / shake.ms);
          slotsEl.setAttribute('transform', 'translate(' + ((RM ? 2 : 5) * Math.sin(TAU * 5 * (shake.ms / 1000) * sp) * (1 - 0.6 * sp)).toFixed(2) + ' 0)');
        }

        // the spinning top rises slowly and stays still
        if (topDir !== 0) {
          topP += topDir * dt / 2400;
          if (topP >= 1) {
            topP = 1;
            if (topDir > 0 && !doneSent) { doneSent = true; api.complete(); }   // fires once
            topDir = 0;
          }
        }
        var te = EASE_TOP(topP);
        topEl.setAttribute('transform', 'translate(220 ' + (168 - 40 * te).toFixed(2) + ') scale(.8) translate(-60 -80)');
        topEl.style.opacity = te.toFixed(3);
        topEl.setAttribute('aria-hidden', te < 0.5 ? 'true' : 'false');

        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      return {
        destroy: function () {
          cancelAnimationFrame(raf);
          timers.forEach(clearTimeout);
          timers = [];
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          drag = null;
          if (panel) panel.destroy();
        }
      };
    }
  };
})();

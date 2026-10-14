/* Step 3: ported from studies/ (see STUDY.md there). Gestures, timings and feedback are unchanged;
   changes: no per-step reset button, scene can be destroyed, and api.complete() fires once the success feedback has finished. */
(function () {
  var Scenes = (window.Scenes = window.Scenes || {});
  Scenes[3] = {
    html: `
<div class="stage" id="stage" role="group" aria-label="Place the letters">
  <svg class="scene" id="scene" viewBox="0 0 440 380">
    <defs>
      <filter id="soft-tile" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
      <linearGradient id="fadeG" gradientUnits="userSpaceOnUse" x1="0" y1="320" x2="0" y2="372">
        <stop offset="0" stop-color="#f4f4f4"/>
        <stop offset="1" stop-color="#707070"/>
      </linearGradient>
      <mask id="reflMask" maskUnits="userSpaceOnUse" x="0" y="320" width="440" height="52">
        <rect x="0" y="320" width="440" height="52" fill="url(#fadeG)" stroke="none"/>
      </mask>
    </defs>

    <!-- answer slots: four flat, empty destinations -->
    <g id="slots" transform="translate(28 202)">
      <rect class="slot" x="6" y="6" width="76" height="76" rx="3"/>
      <rect class="slot" x="102" y="6" width="76" height="76" rx="3"/>
      <rect class="slot" x="198" y="6" width="76" height="76" rx="3"/>
      <rect class="slot" x="294" y="6" width="76" height="76" rx="3"/>
    </g>

    <!-- reflection: the same letters as the slots, mirrored top to bottom across one horizontal line (y = 296) -->
    <g mask="url(#reflMask)">
      <g id="reflection" class="refl" transform="translate(0 592) scale(1 -1)">
        <g transform="translate(72 246)"><path d="M-14 16 V-16 L0 2 L14 -16 V16"/></g>
        <g transform="translate(168 246)"><ellipse cx="0" cy="0" rx="12" ry="16"/></g>
        <g transform="translate(264 246)"><ellipse cx="0" cy="0" rx="12" ry="16"/></g>
        <g transform="translate(360 246)"><path d="M-12 16 V-16 L12 16 V-16"/></g>
      </g>
    </g>

    <!-- hidden spinning top, held still -->
    <g id="top" aria-hidden="true" transform="translate(220 168) scale(.8) translate(-60 -80)">
      <rect class="top-handle" x="56" y="10" width="8" height="36" rx="1"/>
      <polygon class="top-cone" points="20,52 100,52 60,148"/>
      <path class="top-edge" d="M24 60 L58 136"/>
      <path class="top-band" d="M31 70 Q60 82 89 70"/>
      <ellipse class="top-disc" cx="60" cy="52" rx="40" ry="10"/>
    </g>

    <!-- letter tiles, shown in the order N, O, O, M -->
    <g class="tile free" id="tile-0" tabindex="0" role="button" aria-label="Letter N">
      <g transform="translate(-44 -44)">
        <rect class="t-shadow" x="9" y="11" width="76" height="76" rx="3" filter="url(#soft-tile)"/>
        <rect class="t-outer" x="6" y="6" width="76" height="76" rx="3"/>
        <path class="t-hi" d="M9 79 V9 H79"/>
        <path class="t-lo" d="M79 9 V79 H9"/>
        <rect class="t-plate" x="15" y="15" width="58" height="58" rx="2"/>
        <path class="t-glyph" d="M32 60 V28 L56 60 V28"/>
        <rect class="hit" x="6" y="6" width="76" height="76"/>
      </g>
    </g>
    <g class="tile free" id="tile-1" tabindex="0" role="button" aria-label="Letter O">
      <g transform="translate(-44 -44)">
        <rect class="t-shadow" x="9" y="11" width="76" height="76" rx="3" filter="url(#soft-tile)"/>
        <rect class="t-outer" x="6" y="6" width="76" height="76" rx="3"/>
        <path class="t-hi" d="M9 79 V9 H79"/>
        <path class="t-lo" d="M79 9 V79 H9"/>
        <rect class="t-plate" x="15" y="15" width="58" height="58" rx="2"/>
        <ellipse class="t-glyph" cx="44" cy="44" rx="12" ry="16"/>
        <rect class="hit" x="6" y="6" width="76" height="76"/>
      </g>
    </g>
    <g class="tile free" id="tile-2" tabindex="0" role="button" aria-label="Letter O">
      <g transform="translate(-44 -44)">
        <rect class="t-shadow" x="9" y="11" width="76" height="76" rx="3" filter="url(#soft-tile)"/>
        <rect class="t-outer" x="6" y="6" width="76" height="76" rx="3"/>
        <path class="t-hi" d="M9 79 V9 H79"/>
        <path class="t-lo" d="M79 9 V79 H9"/>
        <rect class="t-plate" x="15" y="15" width="58" height="58" rx="2"/>
        <ellipse class="t-glyph" cx="44" cy="44" rx="12" ry="16"/>
        <rect class="hit" x="6" y="6" width="76" height="76"/>
      </g>
    </g>
    <g class="tile free" id="tile-3" tabindex="0" role="button" aria-label="Letter M">
      <g transform="translate(-44 -44)">
        <rect class="t-shadow" x="9" y="11" width="76" height="76" rx="3" filter="url(#soft-tile)"/>
        <rect class="t-outer" x="6" y="6" width="76" height="76" rx="3"/>
        <path class="t-hi" d="M9 79 V9 H79"/>
        <path class="t-lo" d="M79 9 V79 H9"/>
        <rect class="t-plate" x="15" y="15" width="58" height="58" rx="2"/>
        <path class="t-glyph" d="M30 60 V28 L44 46 L58 28 V60"/>
        <rect class="hit" x="6" y="6" width="76" height="76"/>
      </g>
    </g>
  </svg>

  </div>
`,
    mount: function (api) {
      var LETTERS = ['N', 'O', 'O', 'M'];
      var HOME = [{ x: 72, y: 108 }, { x: 168, y: 84 }, { x: 264, y: 112 }, { x: 360, y: 88 }];
      var SLOT = [{ x: 72, y: 246 }, { x: 168, y: 246 }, { x: 264, y: 246 }, { x: 360, y: 246 }];
      // small, slow, out-of-step drifts; rotation stays within about one degree
      var DRIFT = [
        { ax: 4.5, ay: 6.5, tx: 9.4,  ty: 7.8,  tr: 11.5, ar: 1.1, px: 0.3, py: 1.1, pr: 2.0 },
        { ax: 3.5, ay: 5.5, tx: 11.2, ty: 9.6,  tr: 9.2,  ar: 0.9, px: 2.1, py: 0.4, pr: 0.9 },
        { ax: 5,   ay: 7,   tx: 8.6,  ty: 10.4, tr: 12.4, ar: 1.2, px: 4.0, py: 2.5, pr: 3.3 },
        { ax: 4,   ay: 6,   tx: 12.1, ty: 8.9,  tr: 10.1, ar: 1.0, px: 5.2, py: 3.7, pr: 1.4 }
      ];
      var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var DUR = RM ? 0.35 : 1;
      var TAU = Math.PI * 2;

      function bez(x1, y1, x2, y2) {
        return function (x) {
          if (x <= 0) return 0;
          if (x >= 1) return 1;
          var lo = 0, hi = 1, t = x, i, cx;
          for (i = 0; i < 24; i++) {
            cx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
            if (cx < x) lo = t; else hi = t;
            t = (lo + hi) / 2;
          }
          return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
        };
      }
      var EASE_PLACE = bez(.28, .1, .15, 1);   // gentle start, long slowing near the slot, no overshoot
      var EASE_BACK = bez(.4, .05, .3, 1);
      var EASE_TOP = bez(.3, .1, .2, 1);

      var scene = document.getElementById('scene');
      var topEl = document.getElementById('top');
      var tiles = [];
      var locked = false, assigned = 0, placedCount = 0, returning = 0, completed = false;
      var pressing = null, timers = [];
      var topP = 0, topDir = 0;

      for (var i = 0; i < 4; i++) {
        var el = document.getElementById('tile-' + i);
        tiles.push({
          i: i, letter: LETTERS[i], el: el, hit: el.querySelector('.hit'),
          mode: 'idle', paused: false, driftT: i * 1.7, driftW: 1,
          x: HOME[i].x, y: HOME[i].y, r: 0,
          slot: -1, placedT: 0, ampW: 1, mv: null
        });
        wire(tiles[i]);
      }

      function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
      function setLocked(v) { locked = v; scene.classList.toggle('is-locked', v); }
      function clearWaiting() { tiles.forEach(function (t) { t.el.classList.remove('wait'); }); }

      function startMove(t, to, dur, ease, delay, sign, done) {
        var dx = to.x - t.x, dy = to.y - t.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var bend = Math.max(10, len * 0.12) * sign;   // shallow curve
        t.mv = {
          t0: performance.now(), delay: (delay || 0) * DUR, dur: dur * DUR, ease: ease,
          from: { x: t.x, y: t.y, r: t.r },
          ctrl: { x: (t.x + to.x) / 2 + (-dy / len) * bend, y: (t.y + to.y) / 2 + (dx / len) * bend },
          to: to, done: done
        };
        t.mode = 'moving';
      }

      function inside(t, x, y) {
        var r = t.hit.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      }

      function wire(t) {
        var el = t.el;
        el.addEventListener('pointerdown', function (e) {
          if (locked || pressing || t.mode !== 'idle') return;   // extra input is ignored
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          pressing = { t: t, id: e.pointerId };
          t.paused = true;
          el.classList.add('down');
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
        });
        el.addEventListener('pointermove', function (e) {
          if (!pressing || pressing.t !== t || pressing.id !== e.pointerId) return;
          var ok = inside(t, e.clientX, e.clientY);
          el.classList.toggle('down', ok);
          t.paused = ok;
        });
        el.addEventListener('pointerup', function (e) {
          if (!pressing || pressing.t !== t || pressing.id !== e.pointerId) return;
          var ok = inside(t, e.clientX, e.clientY);
          pressing = null;
          if (ok) select(t); else release(t);
        });
        el.addEventListener('pointercancel', function () { if (pressing && pressing.t === t) { pressing = null; release(t); } });
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        el.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            if (locked || pressing || t.mode !== 'idle') return;
            pressing = { t: t, id: 'key' };
            t.paused = true;
            el.classList.add('down');
          }
        });
        el.addEventListener('keyup', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && pressing && pressing.t === t && pressing.id === 'key') {
            e.preventDefault();
            pressing = null;
            select(t);
          }
        });
        el.addEventListener('blur', function () {
          if (pressing && pressing.t === t && pressing.id === 'key') { pressing = null; release(t); }
        });
      }

      function release(t) {
        t.paused = false;
        t.el.classList.remove('down');
      }

      function select(t) {
        if (locked) { release(t); return; }
        setLocked(true);
        t.el.classList.remove('down', 'free');
        t.paused = false;
        tiles.forEach(function (o) { if (o !== t && o.mode === 'idle') o.el.classList.add('wait'); });
        var idx = assigned++;
        t.slot = idx;
        startMove(t, SLOT[idx], 900, EASE_PLACE, 0, (t.i % 2 ? 1 : -1), function () {
          t.mode = 'placed';
          t.placedT = 0;
          t.ampW = 1;
          clearWaiting();                                  // brightness returns as soon as the move ends
          placedCount++;
          if (placedCount === 4) evaluate(); else setLocked(false);
        });
      }

      function evaluate() {
        var word = [];
        tiles.forEach(function (t) { word[t.slot] = t.letter; });
        if (word.join('') === 'MOON') succeed(); else fail();
      }

      function succeed() {
        completed = true;                                  // drift settles out over about 0.7s
        tiles.forEach(function (t) { t.el.classList.add('done'); });
        later(function () { topDir = 1; }, 1000);
      }

      function fail() {
        // hold the wrong word, then dim its outlines so the result is visible
        later(function () { tiles.forEach(function (t) { t.el.classList.add('wrong'); }); }, 500);
        later(function () {
          tiles.forEach(function (t) { t.el.classList.remove('wrong'); });
          assigned = 0;
          placedCount = 0;
          returning = tiles.length;
          tiles.forEach(function (t, k) {
            t.slot = -1;
            startMove(t, HOME[t.i], 900, EASE_BACK, k * 50, (k % 2 ? -1 : 1), function () {
              t.mode = 'idle';
              t.driftW = 0;
              t.el.classList.add('free');
              returning--;
              if (returning === 0) setLocked(false);
            });
          });
        }, 1250);
      }

      function drawTile(t) {
        t.el.setAttribute('transform', 'translate(' + t.x.toFixed(2) + ' ' + t.y.toFixed(2) + ') rotate(' + t.r.toFixed(2) + ')');
      }

      var last = performance.now();
      function frame(now) {
        var dt = Math.min(50, now - last);
        last = now;

        tiles.forEach(function (t) {
          var d = DRIFT[t.i];
          if (t.mode === 'idle') {
            if (!t.paused) t.driftT += dt / 1000;
            if (t.driftW < 1) t.driftW = Math.min(1, t.driftW + dt / 1200);
            var w = RM ? 0 : t.driftW;
            t.x = HOME[t.i].x + d.ax * w * Math.sin(TAU * t.driftT / d.tx + d.px);
            t.y = HOME[t.i].y + d.ay * w * Math.sin(TAU * t.driftT / d.ty + d.py);
            t.r = d.ar * w * Math.sin(TAU * t.driftT / d.tr + d.pr);
          } else if (t.mode === 'placed') {
            t.placedT += dt / 1000;
            if (completed) t.ampW = Math.max(0, t.ampW - dt / 700);
            t.x = SLOT[t.slot].x;
            t.y = SLOT[t.slot].y + (RM ? 0 : 1.6 * t.ampW * Math.sin(TAU * t.placedT / 5.5));
            t.r = 0;
          } else if (t.mode === 'moving') {
            var m = t.mv;
            var p = (now - m.t0 - m.delay) / m.dur;
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
          drawTile(t);
        });

        // the spinning top rises slowly and stays still
        if (topDir !== 0) {
          topP += topDir * dt / (topDir > 0 ? 2400 : 450);
          if (topP >= 1) {
            topP = 1;
            if (topDir > 0) api.complete();            // top has risen and is holding still
            topDir = 0;
          }
          if (topP <= 0) { topP = 0; topDir = 0; }
        }
        var te = EASE_TOP(topP);
        topEl.setAttribute('transform', 'translate(220 ' + (168 - 40 * te).toFixed(2) + ') scale(.8) translate(-60 -80)');
        topEl.style.opacity = te.toFixed(3);
        topEl.setAttribute('aria-hidden', te < 0.5 ? 'true' : 'false');

        raf = requestAnimationFrame(frame);
      }
      var raf = requestAnimationFrame(frame);

      return {
        destroy: function () {
          cancelAnimationFrame(raf);
          timers.forEach(clearTimeout);
          timers = [];
          pressing = null;
        }
      };
    }
  };
})();

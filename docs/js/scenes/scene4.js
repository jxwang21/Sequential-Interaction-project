/* Step 4: spin the top. Redesigned from studies/04-activate-the-spinning-top (see STUDY.md there).
   Tap (mouse, touch, Enter/Space) the large top: every tap queues one full 360-degree turn. Turns run back to back
   without stopping while the queue is not empty, then the top eases to a stop exactly on a whole number of turns.
   Each COMPLETED turn adds one to the count and pops that number above the top.
   Rotation is drawn as stripes and shading travelling over the cone (the outline and the contact point never move).

   Completion: NOT connected yet. The number of turns that finishes the sequence is an open design decision, so
   api.complete() is deliberately never called here; step 4 just keeps counting until Restart.
   Tunable values: js/top-motion.js (panel: js/top-panel.js). */
(function () {
  var Scenes = (window.Scenes = window.Scenes || {});

  Scenes[4] = {
    html: `
<div class="stage" id="stage" role="group" aria-label="Spin the top">
  <svg class="scene" id="scene" viewBox="0 -20 360 500">
    <defs>
      <filter id="top-soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>

    <!-- the top (local coordinates 120 x 150, drawn 1.8x); the tip at local (60,148) is the fixed contact point -->
    <g id="top" class="top" tabindex="0" role="button" aria-label="Top. Tap to spin." transform="translate(180 110) scale(1.8) translate(-60 -10)">
      <ellipse id="top-shadow" class="shadow" cx="60" cy="152" rx="38" ry="8" filter="url(#top-soft)"/>
      <g id="top-press">
        <rect class="tp fillp" x="56" y="10" width="8" height="36" rx="1"/>
        <polygon class="tp fillp" points="20,52 100,52 60,148"/>
        <path id="shade-light" class="shade-l"/>
        <path id="shade-dark" class="shade-d"/>
        <path class="tp" d="M24 60 L58 136" style="stroke:var(--bevel-hi)"/>
        <path class="tp" d="M31 70 Q60 82 89 70" style="stroke:var(--line-dim)"/>
        <path id="stripe-b" class="stripe-s"/>
        <path id="stripe-c" class="stripe-s"/>
        <path id="stripe-main" class="stripe-m"/>
        <ellipse class="tp disc" cx="60" cy="52" rx="40" ry="10"/>
        <line id="tick" class="tick" x1="60" y1="46" x2="60" y2="43"/>
      </g>
      <path class="hit" d="M52 4 H68 V40 H108 L66 156 H54 L12 40 H52 Z"/>
    </g>

    <g id="pops" aria-hidden="true"></g>
    <text id="counter" class="counter" x="180" y="432" text-anchor="middle">Turns: 0</text>
  </svg>
  <p class="sr" id="live" role="status" aria-live="polite"></p>
</div>`,

    mount: function (api) {
      var TM = window.TopMotion;
      var TAU = Math.PI * 2, PI = Math.PI;
      var NS = 'http://www.w3.org/2000/svg';
      var POP_Y = 94;                        // baseline where a popped number starts (scene units)
      var scene = document.getElementById('scene');
      var topEl = document.getElementById('top');
      var press = document.getElementById('top-press');
      var shadow = document.getElementById('top-shadow');
      var hit = topEl.querySelector('.hit');
      var popsEl = document.getElementById('pops');
      var counterEl = document.getElementById('counter');
      var live = document.getElementById('live');
      var el = {
        light: document.getElementById('shade-light'), dark: document.getElementById('shade-dark'),
        b: document.getElementById('stripe-b'), c: document.getElementById('stripe-c'),
        main: document.getElementById('stripe-main'), tick: document.getElementById('tick')
      };

      var queued = 0;        // total full turns requested so far (integer: no float drift)
      var turns = 0;         // full turns actually completed
      var theta = 0;         // cumulative rotation in radians; never reset, never reversed
      var v = 0;             // angular speed, rad/s
      var raf = 0, last = 0, frameNow = 0;
      var pressV = 0, presses = {}, pops = [];
      var panel = window.TopPanel ? TopPanel.mount() : null;

      /* ---------- motion ---------- */
      // Speed profile from the settings: accelerate for ta, cruise, brake for ta; one isolated turn takes turnMs.
      function profile() {
        var s = TM.get(), T = s.turnMs / 1000;
        var ta = Math.min(T / 2, Math.max(0.025, (s.easePct / 100) * T / 2));
        var vc = TAU / (T - ta);
        return { vc: vc, a: vc / ta };
      }
      function physics(h) {
        var P = profile(), target = queued * TAU, r = target - theta;
        if (r <= 0) { v = 0; theta = target; return; }
        var vdes = Math.min(P.vc, Math.sqrt(2 * P.a * r));      // brake so that speed reaches 0 exactly at the target
        var dv = P.a * h;
        v = vdes > v ? Math.min(vdes, v + dv) : Math.max(vdes, v - dv);   // speed always changes smoothly
        var nt = theta + v * h;
        if (nt >= target - 1e-7) { nt = target; v = 0; }
        theta = nt;
        var done = Math.floor(theta / TAU + 1e-9);               // a turn counts when the rotation really reaches it
        while (turns < done) { turns++; onTurn(turns); }
      }

      function onTurn(n) {
        counterEl.textContent = 'Turns: ' + n;
        live.textContent = 'Turn ' + n + ' complete';
        var s = TM.get();
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('class', 'pop');
        t.setAttribute('x', 180);
        t.setAttribute('y', POP_Y);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', s.sizePx);
        t.textContent = String(n);
        popsEl.appendChild(t);
        pops.push({ el: t, t0: frameNow, rise: s.risePx, ms: s.popMs });
      }

      /* ---------- drawing ---------- */
      function norm(a) { a = a % TAU; if (a > PI) a -= TAU; if (a <= -PI) a += TAU; return a; }
      // point on the cone surface: f = 0 at the rim, 1 at the tip; ang = 0 faces the viewer
      function pt(f, ang) { return [60 + 40 * (1 - f) * Math.sin(ang), 52 + 96 * f + 10 * (1 - f) * Math.cos(ang)]; }
      // a stripe of angular half-width `half` around `center`, clipped to the half of the cone facing the viewer
      function band(center, half) {
        var c = norm(center), lo = Math.max(c - half, -PI / 2), hi = Math.min(c + half, PI / 2);
        if (hi - lo < 0.004) return '';
        var N = 8, i, f, p, d = '';
        for (i = 0; i <= N; i++) { f = 0.04 + 0.93 * i / N; p = pt(f, lo); d += (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
        for (i = N; i >= 0; i--) { f = 0.04 + 0.93 * i / N; p = pt(f, hi); d += 'L' + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
        return d + 'Z';
      }
      function draw() {
        el.main.setAttribute('d', band(theta, 0.2));
        el.b.setAttribute('d', band(theta + TAU / 3, 0.07));
        el.c.setAttribute('d', band(theta + 2 * TAU / 3, 0.07));
        el.light.setAttribute('d', band(theta + 0.9, 0.4));
        el.dark.setAttribute('d', band(theta + 0.9 + PI, 0.4));
        var sa = Math.sin(theta), ca = Math.cos(theta);
        el.tick.setAttribute('x1', (60 + 22 * sa).toFixed(2)); el.tick.setAttribute('y1', (52 + 5.5 * ca).toFixed(2));
        el.tick.setAttribute('x2', (60 + 37 * sa).toFixed(2)); el.tick.setAttribute('y2', (52 + 9.25 * ca).toFixed(2));
        el.tick.style.opacity = ca >= 0 ? 1 : 0.35;
        var ps = 1 - 0.035 * pressV;                                         // press feedback shrinks the body about the tip
        press.setAttribute('transform', 'translate(60 148) scale(' + ps.toFixed(4) + ') translate(-60 -148)');
        shadow.style.opacity = (0.55 - 0.2 * pressV).toFixed(3);
        topEl.setAttribute('data-turns', turns);
        topEl.setAttribute('data-queued', queued - turns);
        topEl.setAttribute('data-theta', (theta * 180 / PI).toFixed(3));
      }

      function pressedNow() { for (var k in presses) if (presses[k]) return true; return false; }
      function animating() {
        return theta < queued * TAU - 1e-9 || v > 0 || pops.length > 0 || Math.abs(pressV - (pressedNow() ? 1 : 0)) > 0.002;
      }

      // the one and only animation loop; it stops itself when nothing is moving
      function frame(now) {
        raf = 0;
        frameNow = now;
        var dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        var n = Math.max(1, Math.ceil(dt / (1 / 240))), i;
        for (i = 0; i < n; i++) physics(dt / n);
        pressV += ((pressedNow() ? 1 : 0) - pressV) * Math.min(1, dt / 0.05);
        if (Math.abs(pressV) < 0.002) pressV = 0;
        pops = pops.filter(function (p) {
          var k = (now - p.t0) / p.ms;
          if (k >= 1) { p.el.remove(); return false; }
          var rise = 1 - Math.pow(1 - k, 2);
          var fade = k < 0.35 ? 0 : (k - 0.35) / 0.65;
          p.el.setAttribute('y', (POP_Y - p.rise * rise).toFixed(2));
          p.el.style.opacity = (1 - fade * fade * (3 - 2 * fade)).toFixed(3);
          return true;
        });
        draw();
        if (animating()) raf = requestAnimationFrame(frame);
      }
      function ensureLoop() {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }

      /* ---------- input ---------- */
      function tap() {
        queued++;                                                  // one tap = one more full turn in the queue
        ensureLoop();
      }
      function overTop(e) { return document.elementFromPoint(e.clientX, e.clientY) === hit; }
      topEl.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        presses[e.pointerId] = true;
        try { topEl.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();                                        // no emulated mouse events: a touch counts once
        ensureLoop();
      });
      topEl.addEventListener('pointermove', function (e) {
        if (e.pointerId in presses) { presses[e.pointerId] = overTop(e); ensureLoop(); }
      });
      topEl.addEventListener('pointerup', function (e) {
        if (!(e.pointerId in presses)) return;
        var inside = overTop(e);
        delete presses[e.pointerId];
        if (inside) tap(); else ensureLoop();
      });
      topEl.addEventListener('pointercancel', function (e) { delete presses[e.pointerId]; ensureLoop(); });
      topEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      topEl.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); presses.key = true; ensureLoop(); }
      });
      topEl.addEventListener('keyup', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && presses.key) { e.preventDefault(); delete presses.key; tap(); }
      });
      topEl.addEventListener('blur', function () { if (presses.key) { delete presses.key; ensureLoop(); } });

      draw();

      return {
        destroy: function () {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          queued = turns = 0; theta = v = 0; presses = {}; pops = [];
          if (panel) panel.destroy();
        }
      };
    }
  };
})();

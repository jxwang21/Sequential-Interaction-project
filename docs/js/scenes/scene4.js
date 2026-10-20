/* Step 4: spin the top to enter the code. Redesigned from studies/04-activate-the-spinning-top (see STUDY.md there).
   The clock reads 3:17; the code is 3 -> 1 -> 7. The player enters each digit by tapping the top: every tap queues one
   full 360-degree turn (1-9 per round, turns run back to back). When nothing is left to spin and no tap arrives for
   "Pause to confirm", the round is confirmed: the number of turns actually completed is revealed above the top and flies
   into the next slot. A wrong digit clears the three slots (and nothing else); 3, 1, 7 in order completes the step.
   The digit is never generated for the player and the code is never shown.
   Rotation is drawn as stripes and shading travelling over the cone (the outline and the contact point never move).
   One animation loop drives everything and stops itself when idle; timed events live in the same loop so Restart can
   cancel them. Tunable values: js/top-motion.js (panel: js/top-panel.js). api.complete() fires once, on success. */
(function () {
  var Scenes = (window.Scenes = window.Scenes || {});

  Scenes[4] = {
    html: `
<div class="stage" id="stage" role="group" aria-label="Spin the top to enter the code">
  <svg class="scene" id="scene" viewBox="0 -10 360 590">
    <defs>
      <filter id="top-soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>

    <!-- clock showing 3:17: the clue -->
    <g transform="translate(132 4) scale(.8)" role="img" aria-label="Clock showing 3:17">
      <circle cx="63" cy="64" r="52" fill="#000" stroke="none" opacity=".6" filter="url(#top-soft)"/>
      <circle class="c-case" cx="60" cy="60" r="52" fill="#1d1d1d"/>
      <path class="c-hi" d="M12 60 A48 48 0 0 1 60 12" stroke="#565656"/>
      <path class="c-lo" d="M108 60 A48 48 0 0 1 60 108" stroke="#060606"/>
      <circle class="c-dial" cx="60" cy="60" r="43" fill="#161616" stroke="#5e5e5e"/>
      <line class="c-tick" x1="60" y1="19" x2="60" y2="26"/>
      <line class="c-tick" x1="60" y1="19" x2="60" y2="26" transform="rotate(90 60 60)"/>
      <line class="c-tick" x1="60" y1="19" x2="60" y2="26" transform="rotate(180 60 60)"/>
      <line class="c-tick" x1="60" y1="19" x2="60" y2="26" transform="rotate(270 60 60)"/>
      <rect class="c-niche" x="27" y="43" width="66" height="34" rx="3" fill="#0d0d0d" stroke="#5e5e5e"/>
      <g transform="translate(60 60) scale(.75) translate(-120 -83)" stroke="#dcdcdc">
        <path class="c-digit" d="M85 66 H103 V100 H85 M92 83 H103"/>
        <circle class="c-colon" cx="114" cy="76" r="1.8" fill="#dcdcdc" stroke="none"/>
        <circle class="c-colon" cx="114" cy="90" r="1.8" fill="#dcdcdc" stroke="none"/>
        <path class="c-digit" d="M126 66 V100 M126 66 L120 72"/>
        <path class="c-digit" d="M137 66 H155 V100"/>
      </g>
    </g>

    <!-- pause-to-confirm cue: a thin ring on the ground that runs down while the top waits for another tap -->
    <ellipse id="wait-ring" class="wait-ring" cx="180" cy="420" rx="70" ry="11" pathLength="100"/>

    <!-- the top (local coordinates 120 x 150, drawn 1.5x); the tip at local (60,148) is the fixed contact point -->
    <g id="top" class="top" tabindex="0" role="button" aria-label="Top. Tap to spin." transform="translate(180 205) scale(1.5) translate(-60 -10)">
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

    <!-- three code slots, empty at the start -->
    <g id="slots"></g>

    <g id="fly" aria-hidden="true"></g>
    <text id="msg" class="msg" x="180" y="556" text-anchor="middle" aria-hidden="true"></text>
  </svg>
  <p class="sr" id="live" role="status" aria-live="polite"></p>
</div>`,

    mount: function (api) {
      var TM = window.TopMotion;
      var CODE = [3, 1, 7];                  // the password the clock points to
      var MAX_TURNS = 9;                     // turns allowed per round
      var EASE = 0.5;                        // share of a turn spent speeding up / slowing down (fixed)
      var ERR_MS = 900;                      // wrong-code feedback
      var TAU = Math.PI * 2, PI = Math.PI;
      var NS = 'http://www.w3.org/2000/svg';
      var POP_Y = 188;                       // baseline where the revealed number appears (above the top)
      var SLOT_X = [102, 180, 258], SLOT_Y = 492, SLOT = 60;

      var scene = document.getElementById('scene');
      var topEl = document.getElementById('top');
      var press = document.getElementById('top-press');
      var shadow = document.getElementById('top-shadow');
      var hit = topEl.querySelector('.hit');
      var ring = document.getElementById('wait-ring');
      var slotsEl = document.getElementById('slots');
      var flyEl = document.getElementById('fly');
      var msgEl = document.getElementById('msg');
      var live = document.getElementById('live');
      var el = {
        light: document.getElementById('shade-light'), dark: document.getElementById('shade-dark'),
        b: document.getElementById('stripe-b'), c: document.getElementById('stripe-c'),
        main: document.getElementById('stripe-main'), tick: document.getElementById('tick')
      };

      var queued = 0;        // total full turns requested (integer, never reset)
      var theta = 0, v = 0;  // cumulative rotation (rad) and angular speed; the angle is never reset or reversed
      var roundTaps = 0;     // turns requested in the current round (1-9)
      var roundStart = 0;    // theta at the start of the current round
      var phase = 'idle';    // idle | spinning | waiting | feedback (input locked)
      var waitStart = 0;     // when the queue emptied: the pause-to-confirm countdown runs from here
      var entered = [];      // confirmed digits
      var locked = false;
      var raf = 0, last = 0, frameNow = 0;
      var pressV = 0, presses = {}, fly = null, events = [], shake = null, pulse = null, nudge = 0, readyUntil = 0;
      var slotRect = [], slotText = [];
      var doneSent = false;
      var panel = window.TopPanel ? TopPanel.mount() : null;

      for (var i = 0; i < 3; i++) {
        var g = document.createElementNS(NS, 'g');
        g.setAttribute('id', 'slot-' + i);
        g.setAttribute('class', 'slot');
        g.setAttribute('data-digit', '');
        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', SLOT_X[i] - SLOT / 2); r.setAttribute('y', SLOT_Y - SLOT / 2);
        r.setAttribute('width', SLOT); r.setAttribute('height', SLOT); r.setAttribute('rx', 3);
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('x', SLOT_X[i]); t.setAttribute('y', SLOT_Y + 12); t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'slot-digit');
        g.appendChild(r); g.appendChild(t);
        slotsEl.appendChild(g);
        slotRect.push(g); slotText.push(t);
      }

      var inFrame = false;
      function now() { return inFrame ? frameNow : performance.now(); }
      function after(ms, fn) { events.push({ at: now() + ms, fn: fn }); ensureLoop(); }

      /* ---------- motion ---------- */
      function profile() {
        var T = TM.get().turnMs / 1000;
        var ta = Math.min(T / 2, Math.max(0.025, EASE * T / 2));
        var vc = TAU / (T - ta);
        return { vc: vc, a: vc / ta };
      }
      function physics(h) {
        var P = profile(), target = queued * TAU, r = target - theta;
        if (r <= 0) { v = 0; theta = target; return; }
        var vdes = Math.min(P.vc, Math.sqrt(2 * P.a * r));      // brake so speed reaches 0 exactly at the target
        var dv = P.a * h;
        v = vdes > v ? Math.min(vdes, v + dv) : Math.max(vdes, v - dv);   // speed always changes smoothly
        var nt = theta + v * h;
        if (nt >= target - 1e-7) { nt = target; v = 0; }
        theta = nt;
      }
      function turnsDone() { return Math.floor((theta - roundStart) / TAU + 1e-6); }   // full turns actually completed this round

      /* ---------- drawing ---------- */
      function norm(a) { a = a % TAU; if (a > PI) a -= TAU; if (a <= -PI) a += TAU; return a; }
      function pt(f, ang) { return [60 + 40 * (1 - f) * Math.sin(ang), 52 + 96 * f + 10 * (1 - f) * Math.cos(ang)]; }
      function band(center, half) {
        var c = norm(center), lo = Math.max(c - half, -PI / 2), hi = Math.min(c + half, PI / 2);
        if (hi - lo < 0.004) return '';
        var N = 8, k, f, p, d = '';
        for (k = 0; k <= N; k++) { f = 0.04 + 0.93 * k / N; p = pt(f, lo); d += (k ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
        for (k = N; k >= 0; k--) { f = 0.04 + 0.93 * k / N; p = pt(f, hi); d += 'L' + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
        return d + 'Z';
      }
      function draw(t) {
        el.main.setAttribute('d', band(theta, 0.2));
        el.b.setAttribute('d', band(theta + TAU / 3, 0.07));
        el.c.setAttribute('d', band(theta + 2 * TAU / 3, 0.07));
        el.light.setAttribute('d', band(theta + 0.9, 0.4));
        el.dark.setAttribute('d', band(theta + 0.9 + PI, 0.4));
        var sa = Math.sin(theta), ca = Math.cos(theta);
        el.tick.setAttribute('x1', (60 + 22 * sa).toFixed(2)); el.tick.setAttribute('y1', (52 + 5.5 * ca).toFixed(2));
        el.tick.setAttribute('x2', (60 + 37 * sa).toFixed(2)); el.tick.setAttribute('y2', (52 + 9.25 * ca).toFixed(2));
        el.tick.style.opacity = ca >= 0 ? 1 : 0.35;
        var nk = nudge > 0 ? 0.03 * Math.sin(PI * Math.min(1, nudge)) : 0;                // "maximum reached" nudge
        var ps = 1 - 0.035 * pressV - nk;                                                 // press feedback sinks the body about the tip
        press.setAttribute('transform', 'translate(60 148) scale(' + ps.toFixed(4) + ') translate(-60 -148)');
        shadow.style.opacity = (0.55 - 0.2 * pressV).toFixed(3);

        // pause-to-confirm ring
        if (phase === 'waiting') {
          var frac = Math.min(1, (t - waitStart) / TM.get().confirmMs);
          ring.style.opacity = '0.8';
          ring.style.strokeDashoffset = (100 * frac).toFixed(2);
        } else ring.style.opacity = '0';

        // slots: shake on a wrong code, one shared pulse on success
        var tx = 0, sc = 1;
        if (shake) { var p = Math.min(1, (t - shake.t0) / ERR_MS); tx = 5 * Math.sin(TAU * 5 * (ERR_MS / 1000) * p) * (1 - 0.6 * p); }
        if (pulse) { var q = Math.min(1, (t - pulse.t0) / 450); sc = 1 + 0.08 * Math.sin(PI * q); }
        slotsEl.setAttribute('transform', 'translate(' + (180 + tx).toFixed(2) + ' ' + SLOT_Y + ') scale(' + sc.toFixed(4) + ') translate(-180 -' + SLOT_Y + ')');
        var nextIdx = !locked && entered.length < 3 ? entered.length : -1;
        slotRect.forEach(function (s, k) { s.classList.toggle('next', k === nextIdx); });
        scene.classList.toggle('locked', locked);
        scene.classList.toggle('ready', t < readyUntil);

        topEl.setAttribute('data-phase', phase);
        topEl.setAttribute('data-round', turnsDone());
        topEl.setAttribute('data-queued', Math.max(0, Math.round((queued * TAU - theta) / TAU * 1000) / 1000));
        topEl.setAttribute('data-theta', (theta * 180 / PI).toFixed(3));
        scene.setAttribute('data-entered', entered.join(','));
      }

      function pressedNow() { for (var k in presses) if (presses[k]) return true; return false; }
      function animating() {
        return theta < queued * TAU - 1e-9 || v > 0 || phase === 'waiting' || !!fly || events.length > 0 || !!shake || !!pulse || nudge > 0 ||
          Math.abs(pressV - (pressedNow() ? 1 : 0)) > 0.002 || frameNow < readyUntil;
      }

      /* ---------- rounds ---------- */
      function ease(k) { return 1 - Math.pow(1 - k, 3); }
      function easeIO(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

      function confirmRound() {
        var n = turnsDone();                                   // the digit comes from the rotation that really happened
        locked = true; phase = 'feedback';
        roundTaps = 0; roundStart = theta;
        var idx = entered.length, s = TM.get();
        var t = document.createElementNS(NS, 'text');
        t.setAttribute('class', 'fly');
        t.setAttribute('text-anchor', 'middle');
        t.textContent = String(n);
        flyEl.appendChild(t);
        fly = { el: t, n: n, idx: idx, t0: now(), ms: s.feedbackMs, rise: s.popPx };
        live.textContent = 'Number ' + n;
      }

      function landFly() {
        var f = fly; fly = null;
        f.el.remove();
        slotText[f.idx].textContent = String(f.n);
        slotRect[f.idx].setAttribute('data-digit', f.n);
        entered.push(f.n);
        if (f.n !== CODE[f.idx]) {                               // wrong digit at this position
          msgEl.textContent = 'Wrong sequence. Try again.';
          msgEl.classList.add('show', 'bad');
          live.textContent = 'Wrong sequence. Try again.';
          shake = { t0: now() };
          after(ERR_MS, resetCode);
        } else if (entered.length === 3) {                       // 3, 1, 7 entered in order
          pulse = { t0: now() };
          live.textContent = 'Code correct.';
          after(450, function () { pulse = null; });
          after(1100, function () { if (!doneSent) { doneSent = true; api.complete(); } });   // fires once
        } else {
          after(150, function () { locked = false; phase = 'idle'; readyUntil = now() + 500; });   // ready for the next digit
        }
      }

      function resetCode() {                                     // clears only this step
        shake = null;
        msgEl.classList.remove('show', 'bad');
        entered = [];
        slotText.forEach(function (t) { t.textContent = ''; });
        slotRect.forEach(function (s) { s.setAttribute('data-digit', ''); });
        roundTaps = 0; roundStart = theta;
        locked = false; phase = 'idle'; readyUntil = now() + 500;
        live.textContent = '';
      }

      /* ---------- loop ---------- */
      function frame(t) {
        raf = 0;
        frameNow = t;
        inFrame = true;
        var dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
        last = t;
        var n = Math.max(1, Math.ceil(dt / (1 / 240))), k;
        for (k = 0; k < n; k++) physics(dt / n);
        if (phase === 'spinning' && theta >= queued * TAU - 1e-9 && v === 0) { phase = 'waiting'; waitStart = t; }   // queue empty: start the pause
        if (phase === 'waiting' && t - waitStart >= TM.get().confirmMs) confirmRound();
        pressV += ((pressedNow() ? 1 : 0) - pressV) * Math.min(1, dt / 0.05);
        if (Math.abs(pressV) < 0.002) pressV = 0;
        if (nudge > 0) nudge = Math.max(0, nudge - dt / 0.35);

        if (fly) {                                               // pop above the top, then travel into the slot
          var p = Math.min(1, (t - fly.t0) / fly.ms), x, y, size, op;
          var baseY = POP_Y - fly.rise;
          if (p < 0.5) {
            var a = p / 0.5;
            x = 180; y = POP_Y - fly.rise * ease(a); size = 30 + 18 * ease(a); op = Math.min(1, a * 4);
          } else {
            var b = easeIO((p - 0.5) / 0.5);
            x = 180 + (SLOT_X[fly.idx] - 180) * b; y = baseY + (SLOT_Y + 12 - baseY) * b; size = 48 - 14 * b; op = 1;
          }
          fly.el.setAttribute('x', x.toFixed(2)); fly.el.setAttribute('y', y.toFixed(2));
          fly.el.setAttribute('font-size', size.toFixed(1)); fly.el.style.opacity = op.toFixed(3);
          if (p >= 1) landFly();
        }
        if (events.length) {
          var due = events.filter(function (e) { return e.at <= t; });
          if (due.length) { events = events.filter(function (e) { return e.at > t; }); due.forEach(function (e) { e.fn(); }); }
        }
        draw(t);
        inFrame = false;
        if (animating()) raf = requestAnimationFrame(frame);
      }
      function ensureLoop() {
        if (raf || inFrame) return;                              // inside a frame the loop reschedules itself: never start a second one
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }

      /* ---------- input ---------- */
      function tap() {
        if (locked) return;                                      // number feedback / wrong-code feedback: input is off
        if (roundTaps >= MAX_TURNS) {                            // upper limit: no more rotation, gentle cue instead
          nudge = 1;
          msgEl.textContent = 'Maximum is 9 turns.';
          msgEl.classList.add('show');
          after(900, function () { if (!locked && msgEl.textContent === 'Maximum is 9 turns.') msgEl.classList.remove('show'); });
          ensureLoop();
          return;
        }
        if (roundTaps === 0) roundStart = theta;
        roundTaps++; queued++;                                   // one tap = one more full turn in this round's queue
        phase = 'spinning';                                      // a tap during the pause continues the same round
        ensureLoop();
      }
      function overTop(e) { return document.elementFromPoint(e.clientX, e.clientY) === hit; }
      topEl.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        if (locked) return;                                      // input is off during feedback: no press response either
        presses[e.pointerId] = true;
        try { topEl.setPointerCapture(e.pointerId); } catch (err) {}   // preventDefault above: no emulated mouse events, a touch counts once
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
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); if (locked) return; presses.key = true; ensureLoop(); }
      });
      topEl.addEventListener('keyup', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && presses.key) { e.preventDefault(); delete presses.key; tap(); }
      });
      topEl.addEventListener('blur', function () { if (presses.key) { delete presses.key; ensureLoop(); } });

      // review shortcut (index.html#awake): the code is already entered and the step completes by itself
      if (window.__awakePreview) {
        window.__awakePreview = false;
        entered = CODE.slice();
        entered.forEach(function (n, k) { slotText[k].textContent = String(n); slotRect[k].setAttribute('data-digit', n); });
        locked = true; phase = 'feedback';
        after(900, function () { doneSent = true; api.complete(); });
      }

      draw(performance.now());

      return {
        destroy: function () {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          events = []; fly = null; shake = null; pulse = null; presses = {};
          queued = 0; theta = v = 0; phase = 'idle';
          if (panel) panel.destroy();
        }
      };
    }
  };
})();

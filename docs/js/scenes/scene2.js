/* Step 2: ported from studies/ (see STUDY.md there). Gestures, timings and feedback are unchanged;
   changes: no per-step reset button, scene can be destroyed, and api.complete() fires once the success feedback has finished. */
(function () {
  var Scenes = (window.Scenes = window.Scenes || {});
  Scenes[2] = {
    html: `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <filter id="soft-sm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="soft-md" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
</svg>

<div class="stage" id="stage" role="group" aria-label="Rotate the city">
  <div class="scene">
    <!-- One rigid group, pivoting on the centre of the scene (180, 180). Roofs point down. Both wings keep clear of the doorway at every angle. -->
    <svg class="city" id="city" viewBox="0 0 360 360" aria-hidden="true">
      <g id="buildings">
        <polygon class="bld" points="20,130 42,130 42,210 31,232 20,210"/>
        <polygon class="bld" points="42,130 66,130 66,246 42,226"/>
        <polygon class="bld" points="66,130 84,130 84,194 75,208 66,194"/>
        <polygon class="bld" points="84,130 104,130 104,226 96,226 96,240 90,240 90,226 84,226"/>
        <polygon class="bld" points="256,130 280,130 280,220 268,236 256,220"/>
        <polygon class="bld" points="280,130 306,130 306,254 280,254"/>
        <polygon class="bld" points="306,130 324,130 324,200 315,216 306,200"/>
        <polygon class="bld" points="324,130 340,130 340,216 324,236"/>
      </g>
      <g id="edge-light">
        <path class="edge" d="M23 133 H39"/>
        <path class="edge" d="M45 133 H63"/>
        <path class="edge" d="M69 133 H81"/>
        <path class="edge" d="M87 133 H101"/>
        <path class="edge" d="M259 133 H277"/>
        <path class="edge" d="M283 133 H303"/>
        <path class="edge" d="M309 133 H321"/>
        <path class="edge" d="M327 133 H337"/>
      </g>
      <g id="windows">
        <rect class="win" x="28" y="140" width="5" height="7"/>
        <rect class="win" x="46" y="140" width="5" height="7"/>
        <rect class="win" x="55" y="152" width="5" height="7"/>
        <rect class="win" x="91" y="140" width="5" height="7"/>
        <rect class="win" x="265" y="140" width="5" height="7"/>
        <rect class="win" x="287" y="140" width="5" height="7"/>
        <rect class="win" x="296" y="152" width="5" height="7"/>
        <rect class="win" x="329" y="140" width="5" height="7"/>
      </g>
    </svg>

    <div class="door" id="door" role="img" aria-label="Doorway">
      <svg viewBox="0 0 140 200" aria-hidden="true">
        <rect class="d-shadow" x="24" y="19" width="100" height="172" rx="2" filter="url(#soft-md)"/>
        <g id="door-frame">
          <rect class="d-outer" x="20" y="14" width="100" height="172" rx="2"/>
          <path class="d-hi" d="M24 182 V18 H116"/>
          <path class="d-lo" d="M116 18 V182 H24"/>
          <rect class="d-open" x="32" y="26" width="76" height="148"/>
        </g>
      </svg>
      <svg class="door-clue" id="door-clue" viewBox="0 0 140 200" aria-hidden="true">
        <text x="72" y="88" text-anchor="middle" dominant-baseline="central">No longer</text>
        <text x="72" y="108" text-anchor="middle" dominant-baseline="central">asleep.</text>
      </svg>
      <svg class="panel" viewBox="0 0 140 200" aria-hidden="true">
        <g id="door-panel">
          <rect class="p-body" x="34" y="28" width="72" height="144"/>
          <path class="d-hi" d="M37 169 V31 H103"/>
          <path class="d-lo" d="M103 31 V169 H37"/>
          <!-- lock: plate, keyhole and a key that slides in, turns and stays in the lock while the door swings open -->
          <g transform="translate(92 104)">
            <circle class="lock-plate" cx="0" cy="0" r="9"/>
            <g class="hole-turn"><circle class="hole" cx="0" cy="0" r="2.6"/><path class="hole" d="M-1.3 2 L-2 8 H2 L1.3 2 Z"/></g>
            <g class="click"><path d="M-12 -9 L-15 -12"/><path d="M12 -9 L15 -12"/><path d="M0 -13 V-17"/></g>
            <g class="key-slide"><g class="key-turn-g"><path class="key-shape" transform="scale(-.3 .3) translate(-170 -47)" d="M59.6 36 H170 V58 H160 V44 H148 V62 H138 V44 H59.6 A20 20 0 1 1 59.6 36 Z M32 40 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z"/></g></g>
          </g>
        </g>
      </svg>
    </div>
  </div>

  <div class="controls">
    <div class="clues">
      <svg class="clue" viewBox="0 0 272 96" role="img" aria-label="Route clue">
        <rect class="clue-plaque" x="6" y="6" width="260" height="84" rx="3"/>
        <path class="d-hi" d="M9 87 V9 H263"/>
        <path class="d-lo" d="M263 9 V87 H9"/>
        <rect class="clue-plate" x="15" y="15" width="242" height="66" rx="2"/>
        <!-- the route is deliberately hazy: a soft, slowly refocusing glow over a faint crisp ghost -->
        <defs>
          <filter id="clue-haze" filterUnits="userSpaceOnUse" x="0" y="0" width="272" height="96" color-interpolation-filters="sRGB">
            <feGaussianBlur stdDeviation="3.4">
              <animate attributeName="stdDeviation" values="2.8;5;2.8" keyTimes="0;.5;1" dur="7s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>
            </feGaussianBlur>
          </filter>
        </defs>
        <g class="clue-step clue-ghost">
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(46 48) rotate(0)"/>
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(106 48) rotate(90)"/>
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(166 48) rotate(180)"/>
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(226 48) rotate(270)"/>
        </g>
        <g class="clue-step clue-haze">
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(46 48) rotate(0)"/>
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(106 48) rotate(90)"/>
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(166 48) rotate(180)"/>
          <path d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(226 48) rotate(270)"/>
        </g>
      </svg>

      <svg class="marks" viewBox="0 0 180 48" aria-hidden="true">
        <g class="mark"><circle class="m-ring" cx="24" cy="24" r="12"/><circle class="m-in" cx="24" cy="24" r="8"/><circle class="m-fill" cx="24" cy="24" r="8"/></g>
        <g class="mark"><circle class="m-ring" cx="68" cy="24" r="12"/><circle class="m-in" cx="68" cy="24" r="8"/><circle class="m-fill" cx="68" cy="24" r="8"/></g>
        <g class="mark"><circle class="m-ring" cx="112" cy="24" r="12"/><circle class="m-in" cx="112" cy="24" r="8"/><circle class="m-fill" cx="112" cy="24" r="8"/></g>
        <g class="mark"><circle class="m-ring" cx="156" cy="24" r="12"/><circle class="m-in" cx="156" cy="24" r="8"/><circle class="m-fill" cx="156" cy="24" r="8"/></g>
      </svg>
    </div>

    <div class="pad" id="pad"></div>

    </div>
</div>
`,
    mount: function (api) {
      var SEQ = ['up', 'right', 'down', 'left'];
      var ROT = { up: 0, right: 90, down: 180, left: 270 };
      var LABEL = { up: 'Up', right: 'Right', down: 'Down', left: 'Left' };
      var PAD_ORDER = ['up', 'left', 'down', 'right'];
      // Turn / return durations and easing live in js/city-motion.js (defaults = the study's 900 ms, 1600 ms,
      // HEAVY / CONTROLLED curves). They are read when each action starts, so a change applies to the next action.
      var CM = window.CityMotion;
      var STEP_DEG = 45;       // each correct key turns the city 45 degrees, so the four keys add up to exactly 180

      var stage = document.getElementById('stage');
      var city = document.getElementById('city');
      var door = document.getElementById('door');
      var moon = document.getElementById('door-clue');
      var pad = document.getElementById('pad');
      var marks = Array.prototype.slice.call(document.querySelectorAll('.mark'));
      var buttons = [];
      var step = 0, locked = false, pressing = null, timers = [];
      var angle = 0, solved = false, previewing = false, panel = null;

      function buttonSvg(dir) {
        return '<svg viewBox="0 0 96 96" aria-hidden="true">' +
          '<rect class="b-shadow" x="11" y="12" width="76" height="76" rx="3" filter="url(#soft-sm)"/>' +
          '<g class="b-body">' +
          '<rect class="b-outer" x="6" y="6" width="76" height="76" rx="3"/>' +
          '<path class="b-hi" d="M9 79 V9 H79"/>' +
          '<path class="b-lo" d="M79 9 V79 H9"/>' +
          '<rect class="b-plate" x="15" y="15" width="58" height="58" rx="2"/>' +
          '<path class="b-arrow" d="M0 16 V-16 M-11 -5 L0 -16 L11 -5" transform="translate(44 44) rotate(' + ROT[dir] + ')"/>' +
          '</g></svg>';
      }

      PAD_ORDER.forEach(function (dir) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.setAttribute('data-dir', dir);
        b.setAttribute('aria-label', LABEL[dir]);
        b.innerHTML = buttonSvg(dir);
        pad.appendChild(b);
        buttons.push(b);
        wire(b, dir);
      });

      function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
      function setLocked(v) { locked = v; stage.classList.toggle('is-locked', v); if (panel) panel.refresh(); }

      function rotateCity(deg, ms, ease) {
        city.style.setProperty('--dur', ms + 'ms');
        city.style.setProperty('--ease', ease);
        city.style.setProperty('--a', deg + 'deg');
      }

      // Rotate and call done() when the rotation has actually finished (transitionend), so input is never
      // accepted before the city stops. A timer at ms (+ margin) covers a missing transitionend; if the angle does
      // not change there is no transition, so done() waits exactly ms like the original study.
      function turnTo(deg, ms, ease, done) {
        var from = angle, finished = false;
        angle = deg;
        function fin(e) {
          if (finished) return;
          if (e && (e.target !== city || e.propertyName !== 'transform')) return;
          finished = true;
          city.removeEventListener('transitionend', fin);
          done();
        }
        rotateCity(deg, ms, ease);
        if (from === deg) { later(fin, ms); return; }
        city.addEventListener('transitionend', fin);
        later(fin, ms + 150);
      }

      // Preview one 45-degree turn from the current state without touching puzzle progress, then restore the
      // city to where it was (using the return settings). Not an input: nothing is counted, nothing unlocks.
      function replayTurn() {
        if (!canReplay()) return false;
        previewing = true;
        setLocked(true);
        var base = angle, s = CM.get();
        turnTo(base + 45, s.stepMs, CM.turnEase(), function () {
          later(function () {
            turnTo(base, s.returnMs, CM.returnEase(), function () {
              previewing = false;
              setLocked(false);
            });
          }, 250);
        });
        return true;
      }
      function canReplay() { return !locked && !solved && !previewing; }

      function inside(el, x, y) {
        var r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      }

      function wire(el, dir) {
        el.addEventListener('pointerdown', function (e) {
          if (locked || pressing) return;
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          pressing = { el: el, id: e.pointerId };
          el.classList.add('down');
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
        });
        el.addEventListener('pointermove', function (e) {
          if (!pressing || pressing.el !== el || pressing.id !== e.pointerId) return;
          el.classList.toggle('down', inside(el, e.clientX, e.clientY));
        });
        el.addEventListener('pointerup', function (e) {
          if (!pressing || pressing.el !== el || pressing.id !== e.pointerId) return;
          var ok = inside(el, e.clientX, e.clientY);
          el.classList.remove('down');
          pressing = null;
          if (ok) choose(dir, el);
        });
        el.addEventListener('pointercancel', cancelPress);
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        el.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            if (locked || pressing) return;
            pressing = { el: el, id: 'key' };
            el.classList.add('down');
          }
        });
        el.addEventListener('keyup', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && pressing && pressing.el === el && pressing.id === 'key') {
            e.preventDefault();
            el.classList.remove('down');
            pressing = null;
            choose(dir, el);
          }
        });
        el.addEventListener('blur', function () {
          if (pressing && pressing.el === el && pressing.id === 'key') cancelPress();
        });
      }

      function cancelPress() {
        if (pressing) { pressing.el.classList.remove('down'); pressing = null; }
      }

      function choose(dir, el) {
        if (locked) return;
        if (dir === SEQ[step]) {
          setLocked(true);
          step++;
          var n = step;
          el.classList.add('ok');
          turnTo(n * STEP_DEG, CM.get().stepMs, CM.turnEase(), function () {
            el.classList.remove('ok');
            marks[n - 1].classList.add('on');   // fill only after the city has stopped
            if (n === SEQ.length) {
              solved = true;
              if (panel) panel.refresh();
              // last step: input stays disabled. The key slides into the lock (0.55 s), turns it (0.4 s, with a small
              // click), then the door swings open (1 s) and the clue shows.
              later(function () { door.classList.add('key-in'); }, 300);
              later(function () { door.classList.add('key-turn'); }, 300 + 700);
              later(function () {
                door.classList.add('open');
                moon.setAttribute('aria-hidden', 'false');
              }, 300 + 700 + 550);
              later(api.complete, 300 + 700 + 550 + 1100);
            } else {
              setLocked(false);
            }
          });
        } else {
          setLocked(true);
          el.classList.add('err');
          later(function () {
            el.classList.remove('err');
            marks.forEach(function (m) { m.classList.remove('on'); });
            step = 0;
            city.classList.add('dim');
            turnTo(0, CM.get().returnMs, CM.returnEase(), function () {
              city.classList.remove('dim');
              setLocked(false);
            });
          }, 300);
        }
      }

      moon.setAttribute('aria-hidden', 'true');

      // reduced motion: the haze stays at a fixed softness instead of slowly refocusing
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var hz = document.querySelector('#clue-haze animate');
        if (hz) hz.remove();
      }

      if (window.CityPanel) panel = CityPanel.mount({ replay: replayTurn, canReplay: canReplay });

      return {
        destroy: function () {
          if (panel) panel.destroy();
          timers.forEach(clearTimeout);
          timers = [];
          cancelPress();
        }
      };
    }
  };
})();

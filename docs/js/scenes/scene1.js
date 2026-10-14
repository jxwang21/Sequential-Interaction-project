/* Step 1: ported from studies/ (see STUDY.md there). Gestures, timings and feedback are unchanged;
   changes: no per-step reset button, scene can be destroyed, and api.complete() fires once the success feedback has finished. */
(function () {
  var Scenes = (window.Scenes = window.Scenes || {});
  Scenes[1] = {
    html: `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
</svg>

<div class="stage" id="stage" role="group" aria-label="Select the frames">
  <div class="clock" id="clock" role="img" aria-label="Clock showing 3:17">
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <g id="clock-body">
        <circle class="c-shadow" cx="125" cy="128" r="96" filter="url(#soft)"/>
        <rect class="c-pin" x="16" y="106" width="12" height="28" rx="2"/>
        <circle class="c-case" cx="120" cy="120" r="96"/>
        <path class="c-hi" d="M28 120 A92 92 0 0 1 120 28"/>
        <path class="c-lo" d="M212 120 A92 92 0 0 1 120 212"/>
        <circle class="c-dial" cx="120" cy="120" r="82"/>
        <g class="c-tick">
          <line x1="120" y1="48" x2="120" y2="60"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(30 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(60 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="60" transform="rotate(90 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(120 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(150 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="60" transform="rotate(180 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(210 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(240 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="60" transform="rotate(270 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(300 120 120)"/>
          <line x1="120" y1="48" x2="120" y2="56" transform="rotate(330 120 120)"/>
        </g>
        <g id="readout">
          <path class="c-digit" d="M85 66 H103 V100 H85 M92 83 H103"/>
          <circle class="c-colon" cx="114" cy="76" r="1.8"/>
          <circle class="c-colon" cx="114" cy="90" r="1.8"/>
          <path class="c-digit" d="M126 66 V100 M126 66 L120 72"/>
          <path class="c-digit" d="M137 66 H155 V100"/>
        </g>
        <g id="compartment">
          <rect class="c-niche" x="86" y="140" width="68" height="30" rx="3"/>
          <rect class="c-niche-in" x="90" y="144" width="60" height="22" rx="2"/>
        </g>
        <g>
          <line class="c-hand" x1="120" y1="120" x2="155.6" y2="125.3"/>
          <line class="c-hand" x1="120" y1="120" x2="174.8" y2="131.6"/>
          <circle class="c-hub" cx="120" cy="120" r="4"/>
        </g>
      </g>
      <g class="key" id="key" transform="translate(120 155) scale(.4) translate(-95 -41)">
        <path class="key-shape" d="M59.6 36 H170 V58 H160 V44 H148 V62 H138 V44 H59.6 A20 20 0 1 1 59.6 36 Z M32 40 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z"/>
      </g>
    </svg>
    <svg class="cover" viewBox="0 0 240 240" aria-hidden="true">
      <g id="cover">
        <circle class="glass" cx="120" cy="120" r="86"/>
        <path class="glare" d="M62 94 Q76 66 112 56"/>
        <rect class="lug" x="26" y="108" width="16" height="24" rx="2"/>
        <rect class="lug" x="200" y="112" width="10" height="16" rx="2"/>
      </g>
    </svg>
  </div>

  <div class="row" id="row"></div>

  </div>
`,
    mount: function (api) {
      var CHROME_TOP =
        '<svg viewBox="0 0 200 240" aria-hidden="true">' +
        '<rect class="f-shadow" x="26" y="28" width="160" height="200" rx="3" filter="url(#soft)"/>' +
        '<g class="f-body">' +
        '<rect class="f-outer" x="20" y="20" width="160" height="200" rx="3"/>' +
        '<path class="f-hi" d="M24 216 V24 H176"/>' +
        '<path class="f-lo" d="M176 24 V216 H24"/>' +
        '<g class="f-plate"><rect class="f-inner" x="34" y="34" width="132" height="172" rx="2"/><g class="symbols">';
      var CHROME_BOTTOM = '</g></g></g></svg>';

      var DOTS = [[100,120],[134,120],[117,149.4],[83,149.4],[66,120],[83,90.6],[117,90.6]]
        .map(function (p) { return '<circle class="dot" cx="' + p[0] + '" cy="' + p[1] + '" r="9"/>'; }).join('');
      var TRIS =
        '<polygon class="tri" points="100,76 124,116 76,116"/>' +
        '<polygon class="tri" points="70,128 94,168 46,168"/>' +
        '<polygon class="tri" points="130,128 154,168 106,168"/>';
      var EYE =
        '<path class="eye-w" d="M48 120 Q100 78 152 120 Q100 162 48 120 Z"/>' +
        '<circle class="eye-i" cx="100" cy="120" r="17"/>' +
        '<circle class="eye-p" cx="100" cy="120" r="6"/>';

      // left to right: seven dots, three triangles, one eye
      var DEFS = [
        { label: 'Frame with seven dots', art: DOTS },
        { label: 'Frame with three triangles', art: TRIS },
        { label: 'Frame with one eye', art: EYE }
      ];
      var SEQ = [1, 2, 0]; // triangles, eye, dots  (3 -> 1 -> 7)

      var stage = document.getElementById('stage');
      var clock = document.getElementById('clock');
      var row = document.getElementById('row');
      var frames = [];
      var step = 0, locked = false, pressing = null, timers = [];

      DEFS.forEach(function (d, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'frame';
        b.setAttribute('aria-label', d.label);
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML = CHROME_TOP + d.art + CHROME_BOTTOM;
        row.appendChild(b);
        frames.push(b);
        wire(b, i);
      });

      function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
      function setLocked(v) { locked = v; stage.classList.toggle('is-locked', v); }

      function inside(el, x, y) {
        var r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      }

      function wire(el, i) {
        el.addEventListener('pointerdown', function (e) {
          if (locked || pressing || el.classList.contains('on')) return;
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
          if (ok) select(i);
        });
        el.addEventListener('pointercancel', cancelPress);
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        el.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            if (locked || pressing || el.classList.contains('on')) return;
            pressing = { el: el, id: 'key' };
            el.classList.add('down');
          }
        });
        el.addEventListener('keyup', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && pressing && pressing.el === el && pressing.id === 'key') {
            e.preventDefault();
            el.classList.remove('down');
            pressing = null;
            select(i);
          }
        });
        el.addEventListener('blur', function () {
          if (pressing && pressing.el === el && pressing.id === 'key') cancelPress();
        });
      }

      function cancelPress() {
        if (pressing) { pressing.el.classList.remove('down'); pressing = null; }
      }

      function select(i) {
        if (locked) return;
        var el = frames[i];
        if (el.classList.contains('on')) return; // already activated: progress unchanged
        if (i === SEQ[step]) {
          el.classList.add('on');
          el.setAttribute('aria-pressed', 'true');
          step++;
          if (step === SEQ.length) {
            setLocked(true);
            later(function () { clock.classList.add('open'); }, 400);
            // cover swing (1s) + key fade-in (0.25s delay + 0.8s) have finished
            later(api.complete, 400 + 1100);
          }
        } else {
          fail(el);
        }
      }

      function fail(el) {
        setLocked(true);
        el.classList.add('err');
        later(function () {
          el.classList.remove('err');
          frames.forEach(function (f) { f.classList.remove('on'); f.setAttribute('aria-pressed', 'false'); });
          step = 0;
          later(function () { setLocked(false); }, 950);
        }, 300);
      }

      return {
        destroy: function () {
          timers.forEach(clearTimeout);
          timers = [];
          cancelPress();
        }
      };
    }
  };
})();

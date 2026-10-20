/* Letter interaction settings for step 3 (drag the letters into the slots).
   Single source of truth read by scenes/scene3.js while dragging / dropping / giving error feedback,
   and edited by the "Letter Interaction Controls" panel (js/letter-panel.js).
   DEFAULTS are the saved defaults; change them here to make new values the prototype's defaults. */
(function () {
  var DEFAULTS = {
    snapPx: 48,        // a dropped letter snaps to the nearest slot whose centre is within this distance (scene units, ~px at 100%)
    snapMs: 200,       // glide into the slot after a drop (also used for the letter pushed out by a swap into a slot)
    returnMs: 400,     // glide back after an invalid drop, a take-out, and the reset after a wrong word
    liftPx: 8,         // how far a grabbed letter lifts: size grows and its shadow moves away
    ease: 'original',  // key of EASINGS
    errorMs: 900       // "Not quite. Try again." stays on screen and the slots shake this long before the reset
  };
  var LIMITS = {
    snapPx:   { min: 20,  max: 90,   step: 1,  unit: 'px' },
    snapMs:   { min: 80,  max: 600,  step: 10, unit: 'ms' },
    returnMs: { min: 100, max: 900,  step: 10, unit: 'ms' },
    liftPx:   { min: 0,   max: 20,   step: 1,  unit: 'px' },
    errorMs:  { min: 500, max: 1500, step: 50, unit: 'ms' }
  };
  var LABELS = {
    snapPx: 'Snap distance', snapMs: 'Snap duration', returnMs: 'Return duration',
    liftPx: 'Drag lift', errorMs: 'Error feedback duration'
  };

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
  function spring(x) {                       // damped spring with a few overshoots
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return 1 - Math.exp(-5.5 * x) * Math.cos(2 * Math.PI * 1.6 * x);
  }
  var easeIn = bez(.42, 0, 1, 1), easeOut = bez(0, 0, .58, 1), easeInOut = bez(.42, 0, .58, 1);
  // "original" keeps the study's two curves: EASE_PLACE for gliding into a slot, EASE_BACK for going back.
  // Every other option is applied to both.
  var EASINGS = {
    original:  { label: 'Original',      snap: bez(.28, .1, .15, 1), back: bez(.4, .05, .3, 1) },
    linear:    { label: 'Linear',        snap: function (x) { return Math.min(1, Math.max(0, x)); }, back: null },
    easeIn:    { label: 'Ease In',       snap: easeIn,    back: null },
    easeOut:   { label: 'Ease Out',      snap: easeOut,   back: null },
    easeInOut: { label: 'Ease In-Out',   snap: easeInOut, back: null },
    spring:    { label: 'Spring/Bounce', snap: spring,    back: null }
  };
  Object.keys(EASINGS).forEach(function (k) { if (!EASINGS[k].back) EASINGS[k].back = EASINGS[k].snap; });

  var state = {}, listeners = [];
  Object.keys(DEFAULTS).forEach(function (k) { state[k] = DEFAULTS[k]; });

  function clamp(key, v) {
    var l = LIMITS[key];
    v = Math.round(Number(v));
    if (!isFinite(v)) return DEFAULTS[key];
    return Math.min(l.max, Math.max(l.min, v));
  }
  function get() { var o = {}; Object.keys(state).forEach(function (k) { o[k] = state[k]; }); return o; }
  function emit() { listeners.slice().forEach(function (fn) { fn(get()); }); }
  function set(patch) {
    Object.keys(patch).forEach(function (k) {
      if (LIMITS[k]) state[k] = clamp(k, patch[k]);
      else if (k === 'ease' && EASINGS[patch[k]]) state.ease = patch[k];
    });
    emit();
  }
  function restoreDefaults() { Object.keys(DEFAULTS).forEach(function (k) { state[k] = DEFAULTS[k]; }); emit(); }
  function onChange(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  var INSTRUCTION = 'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.';
  function settingsText() {
    var s = get();
    return [
      'Component: Letter Interaction Controls (Step 3 – find the word)',
      'Snap distance: ' + s.snapPx + ' px',
      'Snap duration: ' + s.snapMs + ' ms',
      'Return duration: ' + s.returnMs + ' ms',
      'Drag lift: ' + s.liftPx + ' px',
      'Easing: ' + EASINGS[s.ease].label,
      'Error feedback duration: ' + s.errorMs + ' ms',
      '',
      INSTRUCTION
    ].join('\n');
  }

  window.LetterMotion = {
    DEFAULTS: DEFAULTS, LIMITS: LIMITS, LABELS: LABELS, EASINGS: EASINGS,
    get: get, set: set, restoreDefaults: restoreDefaults, onChange: onChange,
    snapEase: function () { return EASINGS[state.ease].snap; },
    backEase: function () { return EASINGS[state.ease].back; },
    settingsText: settingsText
  };
})();

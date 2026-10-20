/* Top spin settings for step 4 (spin the top to enter the three-digit code).
   Single source of truth read live by scenes/scene4.js and edited by the "Top Spin Controls" panel (js/top-panel.js).
   DEFAULTS are the saved defaults; change them here to make new values the prototype's defaults. */
(function () {
  var DEFAULTS = {
    turnMs: 600,       // time one isolated full turn takes, start to stop
    confirmMs: 1000,   // pause (no tap, nothing left to spin) after which the round is confirmed
    popPx: 30,         // how high the revealed number rises above the top before it flies to its slot (scene px)
    feedbackMs: 800    // how long the number feedback lasts: pop up, then travel into the slot
  };
  var LIMITS = {
    turnMs:     { min: 200, max: 900,  step: 50, unit: 'ms' },
    confirmMs:  { min: 700, max: 1800, step: 50, unit: 'ms' },
    popPx:      { min: 10,  max: 60,   step: 1,  unit: 'px' },
    feedbackMs: { min: 400, max: 1200, step: 50, unit: 'ms' }
  };
  var LABELS = {
    turnMs: 'Turn duration', confirmMs: 'Pause to confirm', popPx: 'Number pop height', feedbackMs: 'Number feedback time'
  };
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
  function set(patch) { Object.keys(patch).forEach(function (k) { if (LIMITS[k]) state[k] = clamp(k, patch[k]); }); emit(); }
  function restoreDefaults() { Object.keys(DEFAULTS).forEach(function (k) { state[k] = DEFAULTS[k]; }); emit(); }
  function onChange(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  var INSTRUCTION = 'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.';
  function settingsText() {
    var s = get();
    return [
      'Component: Top Spin Controls (Step 4 – spin the top to enter the code)',
      'Turn duration: ' + s.turnMs + ' ms',
      'Pause to confirm: ' + s.confirmMs + ' ms',
      'Number pop height: ' + s.popPx + ' px',
      'Number feedback time: ' + s.feedbackMs + ' ms',
      '',
      INSTRUCTION
    ].join('\n');
  }

  window.TopMotion = { DEFAULTS: DEFAULTS, LIMITS: LIMITS, LABELS: LABELS, get: get, set: set, restoreDefaults: restoreDefaults, onChange: onChange, settingsText: settingsText };
})();

/* Top spin settings for step 4 (tap the top; each tap queues one full 360-degree turn).
   Single source of truth read every frame by scenes/scene4.js and edited by the "Top Spin Controls" panel
   (js/top-panel.js). DEFAULTS are the saved defaults; change them here to make new values the prototype's defaults. */
(function () {
  var DEFAULTS = {
    turnMs: 900,     // time one isolated full turn takes, start to stop
    easePct: 50,     // how much of that turn is spent speeding up and slowing down (0 = almost none, 100 = pure ease in/out)
    risePx: 30,      // how far the popped number rises (scene px, ~screen px at 100% size)
    popMs: 700,      // how long the popped number takes to rise and fade out
    sizePx: 36       // popped number font size (scene px)
  };
  var LIMITS = {
    turnMs:  { min: 300, max: 1500, step: 50, unit: 'ms' },
    easePct: { min: 0,   max: 100,  step: 5,  unit: '%' },
    risePx:  { min: 10,  max: 60,   step: 1,  unit: 'px' },
    popMs:   { min: 300, max: 1200, step: 50, unit: 'ms' },
    sizePx:  { min: 20,  max: 64,   step: 1,  unit: 'px' }
  };
  var LABELS = {
    turnMs: 'Turn duration', easePct: 'Start/stop easing strength', risePx: 'Number rise distance',
    popMs: 'Number display time', sizePx: 'Number size'
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
      'Component: Top Spin Controls (Step 4 – spin the top)',
      'Turn duration: ' + s.turnMs + ' ms',
      'Start/stop easing strength: ' + s.easePct + ' %',
      'Number rise distance: ' + s.risePx + ' px',
      'Number display time: ' + s.popMs + ' ms',
      'Number size: ' + s.sizePx + ' px',
      '',
      INSTRUCTION
    ].join('\n');
  }

  window.TopMotion = { DEFAULTS: DEFAULTS, LIMITS: LIMITS, LABELS: LABELS, get: get, set: set, restoreDefaults: restoreDefaults, onChange: onChange, settingsText: settingsText };
})();

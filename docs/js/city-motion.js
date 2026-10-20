/* City motion settings for Step 2 "Rotate the city".
   Single source of truth read by scenes/scene2.js at the moment each action starts, and edited by js/city-panel.js.
   DEFAULTS are the saved defaults: they equal the original study's behaviour. */
(function () {
  var DEFAULTS = {
    stepMs: 900,       // one 45-degree turn after a correct press (study: STEP_MS)
    returnMs: 1600,    // return to 0 degrees after a wrong press (study: RETURN_MS)
    ease: 'original'   // key of EASINGS
  };
  var LIMITS = {
    stepMs: { min: 300, max: 1800, step: 50, unit: 'ms' },
    returnMs: { min: 500, max: 2500, step: 50, unit: 'ms' }
  };

  // Damped spring with a few overshoots, as a CSS linear() easing (falls back to a single "back" overshoot).
  function springCss() {
    var pts = [], n = 48, i, t;
    for (i = 0; i <= n; i++) {
      t = i / n;
      pts.push(i === n ? 1 : 1 - Math.exp(-5.5 * t) * Math.cos(2 * Math.PI * 1.6 * t));
    }
    var css = 'linear(' + pts.map(function (v) { return +v.toFixed(4); }).join(', ') + ')';
    var ok = window.CSS && CSS.supports && CSS.supports('animation-timing-function', css);
    return ok ? css : 'cubic-bezier(.34,1.56,.64,1)';
  }
  var SPRING = springCss();

  // "original" keeps the study's two curves: HEAVY for turns, CONTROLLED for the return.
  // Every other option is applied to both the turn and the return.
  var EASINGS = {
    original:  { label: 'Original',    turn: 'cubic-bezier(.55,0,.3,1)', ret: 'cubic-bezier(.45,0,.25,1)' },
    linear:    { label: 'Linear',      turn: 'linear',                   ret: 'linear' },
    easeIn:    { label: 'Ease In',     turn: 'cubic-bezier(.42,0,1,1)',  ret: 'cubic-bezier(.42,0,1,1)' },
    easeOut:   { label: 'Ease Out',    turn: 'cubic-bezier(0,0,.58,1)',  ret: 'cubic-bezier(0,0,.58,1)' },
    easeInOut: { label: 'Ease In-Out', turn: 'cubic-bezier(.42,0,.58,1)', ret: 'cubic-bezier(.42,0,.58,1)' },
    spring:    { label: 'Spring/Bounce', turn: SPRING,                   ret: SPRING }
  };

  var state = { stepMs: DEFAULTS.stepMs, returnMs: DEFAULTS.returnMs, ease: DEFAULTS.ease };
  var listeners = [];

  function clamp(key, v) {
    var l = LIMITS[key];
    v = Math.round(Number(v));
    if (!isFinite(v)) return DEFAULTS[key];
    return Math.min(l.max, Math.max(l.min, v));
  }
  function emit() { listeners.slice().forEach(function (fn) { fn(get()); }); }
  function get() { return { stepMs: state.stepMs, returnMs: state.returnMs, ease: state.ease }; }

  function set(patch) {
    if (patch.stepMs !== undefined) state.stepMs = clamp('stepMs', patch.stepMs);
    if (patch.returnMs !== undefined) state.returnMs = clamp('returnMs', patch.returnMs);
    if (patch.ease !== undefined && EASINGS[patch.ease]) state.ease = patch.ease;
    emit();
  }
  function restoreDefaults() {
    state.stepMs = DEFAULTS.stepMs;
    state.returnMs = DEFAULTS.returnMs;
    state.ease = DEFAULTS.ease;
    emit();
  }
  function onChange(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  var INSTRUCTION = 'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.';

  function settingsText() {
    var s = get(), e = EASINGS[s.ease];
    var easeLine = 'Turn easing: ' + e.label;
    if (s.ease === 'original') easeLine += ' (turn ' + e.turn + ', return ' + e.ret + ')';
    return [
      'Component: City Motion Controls (Step 2 – Rotate the city)',
      'Turn duration: ' + s.stepMs + ' ms',
      'Return duration after a wrong input: ' + s.returnMs + ' ms',
      easeLine,
      '',
      INSTRUCTION
    ].join('\n');
  }

  window.CityMotion = {
    DEFAULTS: DEFAULTS, LIMITS: LIMITS, EASINGS: EASINGS,
    get: get, set: set, restoreDefaults: restoreDefaults, onChange: onChange,
    turnEase: function () { return EASINGS[state.ease].turn; },
    returnEase: function () { return EASINGS[state.ease].ret; },
    settingsText: settingsText
  };
})();

/* "Top Spin Controls": the step 4 tuning panel (generic panel in tuning-panel.js).
   Mounted by scenes/scene4.js and removed when the step is destroyed, so it only exists on step 4.
   To remove it later, delete the TopPanel.mount(...) call in scene4.js. */
(function () {
  var M = window.TopMotion, L = M.LIMITS, T = M.LABELS;
  function f(key, id) { return { key: key, id: id, label: T[key], min: L[key].min, max: L[key].max, step: L[key].step, unit: L[key].unit }; }
  window.TopPanel = {
    mount: function () {
      return TuningPanel.mount({
        title: 'Top Spin Controls',
        model: M,
        fields: [f('turnMs', 'tp-turn'), f('easePct', 'tp-ease'), f('risePx', 'tp-rise'), f('popMs', 'tp-pop'), f('sizePx', 'tp-size')]
      });
    }
  };
})();

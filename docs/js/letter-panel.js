/* "Letter Interaction Controls": the step 3 tuning panel (generic panel in tuning-panel.js).
   Mounted by scenes/scene3.js and removed when the step is destroyed, so it only exists on step 3.
   To remove it later, delete the LetterPanel.mount(...) call in scene3.js. */
(function () {
  var M = window.LetterMotion, L = M.LIMITS, T = M.LABELS;
  function f(key, id) { return { key: key, id: id, label: T[key], min: L[key].min, max: L[key].max, step: L[key].step, unit: L[key].unit }; }
  window.LetterPanel = {
    mount: function () {
      return TuningPanel.mount({
        title: 'Letter Interaction Controls',
        model: M,
        fields: [f('snapPx', 'lp-snap-px'), f('snapMs', 'lp-snap-ms'), f('returnMs', 'lp-return'), f('liftPx', 'lp-lift'), f('errorMs', 'lp-error')],
        easing: {
          key: 'ease', id: 'lp-ease', label: 'Easing',
          options: Object.keys(M.EASINGS).map(function (k) { return [k, M.EASINGS[k].label]; })
        }
      });
    }
  };
})();

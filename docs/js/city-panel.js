/* "City Motion Controls": the step 2 tuning panel (see tuning-panel.js for the generic panel).
   Mounted by scenes/scene2.js and removed when the step is destroyed, so it only exists on step 2.
   To remove it later, delete the CityPanel.mount(...) call in scene2.js.
   controller = { replay(): bool, canReplay(): bool }  ->  returns { refresh(), destroy() } */
(function () {
  var M = window.CityMotion;
  var L = M.LIMITS;
  window.CityPanel = {
    mount: function (controller) {
      return TuningPanel.mount({
        title: 'City Motion Controls',
        model: M,
        fields: [
          { key: 'stepMs', id: 'cp-step', label: 'Turn duration', min: L.stepMs.min, max: L.stepMs.max, step: L.stepMs.step, unit: 'ms' },
          { key: 'returnMs', id: 'cp-return', label: 'Return duration after wrong input', min: L.returnMs.min, max: L.returnMs.max, step: L.returnMs.step, unit: 'ms' }
        ],
        easing: {
          key: 'ease', id: 'cp-ease', label: 'Turn easing',
          options: Object.keys(M.EASINGS).map(function (k) { return [k, M.EASINGS[k].label]; })
        },
        buttons: [{
          id: 'cp-replay', label: 'Replay turn',
          run: function () { return controller.replay() ? 'Previewing one turn…' : false; },
          enabled: function () { return controller.canReplay(); }
        }]
      });
    }
  };
})();

/* "City Motion Controls": floating, collapsible tuning panel for Step 2.
   Mounted by scenes/scene2.js and removed when the step is destroyed (so it only exists on step 2).
   To remove it later, delete the CityPanel.mount(...) call in scene2.js; nothing else depends on this file.

   controller = {
     replay():  bool   preview one turn without touching puzzle progress (false if not allowed right now)
     canReplay(): bool whether a preview may start now
   }
   returns { refresh(), destroy() } */
(function () {
  var M = window.CityMotion;
  var collapsedPref = null;   // remembered for the page session; null = decide from screen size

  function isSmall() { return window.matchMedia('(max-width: 860px)').matches; }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  window.CityPanel = {
    mount: function (controller) {
      var L = M.LIMITS;
      var root = el('aside', 'city-panel');
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', 'City Motion Controls');

      var easeOptions = Object.keys(M.EASINGS).map(function (k) {
        return '<option value="' + k + '">' + M.EASINGS[k].label + '</option>';
      }).join('');

      root.innerHTML =
        '<button class="cp-toggle" type="button" aria-expanded="true" aria-controls="cp-body">' +
          '<span class="cp-title">City Motion Controls</span>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="cp-body" id="cp-body">' +
          '<div class="cp-field">' +
            '<label for="cp-step">Turn duration <output id="cp-step-out" for="cp-step"></output></label>' +
            '<input id="cp-step" type="range" min="' + L.stepMs.min + '" max="' + L.stepMs.max + '" step="' + L.stepMs.step + '">' +
            '<span class="cp-range"><i>' + L.stepMs.min + '</i><i>' + L.stepMs.max + ' ms</i></span>' +
          '</div>' +
          '<div class="cp-field">' +
            '<label for="cp-return">Return duration after wrong input <output id="cp-return-out" for="cp-return"></output></label>' +
            '<input id="cp-return" type="range" min="' + L.returnMs.min + '" max="' + L.returnMs.max + '" step="' + L.returnMs.step + '">' +
            '<span class="cp-range"><i>' + L.returnMs.min + '</i><i>' + L.returnMs.max + ' ms</i></span>' +
          '</div>' +
          '<div class="cp-field">' +
            '<label for="cp-ease">Turn easing</label>' +
            '<select id="cp-ease">' + easeOptions + '</select>' +
          '</div>' +
          '<div class="cp-actions">' +
            '<button class="cp-btn" id="cp-replay" type="button">Replay turn</button>' +
            '<button class="cp-btn" id="cp-restore" type="button">Restore defaults</button>' +
            '<button class="cp-btn cp-wide" id="cp-copy" type="button">Copy settings</button>' +
          '</div>' +
          '<p class="cp-note" id="cp-note" role="status" aria-live="polite"></p>' +
        '</div>';

      document.body.appendChild(root);
      document.body.classList.add('has-city-panel');

      var $ = function (id) { return root.querySelector('#' + id); };
      var toggle = root.querySelector('.cp-toggle');
      var stepIn = $('cp-step'), stepOut = $('cp-step-out');
      var retIn = $('cp-return'), retOut = $('cp-return-out');
      var easeSel = $('cp-ease');
      var replayBtn = $('cp-replay'), restoreBtn = $('cp-restore'), copyBtn = $('cp-copy');
      var note = $('cp-note');
      var noteTimer = 0;

      function say(msg) {
        note.textContent = msg;
        clearTimeout(noteTimer);
        noteTimer = setTimeout(function () { note.textContent = ''; }, 2600);
      }

      function render(s) {
        stepIn.value = s.stepMs;   stepOut.textContent = s.stepMs + ' ms';
        retIn.value = s.returnMs;  retOut.textContent = s.returnMs + ' ms';
        easeSel.value = s.ease;
      }
      function refresh() { replayBtn.disabled = !controller.canReplay(); }

      var offChange = M.onChange(render);
      render(M.get());
      refresh();

      stepIn.addEventListener('input', function () { M.set({ stepMs: stepIn.value }); });
      retIn.addEventListener('input', function () { M.set({ returnMs: retIn.value }); });
      easeSel.addEventListener('change', function () { M.set({ ease: easeSel.value }); });

      replayBtn.addEventListener('click', function () {
        if (!controller.replay()) say('Replay is not available right now.');
        else say('Previewing one turn…');
      });
      restoreBtn.addEventListener('click', function () { M.restoreDefaults(); say('Defaults restored.'); });

      function legacyCopy(text) {
        var ta = el('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        ta.remove();
        return ok;
      }
      copyBtn.addEventListener('click', function () {
        var text = M.settingsText();
        var done = function () { say('Settings copied.'); };
        var fail = function () { say(legacyCopy(text) ? 'Settings copied.' : 'Copy failed — select and copy manually.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
        else fail();
      });

      // collapse / expand; also reserves layout space so the panel never covers the paper
      function reserve() {
        document.documentElement.style.setProperty('--cp-bottom', Math.ceil(root.getBoundingClientRect().height + 8) + 'px');
      }
      function setCollapsed(c) {
        collapsedPref = c;
        root.classList.toggle('is-collapsed', c);
        document.body.classList.toggle('city-panel-open', !c);
        toggle.setAttribute('aria-expanded', String(!c));
        reserve();
      }
      toggle.addEventListener('click', function () { setCollapsed(!root.classList.contains('is-collapsed')); });
      setCollapsed(collapsedPref === null ? isSmall() : collapsedPref);

      var ro = window.ResizeObserver ? new ResizeObserver(reserve) : null;
      if (ro) ro.observe(root);
      window.addEventListener('resize', reserve);

      return {
        refresh: refresh,
        destroy: function () {
          clearTimeout(noteTimer);
          offChange();
          if (ro) ro.disconnect();
          window.removeEventListener('resize', reserve);
          root.remove();
          document.body.classList.remove('has-city-panel', 'city-panel-open');
          document.documentElement.style.removeProperty('--cp-bottom');
        }
      };
    }
  };
})();

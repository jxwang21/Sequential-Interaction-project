/* Generic floating, collapsible tuning panel used by "City Motion Controls" (step 2) and
   "Letter Interaction Controls" (step 3). It only renders controls and talks to a settings model;
   the scene reads the model when each action starts.

   TuningPanel.mount({
     title,                                   panel name
     model,                                   { get, set(patch), restoreDefaults, onChange(fn)->off, settingsText }
     fields:  [{ key, id, label, min, max, step, unit }]     range sliders
     easing:  { key, id, label, options: [[value, label], ...] }
     buttons: [{ id, label, run(): bool|string, enabled(): bool }]   extra buttons before Restore/Copy
   }) -> { refresh(), destroy() }
   The collapsed/expanded choice is remembered for the page session. */
(function () {
  var collapsedPref = null;

  function isSmall() { return window.matchMedia('(max-width: 860px)').matches; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  window.TuningPanel = {
    mount: function (cfg) {
      var M = cfg.model;
      var root = document.createElement('aside');
      root.className = 'city-panel';
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', cfg.title);

      var fields = cfg.fields.map(function (f) {
        return '<div class="cp-field">' +
          '<label for="' + f.id + '">' + esc(f.label) + ' <output id="' + f.id + '-out" for="' + f.id + '"></output></label>' +
          '<input id="' + f.id + '" type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '">' +
          '<span class="cp-range"><i>' + f.min + '</i><i>' + f.max + ' ' + esc(f.unit) + '</i></span>' +
        '</div>';
      }).join('');
      var e = cfg.easing;
      var easeField = '<div class="cp-field cp-span">' +
        '<label for="' + e.id + '">' + esc(e.label) + '</label>' +
        '<select id="' + e.id + '">' + e.options.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
      '</div>';
      var buttons = (cfg.buttons || []).map(function (b) {
        return '<button class="cp-btn" id="' + b.id + '" type="button">' + esc(b.label) + '</button>';
      }).join('');

      root.innerHTML =
        '<button class="cp-toggle" type="button" aria-expanded="true" aria-controls="cp-body">' +
          '<span class="cp-title">' + esc(cfg.title) + '</span>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="cp-body" id="cp-body">' + fields + easeField +
          '<div class="cp-actions">' + buttons +
            '<button class="cp-btn" id="cp-restore" type="button">Restore defaults</button>' +
            '<button class="cp-btn cp-wide" id="cp-copy" type="button">Copy settings</button>' +
          '</div>' +
          '<p class="cp-note" id="cp-note" role="status" aria-live="polite"></p>' +
        '</div>';

      document.body.appendChild(root);
      document.body.classList.add('has-city-panel');

      var $ = function (id) { return root.querySelector('#' + id); };
      var toggle = root.querySelector('.cp-toggle');
      var easeSel = $(e.id), note = $('cp-note'), noteTimer = 0;

      function say(msg) {
        note.textContent = msg;
        clearTimeout(noteTimer);
        noteTimer = setTimeout(function () { note.textContent = ''; }, 2600);
      }
      function render(s) {
        cfg.fields.forEach(function (f) {
          $(f.id).value = s[f.key];
          $(f.id + '-out').textContent = s[f.key] + ' ' + f.unit;
        });
        easeSel.value = s[e.key];
      }
      function refresh() {
        (cfg.buttons || []).forEach(function (b) { if (b.enabled) $(b.id).disabled = !b.enabled(); });
      }

      var offChange = M.onChange(render);
      render(M.get());
      refresh();

      cfg.fields.forEach(function (f) {
        $(f.id).addEventListener('input', function () { var p = {}; p[f.key] = $(f.id).value; M.set(p); });
      });
      easeSel.addEventListener('change', function () { var p = {}; p[e.key] = easeSel.value; M.set(p); });

      (cfg.buttons || []).forEach(function (b) {
        $(b.id).addEventListener('click', function () {
          var r = b.run();
          if (r === false) say('Not available right now.');
          else if (typeof r === 'string') say(r);
        });
      });
      $('cp-restore').addEventListener('click', function () { M.restoreDefaults(); say('Defaults restored.'); });

      function legacyCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) {}
        ta.remove();
        return ok;
      }
      $('cp-copy').addEventListener('click', function () {
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
        say: say,
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

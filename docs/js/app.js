/* Sequence controller.
   One persistent paper (#paper) with progress, hint, status row and stamps. Only the contents of #scene-host
   are swapped. Each step is a scene from js/scenes/sceneN.js with the contract:
     Scenes[n].html                     markup for the step (inserted only when the step starts)
     Scenes[n].mount({complete})        starts it; returns { destroy() }
   A scene calls complete() once its own success feedback has finished playing. */
(function () {
  var TOTAL = 4;
  var HINTS = [
    'Read the clock, then press the frames in the matching order.',
    'Follow the route clue with the direction pad.',
    'Drag five letters into the slots to form the word.',
    'Tap to spin. Pause to reveal each number.'
  ];
  var COMPLETED_HOLD = 1100;   // "Completed" is shown this long before the next step takes over
  var FADE_OUT = 380;
  var FADE_IN_DELAY = 40;
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  var paper = document.getElementById('paper');
  var host = document.getElementById('scene-host');
  var label = document.getElementById('step-label');
  var hint = document.getElementById('hint');
  var status = document.getElementById('status');
  var endingText = document.getElementById('ending-text');
  var again = document.getElementById('again');
  var progress = Array.prototype.slice.call(document.querySelectorAll('#progress li'));
  var stamps = Array.prototype.slice.call(document.querySelectorAll('#stamps .stamp'));

  var gen = 0;          // bumped on every (re)start so stale callbacks from old runs are ignored
  var index = 0;        // 0-based current step
  var phase = 'playing';
  var current = null;   // mounted scene instance
  var timers = [];
  var awakeRun = null;   // the running eye animation (intro or finale), if any
  var PREVIEW = /(^|[#&])awake($|&)/.test(location.hash);    // index.html#awake opens on the finale of step 4
  var NO_INTRO = /[?&]nointro(&|=|$)/.test(location.search);   // index.html?nointro skips the opening animation

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function setPhase(p) { phase = p; paper.setAttribute('data-phase', p); }
  function setStatus(mode) {
    status.setAttribute('data-mode', mode);
    again.tabIndex = mode === 'ended' ? 0 : -1;
  }

  function renderProgress() {
    progress.forEach(function (li, i) {
      var state = phase === 'ended' || i < index ? 'done' : (i === index ? 'current' : 'locked');
      li.setAttribute('data-state', state);
      if (state === 'current') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      var node = li.querySelector('.node');
      node.innerHTML = state === 'done' ? CHECK : '<b>' + (i + 1) + '</b>';
      li.querySelector('.sr').textContent = 'Step ' + (i + 1) + ', ' + (state === 'done' ? 'completed' : state);
    });
  }

  function renderHeader() {
    label.textContent = 'Step ' + (index + 1) + ' of ' + TOTAL;
    paper.setAttribute('data-step', String(index + 1));
    hint.textContent = phase === 'ended' ? 'All four steps are stamped.' : HINTS[index];
    renderProgress();
  }

  function destroyScene() {
    if (current && current.destroy) current.destroy();
    current = null;
    host.innerHTML = '';
  }

  function mountStep(i, myGen) {
    var def = window.Scenes[i + 1];
    destroyScene();
    index = i;
    setPhase('playing');
    setStatus('none');
    renderHeader();

    var root = document.createElement('div');
    root.className = 'scene-root s' + (i + 1);
    root.innerHTML = def.html;
    host.appendChild(root);

    var done = false;
    current = def.mount({
      complete: function () {
        if (done || myGen !== gen || phase !== 'playing') return;
        done = true;
        onComplete(i, myGen);
      }
    });

    // fade the new step in on the same paper
    host.classList.add('is-out');
    void host.offsetWidth;
    later(function () { host.classList.remove('is-out'); }, FADE_IN_DELAY);
  }

  function onComplete(i, myGen) {
    setPhase('completing');
    stamps[i].classList.add('on');
    stamps[i].setAttribute('aria-label', 'Step ' + (i + 1) + ' stamp, earned');
    setStatus('completed');

    later(function () {
      if (myGen !== gen) return;
      if (i < TOTAL - 1) {
        setPhase('transition');
        setStatus('none');
        host.classList.add('is-out');
        later(function () {
          if (myGen !== gen) return;
          mountStep(i + 1, myGen);
        }, FADE_OUT);
      } else {
        // last step: the eye opens and the paper lights up (js/awake.js), then the ending
        setPhase('awakening');
        setStatus('none');
        hint.textContent = '';
        awakeRun = window.Awake.play(paper, {
          mode: 'finale',
          onDone: function () {
            awakeRun = null;
            if (myGen !== gen) return;
            setPhase('ended');
            renderHeader();
            endingText.textContent = 'All steps completed';
            setStatus('ended');
          }
        });
      }
    }, COMPLETED_HOLD);
  }

  function cancelAwake() {
    if (awakeRun) { awakeRun.cancel(); awakeRun = null; }
    host.inert = false;
    paper.classList.remove('awake');
  }

  // the opening: the paper is dark, a thread of light breathes like someone asleep, then step 1 appears
  function playIntro(myGen) {
    setPhase('intro');
    host.inert = true;                 // step 1 cannot be used until the light has spread
    awakeRun = window.Awake.play(paper, {
      mode: 'intro',
      onDone: function () {
        awakeRun = null;
        host.inert = false;
        if (myGen !== gen) return;
        setPhase('playing');
      }
    });
  }

  function start(opts) {
    opts = opts || {};
    gen++;
    clearTimers();
    cancelAwake();
    destroyScene();
    stamps.forEach(function (s, k) {
      s.classList.remove('on');
      s.setAttribute('aria-label', 'Step ' + (k + 1) + ' stamp, not yet earned');
    });
    if (opts.preview) {
      for (var k = 0; k < 3; k++) { stamps[k].classList.add('on'); stamps[k].setAttribute('aria-label', 'Step ' + (k + 1) + ' stamp, earned'); }
      window.__awakePreview = true;    // step 4 enters the code by itself and completes
      mountStep(3, gen);
    } else {
      mountStep(0, gen);
      if (opts.intro) playIntro(gen);
    }
  }

  document.getElementById('restart').addEventListener('click', function () { start(); });
  again.addEventListener('click', function () { start(); });

  start({ intro: !PREVIEW && !NO_INTRO, preview: PREVIEW });
})();

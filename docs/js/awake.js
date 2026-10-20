/* The eye animation that opens and closes the experience. One eye, two modes:

   intro   (page load)    The paper is dark. A thread of brass light appears and breathes twice, like someone asleep.
                          The light spreads, the darkness lifts and step 1 appears. The eye never opens.
   finale  (after step 4) The paper dims again, the thread of light breathes, the eyelid opens slowly (the same eye as the
                          third frame of step 1), the iris catches the light, the pupil contracts, a flood of light washes
                          over the paper and the paper stays lit.

   Awake.play(paperElement, { mode: 'intro' | 'finale', onDone }) -> { cancel() }
   - one requestAnimationFrame loop, removed together with the overlay
   - clicking the paper skips ahead (the intro overlay blocks the paper; the finale overlay lets the Restart button through)
   - prefers-reduced-motion: no animation; the intro just ends, the finale just lights the paper
   All timings are in the TIMELINES table below (milliseconds). */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var PI = Math.PI;
  var NEVER = [1e9, 1e9 + 1];

  var TIMELINES = {
    intro: {
      total: 3500, skipTo: 2500,
      dimIn: [-1, 0],            // dark from the very first frame
      seam: [300, 1000],         // the thread of light grows across
      breath1: [1000, 1600],     // two slow breaths of the sleeping eye
      breath2: [1600, 2200],
      open: NEVER, gaze: NEVER, pupil: NEVER,
      bloom: [2300, 3300], bloomAmp: 0.5,
      rays: NEVER, raysOut: NEVER,
      dimOut: [2300, 3400],      // darkness lifts, step 1 is there
      eyeFade: [2500, 3300],
      paperLit: null
    },
    finale: {
      total: 5000, skipTo: 4300,
      dimIn: [0, 700],           // darkness closes in
      seam: [500, 1300],
      breath1: [1300, 1800],
      breath2: [1800, 2300],
      open: [2300, 3700],        // the eyelid opens
      gaze: [2600, 3900],        // drowsy glance down-left settles to the centre
      pupil: [3200, 4200],       // pupil contracts in the light
      bloom: [3300, 4500], bloomAmp: 0.92,
      rays: [3200, 3800], raysOut: [4300, 5000],
      dimOut: [3700, 4700],
      eyeFade: [4200, 4900],
      paperLit: 3900             // the paper keeps a warm light from here on
    }
  };

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, r) { return clamp01((t - r[0]) / (r[1] - r[0])); }
  function outCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function inOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function outBack(x) { var c1 = 1.1, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var uid = 0;

  window.Awake = {
    play: function (paper, opts) {
      opts = opts || {};
      var mode = opts.mode === 'intro' ? 'intro' : 'finale';
      var T = TIMELINES[mode];
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        if (mode === 'finale') paper.classList.add('awake');
        var tm = setTimeout(function () { if (opts.onDone) opts.onDone(); }, mode === 'intro' ? 0 : 500);
        return { cancel: function () { clearTimeout(tm); } };
      }

      var id = 'aw' + (++uid) + '-';
      var root = document.createElement('div');
      root.className = 'awake ' + mode;
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML =
        '<div class="awake-dim"></div>' +
        '<div class="awake-bloom"></div>' +
        '<svg class="awake-svg" viewBox="0 0 480 300" fill="none">' +
          '<defs>' +
            '<radialGradient id="' + id + 'sclera" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#4a463d"/><stop offset=".6" stop-color="#262522"/><stop offset="1" stop-color="#0f0f10"/></radialGradient>' +
            '<radialGradient id="' + id + 'iris" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1b1307"/><stop offset=".34" stop-color="#6e5019"/><stop offset=".55" stop-color="#c9a24e"/><stop offset=".72" stop-color="#ecd08a"/><stop offset=".86" stop-color="#9a7630"/><stop offset="1" stop-color="#3f2d0e"/></radialGradient>' +
            '<radialGradient id="' + id + 'glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f3dea6" stop-opacity=".6"/><stop offset=".5" stop-color="#d6b266" stop-opacity=".2"/><stop offset="1" stop-color="#d6b266" stop-opacity="0"/></radialGradient>' +
            '<linearGradient id="' + id + 'shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".78"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
            '<filter id="' + id + 'blur" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="5"/></filter>' +
            '<clipPath id="' + id + 'clip"><path class="aw-clip" d=""/></clipPath>' +
          '</defs>' +
        '</svg>';
      var svg = root.querySelector('svg');
      var dim = root.querySelector('.awake-dim');
      var bloom = root.querySelector('.awake-bloom');
      var clipPath = root.querySelector('.aw-clip');
      if (mode === 'intro') dim.style.opacity = 1;                 // no flash of the paper before the first frame

      var glowG = mk('g', {}, svg);
      var glow = mk('ellipse', { cx: 240, cy: 150, rx: 250, ry: 140, fill: 'url(#' + id + 'glow)', opacity: 0 }, glowG);
      var rays = mk('g', { opacity: 0 }, svg);
      for (var r = 0; r < 18; r++) {
        mk('line', { x1: 240, y1: 150 - 96, x2: 240, y2: 150 - (210 + (r % 3) * 46), stroke: '#f3dea6', 'stroke-width': r % 2 ? 1 : 1.8, 'stroke-linecap': 'round', transform: 'rotate(' + (r * 20) + ' 240 150)', opacity: r % 2 ? 0.45 : 0.8 }, rays);
      }
      var eye = mk('g', {}, svg);
      var inside = mk('g', { 'clip-path': 'url(#' + id + 'clip)' }, eye);
      mk('rect', { x: 70, y: 30, width: 340, height: 200, fill: 'url(#' + id + 'sclera)' }, inside);
      var iris = mk('g', {}, inside);
      mk('circle', { cx: 240, cy: 150, r: 62, fill: 'url(#' + id + 'iris)' }, iris);
      for (var f = 0; f < 44; f++) {
        var a = f / 44 * PI * 2, r0 = 24 + (f % 3) * 4, r1 = 52 + (f % 5) * 2;
        mk('line', { x1: 240 + Math.cos(a) * r0, y1: 150 + Math.sin(a) * r0, x2: 240 + Math.cos(a) * r1, y2: 150 + Math.sin(a) * r1, stroke: f % 2 ? '#fff0c2' : '#5b4214', 'stroke-width': 0.8, opacity: f % 2 ? 0.22 : 0.35 }, iris);
      }
      mk('circle', { cx: 240, cy: 150, r: 61, stroke: 'rgba(0,0,0,.65)', 'stroke-width': 4 }, iris);
      var pupil = mk('circle', { cx: 240, cy: 150, r: 31, fill: '#050403' }, iris);
      mk('ellipse', { cx: 218, cy: 126, rx: 10, ry: 6, fill: '#fff', opacity: 0.8, transform: 'rotate(-28 218 126)' }, iris);
      mk('circle', { cx: 264, cy: 168, r: 3.4, fill: '#fff', opacity: 0.45 }, iris);
      var shade = mk('rect', { x: 70, y: 30, width: 340, height: 120, fill: 'url(#' + id + 'shade)', opacity: 0 }, inside);
      var seamGlow = mk('path', { stroke: '#f3dea6', 'stroke-width': 7, opacity: 0, filter: 'url(#' + id + 'blur)' }, eye);
      var lidLow = mk('path', { stroke: '#c9a24e', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0 }, eye);
      var crease = mk('path', { stroke: '#8c6a2a', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0 }, eye);
      var lidUp = mk('path', { stroke: '#f3dea6', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0 }, eye);

      var motes = mk('g', {}, svg), mote = [], m;
      for (m = 0; m < 26; m++) {
        var c = mk('circle', { r: 0.8 + Math.random() * 1.9, fill: m % 3 ? '#f3dea6' : '#fff6d6', opacity: 0 }, motes);
        mote.push({ el: c, x: 30 + Math.random() * 420, y: 120 + Math.random() * 200, sp: 0.016 + Math.random() * 0.03, ph: Math.random() * 6, t0: T.bloom[0] + Math.random() * 1100 });
      }

      paper.appendChild(root);

      var t0 = performance.now(), raf = 0, finished = false, lit = false;

      function lids(o) {
        var uy = 150 - 118 * o, ly = 150 + 74 * o;
        var up = 'M90 150 C130 ' + uy.toFixed(2) + ' 350 ' + uy.toFixed(2) + ' 390 150';
        var low = 'M90 150 C130 ' + ly.toFixed(2) + ' 350 ' + ly.toFixed(2) + ' 390 150';
        lidUp.setAttribute('d', up);
        lidLow.setAttribute('d', low);
        seamGlow.setAttribute('d', up);
        clipPath.setAttribute('d', up + ' C350 ' + ly.toFixed(2) + ' 130 ' + ly.toFixed(2) + ' 90 150 Z');
        crease.setAttribute('d', 'M104 ' + (150 - 8 * o).toFixed(2) + ' C146 ' + (150 - 134 * o).toFixed(2) + ' 334 ' + (150 - 134 * o).toFixed(2) + ' 376 ' + (150 - 8 * o).toFixed(2));
      }

      function frame(now) {
        raf = 0;
        var t = now - t0;
        if (t >= T.total) { finish(); return; }

        // eyelid: two breaths while closed; in the finale the lid then lifts (a tiny overshoot, then settles)
        var breath = 0.05 * Math.sin(PI * seg(t, T.breath1)) + 0.085 * Math.sin(PI * seg(t, T.breath2));
        var lid = Math.min(1.03, outBack(inOutCubic(seg(t, T.open))));
        var o = Math.max(breath, lid);
        lids(o);

        var seam = outCubic(seg(t, T.seam));
        var tr = 'translate(240 150) scale(' + Math.max(0.001, seam).toFixed(4) + ' 1) translate(-240 -150)';
        lidUp.setAttribute('transform', tr); lidLow.setAttribute('transform', tr); seamGlow.setAttribute('transform', tr);
        lidUp.setAttribute('opacity', seam > 0 ? 1 : 0);
        lidLow.setAttribute('opacity', (0.15 + 0.7 * clamp01(o * 3)).toFixed(3));
        crease.setAttribute('opacity', (0.7 * clamp01((o - 0.3) / 0.7)).toFixed(3));
        seamGlow.setAttribute('opacity', (seam * (0.55 + 0.9 * (breath / 0.085)) * (1 - 0.6 * clamp01(o))).toFixed(3));
        shade.setAttribute('opacity', (0.85 * clamp01(o)).toFixed(3));

        // iris: a drowsy glance down-left settles to the centre; the pupil contracts in the light
        var g = outCubic(seg(t, T.gaze));
        iris.setAttribute('transform', 'translate(' + (-18 * (1 - g)).toFixed(2) + ' ' + (12 * (1 - g)).toFixed(2) + ')');
        pupil.setAttribute('r', lerp(31, 16, smooth(seg(t, T.pupil))).toFixed(2));

        // light: halo behind the eye, flood over the paper, rays
        var bl = Math.pow(Math.sin(PI * seg(t, T.bloom)), 1.3);
        glow.setAttribute('opacity', (0.12 * seam + 0.3 * clamp01(o) + 0.55 * bl).toFixed(3));
        glow.setAttribute('transform', 'translate(240 150) scale(' + (0.85 + 0.4 * clamp01(o) + 0.5 * bl).toFixed(3) + ') translate(-240 -150)');
        bloom.style.opacity = (bl * T.bloomAmp).toFixed(3);
        bloom.style.transform = 'translate(-50%,-50%) scale(' + (0.5 + 1.1 * seg(t, T.bloom)).toFixed(3) + ')';
        var ro = smooth(seg(t, T.rays)) * (1 - smooth(seg(t, T.raysOut))) * 0.5;
        rays.setAttribute('opacity', ro.toFixed(3));
        rays.setAttribute('transform', 'rotate(' + ((t - 3200) * 0.012).toFixed(2) + ' 240 150)');

        // darkness: closes in (finale) or is there from the start (intro), lifts once the light has spread
        dim.style.opacity = (outCubic(seg(t, T.dimIn)) * (1 - smooth(seg(t, T.dimOut)))).toFixed(3);

        // the eye dissolves into the light
        var ef = smooth(seg(t, T.eyeFade));
        eye.setAttribute('opacity', (1 - ef).toFixed(3));
        eye.setAttribute('transform', 'translate(240 150) scale(' + (1 + 0.14 * ef).toFixed(3) + ') translate(-240 -150)');

        // dust in the light
        mote.forEach(function (mm) {
          var age = t - mm.t0;
          if (age < 0) { mm.el.setAttribute('opacity', 0); return; }
          var life = clamp01(age / 1500);
          mm.el.setAttribute('cx', (mm.x + Math.sin(mm.ph + age * 0.0018) * 10).toFixed(1));
          mm.el.setAttribute('cy', (mm.y - age * mm.sp * 7).toFixed(1));
          mm.el.setAttribute('opacity', (Math.sin(PI * life) * 0.7).toFixed(3));
        });

        if (T.paperLit !== null && !lit && t >= T.paperLit) { lit = true; paper.classList.add('awake'); }
        raf = requestAnimationFrame(frame);
      }

      function onSkip(e) {
        if (mode === 'finale' && e.target.closest && e.target.closest('button')) return;
        var t = performance.now() - t0;
        if (t < T.skipTo) t0 -= (T.skipTo - t);
      }
      paper.addEventListener('click', onSkip);

      function cleanup() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        paper.removeEventListener('click', onSkip);
        root.remove();
      }
      function finish() {
        if (finished) return;
        finished = true;
        if (mode === 'finale') paper.classList.add('awake');
        cleanup();
        if (opts.onDone) opts.onDone();
      }

      raf = requestAnimationFrame(frame);
      return { cancel: function () { finished = true; cleanup(); } };
    }
  };
})();

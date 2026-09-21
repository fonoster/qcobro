// QCobro marketing site v3. No framework, no build step.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Ad attribution ───
  // Meta fills these into the ad's URL at click time (ad_id={{ad.id}}&…). Kept
  // for the visit in sessionStorage, since the visitor may browse before opening
  // the pilot form, and sent with the submission so a lead in the sheet can be
  // traced to the ad that brought it. sessionStorage, not localStorage: a
  // visitor who returns directly next week applied organically.
  var AD_PARAMS = ['ad_id', 'adset_id', 'campaign_id', 'ad_name', 'adset_name', 'campaign_name',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var AD_KEY = 'qcobro:ad-attribution';
  function readAttribution() {
    try { return JSON.parse(sessionStorage.getItem(AD_KEY)) || {}; } catch (e) { return {}; }
  }
  (function captureAttribution() {
    var params = new URLSearchParams(window.location.search);
    var found = {};
    AD_PARAMS.forEach(function (k) { var v = params.get(k); if (v) found[k] = v.slice(0, 200); });
    // Only a new ad click replaces what the visit already carries.
    if (!found.ad_id && !found.utm_source) return;
    try { sessionStorage.setItem(AD_KEY, JSON.stringify(found)); } catch (e) { /* private mode */ }
  })();

  if (window.lucide) window.lucide.createIcons();

  // ─── Nav: hairline once the page scrolls ───
  var nav = document.getElementById('nav');
  function onScroll() { nav.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ─── Reveal on first view ───
  function onFirstView(el, cb, margin) {
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); }
      });
    }, { rootMargin: margin || '0px 0px -12% 0px' });
    io.observe(el);
  }

  document.querySelectorAll('.reveal').forEach(function (el) {
    onFirstView(el, function (t) { t.classList.add('is-in'); });
  });

  // Staggered one-shot group: the channel ladder.
  function stagger(root, selector, stepMs, startMs) {
    if (!root || reduceMotion) return;
    root.classList.add('is-staged');
    onFirstView(root, function () {
      root.querySelectorAll(selector).forEach(function (el, i) {
        el.style.transitionDelay = (startMs + i * stepMs) + 'ms';
      });
      requestAnimationFrame(function () { root.classList.remove('is-staged'); });
    }, '0px 0px -20% 0px');
  }
  stagger(document.getElementById('ladder'), '.channel', 90, 250);

  // ─── Hero record: replays in sync with the real call ───
  // Envelope of assets/cobro_demo.wav (48 RMS buckets), so the waveform is the real one.
  var ENVELOPE = [5, 15, 4, 27, 5, 32, 17, 32, 25, 21, 34, 23, 4, 28, 23, 26, 31, 31, 25, 4, 16, 27, 19, 28, 22, 19, 26, 4, 26, 27, 23, 21, 18, 25, 4, 4, 32, 18, 30, 30, 26, 19, 4, 25, 27, 24, 20, 20];
  var record = document.getElementById('hero-record');
  var audio = document.getElementById('hero-audio');
  var playBtn = document.getElementById('hero-play');
  var timeEl = document.getElementById('hero-time');
  var wave = document.getElementById('hero-wave');
  var cues = Array.prototype.slice.call(record.querySelectorAll('[data-at]'));
  var bars = ENVELOPE.map(function (h) {
    var b = document.createElement('span');
    b.style.setProperty('--h', h + 'px');
    wave.appendChild(b);
    return b;
  });

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function duration() { return isFinite(audio.duration) ? Math.round(audio.duration) : 61; }

  var raf = 0;
  function render() {
    var t = audio.currentTime;
    var p = t / duration();
    var live = Math.min(bars.length - 1, Math.floor(p * bars.length));
    bars.forEach(function (b, i) {
      b.classList.toggle('is-past', i < live);
      b.classList.toggle('is-live', i === live && !audio.paused);
    });
    cues.forEach(function (c) { c.classList.toggle('is-on', t >= parseFloat(c.dataset.at)); });
    timeEl.textContent = fmt(t) + ' / ' + fmt(duration());
    if (!audio.paused) raf = requestAnimationFrame(render);
  }

  function setPlaying(on) {
    record.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.setAttribute('aria-label', on ? 'Pausar la llamada' : 'Reproducir la llamada');
  }

  function toggle() {
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { setPlaying(false); });
    } else {
      audio.pause();
    }
  }

  playBtn.addEventListener('click', toggle);
  audio.addEventListener('play', function () { setPlaying(true); });
  // Only hide the finished record once sound is actually coming out, so a slow
  // network never leaves the proof blank.
  audio.addEventListener('playing', function () {
    record.classList.add('is-armed');
    cancelAnimationFrame(raf);
    render();
  });
  audio.addEventListener('pause', function () { setPlaying(false); cancelAnimationFrame(raf); render(); });
  audio.addEventListener('ended', function () {
    setPlaying(false);
    record.classList.remove('is-armed');
    bars.forEach(function (b) { b.classList.remove('is-past', 'is-live'); });
    timeEl.textContent = fmt(duration());
  });
  audio.addEventListener('loadedmetadata', function () {
    if (!record.classList.contains('is-armed')) timeEl.textContent = fmt(duration());
  });

  document.getElementById('hero-listen').addEventListener('click', function () {
    var r = record.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      record.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }
    if (audio.paused) toggle();
  });

  // ─── FAQ: smooth open/close ───
  document.querySelectorAll('.faq details').forEach(function (d) {
    var summary = d.querySelector('summary');
    var body = d.querySelector('.faq__body');
    summary.addEventListener('click', function (e) {
      if (reduceMotion || !body.animate) return;
      e.preventDefault();
      if (d.open) {
        if (d.classList.contains('is-closing')) return;
        d.classList.add('is-closing');
        body.animate([{ height: body.offsetHeight + 'px' }, { height: '0px' }], { duration: 260, easing: 'ease' })
          .onfinish = function () { d.open = false; d.classList.remove('is-closing'); };
      } else {
        d.open = true;
        var target = body.offsetHeight;
        body.animate([{ height: '0px' }, { height: target + 'px' }], { duration: 300, easing: 'ease' });
      }
    });
  });

  // ─── Pilot modal ───
  var modal = document.getElementById('pilot-modal');
  var lastFocus = null;
  function openModal() {
    // The pilot modal is the funnel step between landing and Lead.
    if (window.fbq) window.fbq('track', 'ViewContent', { content_name: 'demo-modal' });
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { var f = modal.querySelector('input'); if (f) f.focus(); }, 30);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  document.querySelectorAll('[data-pilot-open]').forEach(function (el) { el.addEventListener('click', openModal); });
  document.querySelectorAll('[data-pilot-close]').forEach(function (el) { el.addEventListener('click', closeModal); });
  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {
      var items = modal.querySelectorAll('button, input, select');
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ─── Pilot form: same Apps Script endpoint and payload keys as v2 ───
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwB2WuEvbyzje0xi5JyjminYUPZJmg5mVqf4I8zE0t4QKm8cFtMAwRoLOd-DC1ow4WyHA/exec';
  var form = document.getElementById('pilot-form');
  var submit = document.getElementById('pilot-submit');
  var status = document.getElementById('pilot-status');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, msg) {
    var field = input.closest('.field');
    field.classList.toggle('is-invalid', !!msg);
    field.querySelector('.field__error').textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  form.querySelectorAll('input').forEach(function (i) {
    i.addEventListener('input', function () { setError(i, ''); });
  });

  function validate() {
    var errors = [
      [form.nombre, form.nombre.value.trim() ? '' : 'Escriba su nombre.'],
      [form.apellido, form.apellido.value.trim() ? '' : 'Escriba su apellido.'],
      [form.email, !form.email.value.trim() ? 'Escriba su correo.' : (emailRe.test(form.email.value.trim()) ? '' : 'Revise el correo: falta algo.')],
      [form.empresa, form.empresa.value.trim() ? '' : 'Escriba el nombre de su empresa.']
    ];
    var firstBad = null;
    errors.forEach(function (p) { setError(p[0], p[1]); if (p[1] && !firstBad) firstBad = p[0]; });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    submit.disabled = true;
    submit.textContent = 'Enviando…';
    status.textContent = '';
    var payload = {
      nombre: form.nombre.value.trim(),
      apellido: form.apellido.value.trim(),
      email: form.email.value.trim(),
      telefono: form.telefono.value.trim(),
      empresa: form.empresa.value.trim(),
      tipo_empresa: form.tipo_empresa.value,
      cuentas_en_cartera: form.cuentas_en_cartera.value
    };
    var attribution = readAttribution();
    AD_PARAMS.forEach(function (k) { payload[k] = attribution[k] || ''; });
    fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(payload) })
      .then(function () {
        // Never pass form fields here: prospect PII must not reach Meta.
        if (window.fbq) window.fbq('track', 'Lead', { content_name: 'demo-request' });
        form.reset();
        submit.textContent = 'Solicitud enviada';
        status.textContent = 'Gracias. Le contactamos para coordinar su piloto.';
        setTimeout(function () {
          submit.disabled = false;
          submit.textContent = 'Enviar solicitud';
          status.textContent = '';
          closeModal();
        }, 2600);
      })
      .catch(function () {
        submit.disabled = false;
        submit.textContent = 'Enviar solicitud';
        status.textContent = 'No se pudo enviar. Intente de nuevo en un momento.';
      });
  });
})();

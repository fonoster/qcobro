// Kit de Marca v3: icons, nav hairline, reveal-on-view, and copy-a-color.
(function () {
  'use strict';

  if (window.lucide) window.lucide.createIcons();

  var nav = document.getElementById('nav');
  function onScroll() { nav.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); e.target.classList.add('is-in'); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  var status = document.getElementById('copy-status');
  document.querySelectorAll('.swatch').forEach(function (btn) {
    var hexEl = btn.querySelector('.swatch__hex');
    var hex = btn.dataset.hex;
    btn.setAttribute('aria-label', btn.querySelector('.swatch__name').textContent + ', ' + hex + '. Copiar');
    btn.addEventListener('click', function () {
      var done = function () {
        btn.classList.add('is-copied');
        hexEl.textContent = 'Copiado';
        status.textContent = hex + ' copiado';
        setTimeout(function () { btn.classList.remove('is-copied'); hexEl.textContent = hex; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hex).then(done, function () {});
      }
    });
  });
})();

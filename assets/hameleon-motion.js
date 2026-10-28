/*
  Хамелеон: scroll reveals and count-up numbers.
  [data-reveal] fades/slides in when it enters the viewport (stagger with style="--d: n").
  [data-count="1320"] counts up from 0 once visible. Honours prefers-reduced-motion.
*/
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('hm-motion');

  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    if (reduce || !target) {
      el.textContent = el.dataset.countText || target;
      return;
    }
    var start = null;
    var duration = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('bg-BG');
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = el.dataset.countText || target.toLocaleString('bg-BG');
    }
    requestAnimationFrame(step);
  }

  function init(root) {
    var items = root.querySelectorAll('[data-reveal]:not(.is-in), [data-count]:not([data-counted])');
    if (!('IntersectionObserver' in window) || reduce) {
      items.forEach(function (el) {
        el.classList.add('is-in');
        if (el.dataset.count) {
          el.setAttribute('data-counted', '');
          countUp(el);
        }
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add('is-in');
          if (el.dataset.count && !el.hasAttribute('data-counted')) {
            el.setAttribute('data-counted', '');
            countUp(el);
          }
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    items.forEach(function (el) {
      io.observe(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();

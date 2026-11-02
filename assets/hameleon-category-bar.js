/* Хамелеон: category bar + mega panel. Desktop: hover/click a category to show its sub-categories.
   Phone (< 990px): drawer; tapping a category with sub-categories drills in, "Назад" goes back. */
(() => {
  const DESKTOP = window.matchMedia('(min-width: 990px)');
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)');

  document.querySelectorAll('[data-hm-catbar]').forEach((bar) => {
    if (bar.dataset.ready) return;
    bar.dataset.ready = '1';

    const toggle = bar.querySelector('[data-hm-cat-toggle]');
    const items = [...bar.querySelectorAll('[data-hm-cat-item]')];
    const groups = [...bar.querySelectorAll('[data-hm-cat-group]')];
    const mtitle = bar.querySelector('[data-hm-cat-mtitle]');
    const subs = bar.querySelector('.hm-catpanel__subs');
    let openTimer;
    let closeTimer;
    let hoverTimer;

    const activate = (index) => {
      items.forEach((el) => el.classList.toggle('is-active', el.dataset.hmCatItem === String(index)));
      groups.forEach((el) => el.classList.toggle('is-active', el.dataset.hmCatGroup === String(index)));
      if (subs) subs.scrollTop = 0;
    };

    const open = () => {
      clearTimeout(closeTimer);
      if (bar.classList.contains('is-open')) return;
      bar.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (!DESKTOP.matches) document.body.style.overflow = 'hidden';
    };

    const close = () => {
      clearTimeout(openTimer);
      bar.classList.remove('is-open', 'is-drilled');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (mtitle) mtitle.textContent = mtitle.dataset.default;
    };

    toggle.addEventListener('click', () => {
      bar.classList.contains('is-open') ? close() : open();
    });

    // Desktop hover: open after a short pause, close when the pointer leaves the bar and panel.
    const card = bar.querySelector('[data-hm-cat-card]');
    const hoverZones = [toggle, card].filter(Boolean);
    hoverZones.forEach((zone) => {
      zone.addEventListener('mouseenter', () => {
        if (!DESKTOP.matches || !FINE.matches) return;
        clearTimeout(closeTimer);
        if (zone === toggle) openTimer = setTimeout(open, 120);
      });
      zone.addEventListener('mouseleave', () => {
        if (!DESKTOP.matches || !FINE.matches) return;
        clearTimeout(openTimer);
        closeTimer = setTimeout(close, 280);
      });
    });

    items.forEach((item) => {
      const index = item.dataset.hmCatItem;
      item.addEventListener('mouseenter', () => {
        if (!DESKTOP.matches) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => activate(index), 60);
      });
      item.addEventListener('focus', () => {
        if (DESKTOP.matches) activate(index);
      });
      item.addEventListener('click', (event) => {
        if (DESKTOP.matches || !item.hasAttribute('data-has-subs')) return;
        event.preventDefault();
        activate(index);
        bar.classList.add('is-drilled');
        if (mtitle) mtitle.textContent = groups[Number(index)]?.dataset.title || mtitle.dataset.default;
      });
    });

    bar.querySelector('[data-hm-cat-back]')?.addEventListener('click', () => {
      bar.classList.remove('is-drilled');
      if (mtitle) mtitle.textContent = mtitle.dataset.default;
    });

    bar.querySelectorAll('[data-hm-cat-close]').forEach((el) => el.addEventListener('click', close));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && bar.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (bar.classList.contains('is-open') && !bar.contains(event.target)) close();
    });

    DESKTOP.addEventListener('change', close);
  });
})();

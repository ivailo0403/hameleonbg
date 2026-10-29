/*
  Хамелеон: promo slider (sections/hameleon-slider.liquid).
  The track is a scroll-snap row, so swipe works natively; this adds arrows, dots and autoplay.
  Autoplay pauses on hover, on focus inside, when the tab is hidden, and never runs with reduced motion.
*/
if (!customElements.get('hameleon-slider')) {
  customElements.define(
    'hameleon-slider',
    class HameleonSlider extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-track]');
        this.slides = [...this.querySelectorAll('[data-slide]')];
        this.dots = [...this.querySelectorAll('[data-dot]')];
        if (this.slides.length < 2) return;
        this.index = 0;

        this.querySelector('[data-prev]').addEventListener('click', () => this.go(this.index - 1, true));
        this.querySelector('[data-next]').addEventListener('click', () => this.go(this.index + 1, true));
        this.dots.forEach((dot) => dot.addEventListener('click', () => this.go(Number(dot.dataset.dot), true)));

        /* Keep the dots in step when the visitor swipes. */
        this.track.addEventListener(
          'scroll',
          () => {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = setTimeout(() => {
              const i = Math.round(this.track.scrollLeft / this.track.clientWidth);
              if (i !== this.index) this.mark(i);
            }, 80);
          },
          { passive: true }
        );

        this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.delay = Math.max(3, Number(this.dataset.interval) || 6) * 1000;
        ['mouseenter', 'focusin', 'touchstart'].forEach((e) => this.addEventListener(e, () => this.stop(), { passive: true }));
        ['mouseleave', 'focusout'].forEach((e) => this.addEventListener(e, () => this.start()));
        document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
        this.start();
      }

      disconnectedCallback() {
        this.stop();
      }

      start() {
        if (this.reduced || this.slides.length < 2) return;
        this.stop();
        this.timer = setInterval(() => this.go(this.index + 1), this.delay);
      }

      stop() {
        clearInterval(this.timer);
      }

      go(i, byHand) {
        const n = this.slides.length;
        const next = ((i % n) + n) % n;
        this.track.scrollTo({ left: next * this.track.clientWidth, behavior: this.reduced ? 'auto' : 'smooth' });
        this.mark(next);
        if (byHand) this.start();
      }

      mark(i) {
        this.index = i;
        this.dots.forEach((dot, d) => dot.setAttribute('aria-current', String(d === i)));
      }
    }
  );
}

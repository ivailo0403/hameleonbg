/*
  Хамелеон: home hero (sections/hameleon-hero.liquid).
  The room's wall cycles through the "wall colours" until the visitor picks one from the colour
  rail on the right. The label shows the Vitex code when the colour is in the catalogue, and its
  "Поръчайте" link opens the catalogue on that colour. Colours come from assets/hameleon-colors.js.
*/
if (!customElements.get('hameleon-hero')) {
  customElements.define(
    'hameleon-hero',
    class HameleonHero extends HTMLElement {
      connectedCallback() {
        this.nameEl = this.querySelector('[data-hm-wall-name]');
        this.codeEl = this.querySelector('[data-hm-wall-code]');
        this.order = this.querySelector('[data-hm-wall-order]');
        this.swatches = [...this.querySelectorAll('[data-hm-rail]')];

        this.swatches.forEach((swatch) => swatch.addEventListener('click', () => this.pick(swatch)));
        this.startCycle();
      }

      startCycle() {
        if (!this.swatches.length) return;
        let i = 0;
        const show = () => {
          this.paint(this.swatches[i % this.swatches.length], false);
          i++;
        };
        show();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.timer = setInterval(show, 2800);
      }

      findByHex(hex) {
        const families = (window.HameleonColors && window.HameleonColors.families) || [];
        const value = String(hex).replace('#', '').toUpperCase();
        for (const family of families) {
          const item = family.items.find((c) => c[2] === value);
          if (item) return { code: String(item[0]), name: item[1] };
        }
        return null;
      }

      pick(swatch) {
        clearInterval(this.timer);
        this.paint(swatch, true);
      }

      paint(swatch, picked) {
        const hex = swatch.dataset.hmRail;
        const found = this.findByHex(hex);
        this.style.setProperty('--wall', hex);
        this.nameEl.textContent = found ? found.name : swatch.dataset.name;
        this.codeEl.textContent = found ? `№ ${found.code}` : '';
        this.swatches.forEach((s) => s.setAttribute('aria-pressed', String(picked && s === swatch)));
        const base = this.dataset.catalogueUrl;
        if (base && found) {
          const url = new URL(base, window.location.origin);
          url.searchParams.set('color', found.code);
          this.order.href = url.pathname + url.search;
        }
      }
    }
  );
}

/*
  Хамелеон: quick paint calculator (sections/hameleon-calculator.liquid).
  litres = area × coats ÷ coverage, then the mix of can sizes that covers it
  with the least paint left over (fewest cans on a tie).
*/
if (!customElements.get('hameleon-paint-calc')) {
  customElements.define(
    'hameleon-paint-calc',
    class HameleonPaintCalc extends HTMLElement {
      connectedCallback() {
        this.coverage = parseFloat(this.dataset.coverage) || 9;
        this.sizes = (this.dataset.sizes || '10,5,2.5')
          .split(',')
          .map((s) => parseFloat(s.trim().replace(',', '.')))
          .filter((n) => n > 0)
          .sort((a, b) => b - a);
        this.areaInput = this.querySelector('[data-area]');
        this.litresEl = this.querySelector('[data-litres]');
        this.cansEl = this.querySelector('[data-cans]');

        this.areaInput.addEventListener('input', () => this.update());
        this.querySelectorAll('[data-coats]').forEach((el) => el.addEventListener('change', () => this.update()));
        this.querySelectorAll('[data-step]').forEach((btn) =>
          btn.addEventListener('click', () => {
            const next = (parseFloat(this.areaInput.value) || 0) + parseFloat(btn.dataset.step);
            this.areaInput.value = Math.min(2000, Math.max(1, next));
            this.update();
          })
        );
        this.update();
      }

      update() {
        const area = parseFloat(this.areaInput.value) || 0;
        const checked = this.querySelector('[data-coats]:checked');
        const coats = checked ? parseInt(checked.value, 10) : 2;
        if (area <= 0) {
          this.litresEl.textContent = 'Въведете площта в м².';
          this.cansEl.textContent = '';
          return;
        }
        const litres = (area * coats) / this.coverage;
        this.litresEl.textContent = `Трябват Ви около ${this.format(litres)} л.`;
        this.cansEl.textContent = `Препоръчваме ${this.cans(litres)}.`;
      }

      cans(litres) {
        const sizes = this.sizes;
        const smallest = sizes[sizes.length - 1];
        let best = null;
        const search = (i, counts, total) => {
          if (i === sizes.length) {
            if (total + 1e-9 < litres) return;
            const n = counts.reduce((a, b) => a + b, 0);
            if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && n < best.n)) {
              best = { total, n, counts: counts.slice() };
            }
            return;
          }
          const max = Math.ceil(litres / sizes[i]) + (sizes[i] === smallest ? 0 : 1);
          for (let c = 0; c <= max; c++) {
            counts[i] = c;
            search(i + 1, counts, total + c * sizes[i]);
            if (total + c * sizes[i] + 1e-9 >= litres) break;
          }
          counts[i] = 0;
        };
        search(0, sizes.map(() => 0), 0);
        if (!best) return `1 × ${this.format(sizes[0])} л`;
        return sizes
          .map((size, i) => (best.counts[i] ? `${best.counts[i]} × ${this.format(size)} л` : null))
          .filter(Boolean)
          .join(' + ');
      }

      format(n) {
        return (Math.round(n * 10) / 10).toLocaleString('bg-BG', { maximumFractionDigits: 1 });
      }
    }
  );
}

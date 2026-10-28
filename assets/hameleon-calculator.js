/*
  Хамелеон: paint calculator (sections/hameleon-calculator.liquid).
  litres = area × coats ÷ (m² per litre), then the mix of the product's pack sizes
  with the least paint left over (fewest packs on a tie).
*/
if (!customElements.get('hameleon-paint-calc')) {
  customElements.define(
    'hameleon-paint-calc',
    class HameleonPaintCalc extends HTMLElement {
      connectedCallback() {
        this.areaInput = this.querySelector('[data-area]');
        this.querySelectorAll('[data-product]').forEach((input) => {
          const label = input.closest('label').querySelector('[data-coverage-label]');
          const packL = this.num(input.dataset.packL);
          const packSqm = this.num(input.dataset.packSqm);
          if (label && packL && packSqm) {
            label.textContent =
              packL === 1
                ? `1 л покрива ${this.format(packSqm)} м²`
                : `${this.size(packL)} покрива ${this.format(packSqm)} м²`;
          }
        });

        this.addEventListener('change', (event) => {
          if (event.target.matches('[data-cat]')) this.showCategory(event.target.value);
          this.update();
        });
        this.areaInput.addEventListener('input', () => this.update());
        this.update();
      }

      num(value) {
        return parseFloat(String(value || '').replace(',', '.')) || 0;
      }

      showCategory(cat) {
        this.querySelectorAll('[data-product-cat]').forEach((label) => {
          const match = label.dataset.productCat === cat;
          label.hidden = !match;
          if (!match) label.querySelector('input').checked = false;
        });
      }

      update() {
        const product = this.querySelector('[data-product]:checked');
        const area = this.num(this.areaInput.value);
        const coatsInput = this.querySelector('[data-coats]:checked');
        const coats = coatsInput ? parseInt(coatsInput.value, 10) : 2;
        const contents = this.querySelectorAll('[data-r-content]');
        const link = this.querySelector('[data-r-link]');
        const name = this.querySelector('[data-r-name]');
        const detail = this.querySelector('[data-r-detail]');

        const fill = this.querySelector('[data-r-fill]');
        const use = this.querySelector('[data-r-use]');

        if (!product || area <= 0) {
          contents.forEach((el) => (el.hidden = true));
          fill.style.height = '0%';
          use.hidden = true;
          link.hidden = true;
          name.textContent = product ? product.dataset.name : 'Вашият резултат';
          detail.textContent = product ? 'Въведете площта в м².' : 'Изберете продукт и въведете площта.';
          return;
        }

        const packL = this.num(product.dataset.packL);
        const packSqm = this.num(product.dataset.packSqm);
        const sizes = String(product.dataset.sizes || '')
          .split(',')
          .map((s) => this.num(s))
          .filter((n) => n > 0)
          .sort((a, b) => b - a);
        if (!packL || !packSqm || !sizes.length) return;

        const totalArea = area * coats;
        const litres = totalArea / (packSqm / packL);
        const combo = this.packs(litres, sizes);
        const total = combo.reduce((sum, p) => sum + p.count * p.size, 0);
        const count = combo.reduce((sum, p) => sum + p.count, 0);

        name.textContent = product.dataset.name;
        detail.textContent = `${this.format(area)} м² · ${coats} ${coats === 1 ? 'ръка' : 'ръце'} · нужни ${this.format(litres)} л`;
        this.animate(this.querySelector('[data-r-litres]'), total);
        this.animate(this.querySelector('[data-r-packs]'), count);
        this.querySelector('[data-r-packs-label]').textContent = count === 1 ? 'опаковка' : 'опаковки';
        this.animate(this.querySelector('[data-r-area]'), totalArea);
        const ratio = Math.min(litres / total, 1);
        fill.style.height = `${Math.max(ratio * 100, 6)}%`;
        use.textContent = `Използвате ${Math.round(ratio * 100)}% от купената боя`;
        use.hidden = false;

        const list = this.querySelector('[data-r-pack-list]');
        list.replaceChildren(
          ...combo.map((p) => {
            const li = document.createElement('li');
            li.className = 'hm-calc__pack';
            const strong = document.createElement('strong');
            strong.textContent = `${p.count} ×`;
            li.append(strong, ` ${this.size(p.size)}`);
            return li;
          })
        );
        contents.forEach((el) => (el.hidden = false));

        if (product.dataset.url) {
          link.href = product.dataset.url;
          link.hidden = false;
        } else {
          link.hidden = true;
        }
      }

      /* Pack sizes (largest first) that cover the litres with the least left over, then the fewest packs. */
      packs(litres, sizes) {
        let best = null;
        const counts = sizes.map(() => 0);
        const search = (i, total) => {
          if (i === sizes.length) {
            if (total + 1e-9 < litres) return;
            const n = counts.reduce((a, b) => a + b, 0);
            if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && n < best.n)) {
              best = { total, n, counts: counts.slice() };
            }
            return;
          }
          const max = Math.ceil(litres / sizes[i]);
          for (let c = 0; c <= max; c++) {
            counts[i] = c;
            search(i + 1, total + c * sizes[i]);
            if (total + c * sizes[i] + 1e-9 >= litres) break;
          }
          counts[i] = 0;
        };
        search(0, 0);
        if (!best) return [{ size: sizes[0], count: 1 }];
        return sizes.map((size, i) => ({ size, count: best.counts[i] })).filter((p) => p.count > 0);
      }

      /* Counts a stat from its current value to the new one. */
      animate(el, to) {
        const from = this.num(el.dataset.value);
        el.dataset.value = to;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
          el.textContent = this.format(to);
          return;
        }
        const start = performance.now();
        const step = (now) => {
          const p = Math.min((now - start) / 600, 1);
          const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
          el.textContent = this.format(p < 1 && Number.isInteger(to) ? Math.round(v) : v);
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = this.format(to);
        };
        requestAnimationFrame(step);
      }

      size(litres) {
        return litres < 1 ? `${Math.round(litres * 1000)} мл` : `${this.format(litres)} л`;
      }

      format(n) {
        return (Math.round(n * 100) / 100).toLocaleString('bg-BG', { maximumFractionDigits: 2 });
      }
    }
  );
}

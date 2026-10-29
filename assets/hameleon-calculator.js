/*
  Хамелеон: paint calculator (snippets/hameleon-paint-calc.liquid).
  litres = area × coats ÷ (m² per litre), then the mix of the product's pack sizes
  with the least paint left over (fewest packs on a tie).
  The colour comes from a "hameleon:color" event on document ({ code, name, hex, catalogue, image })
  or from ?color= in the address. "Add to cart" posts one line per pack size, each carrying the colour.
*/
window.Hameleon = window.Hameleon || {};

/* The tin markup from snippets/hameleon-paint-tin.liquid; keep them in step. */
window.Hameleon.tinHTML = (name, size, color) => {
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const words = String(name || '').trim().split(/\s+/);
  const brand = words.length > 1 ? words[0] : 'Vitex';
  const rest = words.length > 1 ? words.slice(1).join(' ') : name;
  return (
    `<span class="hm-tin"${color ? ` style="--tin: ${esc(color)};"` : ''} aria-hidden="true">` +
    '<span class="hm-tin__handle"></span><span class="hm-tin__lid"></span><span class="hm-tin__body">' +
    `<span class="hm-tin__brand">${esc(brand)}</span><span class="hm-tin__name">${esc(rest)}</span>` +
    (size ? `<span class="hm-tin__size">${esc(size)}</span>` : '') +
    '<span class="hm-tin__wave"></span></span></span>'
  );
};

/* Finds a colour by code in the Vitex or Motivo catalogue (assets/hameleon-colors.js). */
window.Hameleon.findColor = (code) => {
  const value = String(code || '').trim();
  if (!value) return null;
  if (/^[sgt]/i.test(value) && window.Hameleon.motivo) return window.Hameleon.motivo.find(value, '', '');
  if (window.HameleonColors) {
    for (const family of window.HameleonColors.families) {
      const item = family.items.find((c) => String(c[0]) === value);
      if (item) return { code: String(item[0]), name: item[1], hex: `#${item[2]}`, catalogue: 'Vitex', family: family.name };
    }
  }
  return null;
};

if (!customElements.get('hameleon-paint-calc')) {
  customElements.define(
    'hameleon-paint-calc',
    class HameleonPaintCalc extends HTMLElement {
      connectedCallback() {
        this.areaInput = this.querySelector('[data-area]');
        this.color = null;
        this.combo = [];

        this.querySelectorAll('[data-product]').forEach((input) => {
          const holder = input.closest('label');
          const label = holder ? holder.querySelector('[data-coverage-label]') : this.querySelector('[data-this-coverage]');
          const packL = this.num(input.dataset.packL);
          const packSqm = this.num(input.dataset.packSqm);
          if (label && packL && packSqm) label.textContent = `${this.format(packSqm / packL)} м²/л${holder ? '' : ' с една ръка'}`;
          /* On a product page without a matching calculator block, the sizes come from the variant names. */
          if (!String(input.dataset.sizes || '').trim()) {
            const sizes = this.variantsOf(input)
              .map((v) => this.litresIn(v.title))
              .filter((n) => n > 0);
            input.dataset.sizes = [...new Set(sizes)].join(',');
          } else if (!holder) {
            /* On a product page, offer only the sizes this product is sold in. */
            const variants = this.variantsOf(input);
            const sold = String(input.dataset.sizes)
              .split(',')
              .map((s) => this.num(s))
              .filter((n) => n > 0 && this.variantFor(variants, n));
            if (sold.length) input.dataset.sizes = sold.join(',');
          }
          /* Sizes sold only in white (e.g. Vito 15 л) are never tinted, so a tintable paint leaves them out. */
          const white = String(input.dataset.whiteSizes || '')
            .split(',')
            .map((s) => this.num(s))
            .filter((n) => n > 0);
          if (white.length && input.dataset.tintable !== 'false') {
            const tinted = String(input.dataset.sizes)
              .split(',')
              .map((s) => this.num(s))
              .filter((n) => n > 0 && !white.includes(n));
            if (tinted.length) input.dataset.sizes = tinted.join(',');
          }
        });

        this.addEventListener('change', (event) => {
          if (event.target.matches('[data-cat]')) this.showCategory(event.target.value);
          if (event.target.matches('[data-room]')) return this.roomArea();
          this.update();
        });
        this.addEventListener('input', (event) => {
          if (event.target.matches('[data-room]')) this.roomArea();
          if (event.target === this.areaInput) this.update();
        });
        this.querySelectorAll('[data-area-step]').forEach((button) =>
          button.addEventListener('click', () => {
            const next = Math.max(1, Math.round(this.num(this.areaInput.value)) + parseInt(button.dataset.areaStep, 10) * 5);
            this.areaInput.value = next;
            this.update();
          })
        );
        this.querySelector('[data-r-add]').addEventListener('click', () => this.addToCart());
        this.querySelector('[data-r-color-link]').addEventListener('click', (event) => this.pickColor(event));
        this.querySelector('[data-r-pick]').addEventListener('click', (event) => this.pickColor(event));

        document.addEventListener('hameleon:color', (event) => this.setColor(event.detail));

        const params = new URLSearchParams(window.location.search);
        if (params.get('area')) this.areaInput.value = params.get('area');
        if (params.get('coats')) {
          const coats = this.querySelector(`[data-coats][value="${params.get('coats')}"]`);
          if (coats) coats.checked = true;
        }
        if (params.get('paint')) {
          const wanted = params.get('paint').toLowerCase();
          const match = [...this.querySelectorAll('[data-product]')].find((p) => p.dataset.name.toLowerCase() === wanted);
          if (match) {
            const cat = this.querySelector(`[data-cat][value="${match.dataset.catValue}"]`);
            if (cat) cat.checked = true;
            this.showCategory(match.dataset.catValue);
            match.checked = true;
          }
        }
        if (!this.querySelector('[data-product]:checked')) {
          const first =
            this.querySelector('[data-product-cat]:not([hidden]) [data-product]:not([data-tintable="false"])') ||
            this.querySelector('[data-product-cat]:not([hidden]) [data-product]');
          if (first) first.checked = true;
        }
        const fromPage = window.Hameleon.currentColor || window.Hameleon.findColor(params.get('color'));
        if (fromPage) this.color = fromPage;
        this.update();
      }

      num(value) {
        return parseFloat(String(value || '').replace(',', '.')) || 0;
      }

      showCategory(cat) {
        let firstShown = null;
        this.querySelectorAll('[data-product-cat]').forEach((label) => {
          const match = label.dataset.productCat === cat;
          label.hidden = !match;
          const input = label.querySelector('input');
          if (!match) input.checked = false;
          else if (!firstShown || (firstShown.dataset.tintable === 'false' && input.dataset.tintable !== 'false')) firstShown = input;
        });
        if (firstShown && !this.querySelector('[data-product]:checked')) firstShown.checked = true;
      }

      roomArea() {
        const v = (key) => this.num(this.querySelector(`[data-room="${key}"]`).value);
        const l = v('l');
        const w = v('w');
        const h = v('h');
        const openings = v('o');
        const ceiling = this.querySelector('[data-room="c"]').checked;
        const out = this.querySelector('[data-room-out]');
        if (!l || !w || !h) {
          out.textContent = 'Въведете дължина, ширина и височина.';
          return;
        }
        const walls = 2 * (l + w) * h;
        const area = Math.max(1, Math.round(walls - openings * 1.8 + (ceiling ? l * w : 0)));
        this.areaInput.value = area;
        out.innerHTML = `Стени ${this.format(walls)} м²${ceiling ? ` + таван ${this.format(l * w)} м²` : ''}${openings ? `, без ${openings} отвора` : ''} = <strong>${area} м²</strong>`;
        this.update();
      }

      setColor(color) {
        this.color = color || null;
        /* A Motivo colour belongs to one base: switch the calculator to that plaster (SS → Silver, GG → Gold, TT → Titanium). */
        if (color && color.base) {
          const current = this.querySelector('[data-product]:checked');
          if (!current || this.baseFor(current) !== color.base) {
            const match = [...this.querySelectorAll('[data-product]')].find((p) => p.dataset.catValue === 'plaster' && this.baseFor(p) === color.base);
            if (match) {
              const cat = this.querySelector('[data-cat][value="plaster"]');
              if (cat) cat.checked = true;
              this.showCategory('plaster');
              this.querySelectorAll('[data-product]').forEach((p) => (p.checked = p === match));
            }
          }
        }
        this.update();
      }

      /* silver, gold or titanium for a Motivo plaster, from its name. */
      baseFor(product) {
        return product && product.dataset.catValue === 'plaster' && window.Hameleon.motivo ? window.Hameleon.motivo.baseOf(product.dataset.name) : '';
      }

      /* Which catalogue fits the chosen product: plasters use Motivo, paints use Vitex. */
      catalogueFor(product) {
        return product && product.dataset.catValue === 'plaster' ? 'Motivo' : 'Vitex';
      }

      pickColor(event) {
        const product = this.querySelector('[data-product]:checked');
        const catalogue = this.catalogueFor(product);
        if (this.hasAttribute('data-in-catalogue')) {
          event.preventDefault();
          document.dispatchEvent(new CustomEvent('hameleon:open-catalogue', { detail: { catalogue, base: this.baseFor(product) } }));
          return;
        }
        const base = this.dataset.catalogueUrl;
        if (!base || base === '#') return;
        event.preventDefault();
        const url = new URL(base, window.location.origin);
        if (product) url.searchParams.set('paint', product.dataset.name);
        url.searchParams.set('area', this.num(this.areaInput.value));
        const coats = this.querySelector('[data-coats]:checked');
        if (coats) url.searchParams.set('coats', coats.value);
        if (catalogue === 'Motivo') url.searchParams.set('tab', 'motivo');
        if (this.baseFor(product)) url.searchParams.set('base', this.baseFor(product));
        window.location.href = url.toString();
      }

      variantsOf(product) {
        try {
          return JSON.parse(product.dataset.variants || '[]');
        } catch (e) {
          return [];
        }
      }

      /* The pack size in litres written in a variant title, e.g. "9 л", "0,905 L", "905 мл". */
      litresIn(title) {
        const m = String(title).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(мл|ml|л|l|кг|kg)?/i);
        if (!m) return 0;
        let value = parseFloat(m[1]);
        if (m[2] && /^(мл|ml)$/i.test(m[2])) value /= 1000;
        return value;
      }

      /* Matches a pack size (litres) to a variant whose title holds that size. */
      variantFor(variants, size) {
        return variants.find((v) => {
          const value = this.litresIn(v.title);
          return value > 0 && Math.abs(value - size) < 0.01;
        });
      }

      update() {
        const product = this.querySelector('[data-product]:checked');
        const area = this.num(this.areaInput.value);
        const coatsInput = this.querySelector('[data-coats]:checked');
        const coats = coatsInput ? parseInt(coatsInput.value, 10) : 2;
        const contents = this.querySelectorAll('[data-r-content]');
        const detail = this.querySelector('[data-r-detail]');
        const tintable = product && product.dataset.tintable !== 'false';
        const catalogue = this.catalogueFor(product);
        const base = this.baseFor(product);
        const color =
          this.color && (this.color.custom || (this.color.catalogue === catalogue && (!base || !this.color.base || this.color.base === base))) ? this.color : null;

        this.renderColor(product, tintable, color, catalogue);
        this.querySelector('[data-r-tin]').innerHTML = window.Hameleon.tinHTML(
          product ? product.dataset.name : 'Vitex',
          '',
          tintable ? (color && color.hex ? color.hex : 'var(--hm-gradient)') : '#E4E8E6'
        );
        this.style.setProperty('--pc-glow', color && color.hex ? `${color.hex}88` : '');

        const sizes = product
          ? String(product.dataset.sizes || '')
              .split(',')
              .map((s) => this.num(s))
              .filter((n) => n > 0)
              .sort((a, b) => b - a)
          : [];
        const packL = product ? this.num(product.dataset.packL) : 0;
        const packSqm = product ? this.num(product.dataset.packSqm) : 0;

        if (!product || area <= 0 || !packL || !packSqm || !sizes.length) {
          contents.forEach((el) => (el.hidden = true));
          this.combo = [];
          this.querySelector('[data-r-litres]').textContent = '0';
          detail.textContent = product ? 'Въведете площта в м².' : 'Изберете боя и площ.';
          this.renderActions(product, tintable, color);
          return;
        }

        const totalArea = area * coats;
        const litres = totalArea / (packSqm / packL);
        const combo = this.packs(litres, sizes);
        const total = combo.reduce((sum, p) => sum + p.count * p.size, 0);
        this.combo = combo;

        detail.textContent = `${product.dataset.name} · ${this.format(area)} м² × ${coats} ${coats === 1 ? 'ръка' : 'ръце'} · нужни ${this.format(litres)} л`;
        this.animate(this.querySelector('[data-r-litres]'), total);

        const ratio = Math.min(litres / total, 1);
        this.querySelector('[data-r-use-bar]').style.width = `${Math.round(ratio * 100)}%`;
        this.querySelector('[data-r-use]').textContent = `Използвате ${Math.round(ratio * 100)}% от купената боя`;

        const tinColor = tintable ? (color && color.hex ? color.hex : '#19A54A') : '#E4E8E6';
        this.querySelector('[data-r-packs]').innerHTML = combo
          .map(
            (p, i) =>
              `<li class="hm-pc__pack" style="animation-delay: ${i * 0.08}s">${window.Hameleon.tinHTML(product.dataset.name, '', tinColor)}<strong>${p.count} ×</strong><span>${this.size(p.size)}</span></li>`
          )
          .join('');
        contents.forEach((el) => (el.hidden = false));

        this.renderPrice(product, combo);
        this.renderActions(product, tintable, color);
      }

      renderColor(product, tintable, color, catalogue) {
        const box = this.querySelector('[data-r-color]');
        const chip = this.querySelector('[data-r-color-chip]');
        const name = this.querySelector('[data-r-color-name]');
        const link = this.querySelector('[data-r-color-link]');
        box.hidden = !product;
        if (!tintable) {
          chip.style.background = '#F4F4F0';
          name.textContent = 'Бяла, без тониране';
          link.hidden = true;
          return;
        }
        link.hidden = false;
        if (color && color.custom) {
          chip.style.background = window.Hameleon.customSwatch || '#F4F4F0';
          name.textContent = `Код ${color.code} · друг каталог`;
          link.textContent = 'Смени';
        } else if (color) {
          chip.style.background = color.image ? `center / cover url("${color.image}")` : color.hex;
          name.textContent = `${color.code} · ${color.name}`;
          link.textContent = 'Смени';
        } else {
          chip.style.background = '';
          const base = this.baseFor(product) && window.Hameleon.motivo.base(this.baseFor(product));
          name.textContent = catalogue === 'Motivo' ? (base ? `Не е избран (кодове ${base.prefix}-…)` : 'Не е избран (Motivo)') : 'Не е избран';
          link.textContent = 'Изберете';
        }
      }

      renderPrice(product, combo) {
        const el = this.querySelector('[data-r-price]');
        const variants = this.variantsOf(product);
        let cents = 0;
        for (const p of combo) {
          const v = this.variantFor(variants, p.size);
          if (!v) {
            el.hidden = true;
            return;
          }
          cents += v.price * p.count;
        }
        el.innerHTML = `<span>Ориентировъчна цена</span><strong>${(cents / 100).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>`;
        el.hidden = !cents;
      }

      renderActions(product, tintable, color) {
        const add = this.querySelector('[data-r-add]');
        const pick = this.querySelector('[data-r-pick]');
        const link = this.querySelector('[data-r-link]');
        const variants = product ? this.variantsOf(product) : [];
        const canBuy = this.combo.length > 0 && this.combo.every((p) => this.variantFor(variants, p.size));
        const needsColor = tintable && !color;

        add.hidden = !(canBuy && !needsColor);
        pick.hidden = !(needsColor && this.combo.length);
        if (product && product.dataset.url) {
          link.href = product.dataset.url;
          link.hidden = false;
        } else {
          link.hidden = true;
        }
        this.querySelector('[data-r-added]').hidden = true;
      }

      async addToCart() {
        const product = this.querySelector('[data-product]:checked');
        if (!product || !this.combo.length) return;
        const variants = this.variantsOf(product);
        const tintable = product.dataset.tintable !== 'false';
        const color = this.color;
        const area = this.num(this.areaInput.value);
        const coatsInput = this.querySelector('[data-coats]:checked');
        const coats = coatsInput ? coatsInput.value : '2';
        const properties = {
          'Цвят': tintable && color ? (color.custom ? color.code : `${color.code} ${color.name}`) : 'Бяла (без тониране)',
          'Каталог': tintable && color ? color.catalogue : '—',
          'Сметка': `${this.format(area)} м², ${coats} ${coats === '1' ? 'ръка' : 'ръце'}`,
        };
        /* Hidden (underscore) properties let the cart draw the colour swatch. */
        if (tintable && color && color.hex) {
          properties._hex = color.hex;
          if (color.image) properties._image = color.image;
        }
        const items = this.combo.map((p) => ({ id: this.variantFor(variants, p.size).id, quantity: p.count, properties }));
        const button = this.querySelector('[data-r-add]');
        const note = this.querySelector('[data-r-added]');
        button.setAttribute('aria-busy', 'true');
        try {
          const response = await fetch(`${this.dataset.cartAddUrl || '/cart/add'}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.description || data.message || 'Грешка');
          const what = this.combo.map((p) => `${p.count} × ${this.size(p.size)}`).join(' + ');
          note.classList.remove('is-error');
          note.innerHTML = `Добавено: ${what} ${product.dataset.name}${tintable && color ? `, цвят ${color.code}` : ''}. <a href="${this.dataset.cartUrl || '/cart'}">Към количката →</a>`;
          note.hidden = false;
          this.refreshCartBubble();
          document.dispatchEvent(new CustomEvent('hameleon:cart-updated'));
        } catch (error) {
          note.classList.add('is-error');
          note.textContent = `Не успяхме да добавим боята: ${error.message}`;
          note.hidden = false;
        } finally {
          button.removeAttribute('aria-busy');
        }
      }

      /* Refreshes Dawn's cart count in the header. */
      async refreshCartBubble() {
        try {
          const response = await fetch(`${window.location.pathname}?sections=cart-icon-bubble`);
          const sections = await response.json();
          const bubble = document.getElementById('cart-icon-bubble');
          if (bubble && sections['cart-icon-bubble']) {
            const html = new DOMParser().parseFromString(sections['cart-icon-bubble'], 'text/html');
            const inner = html.querySelector('.shopify-section');
            bubble.innerHTML = inner ? inner.innerHTML : sections['cart-icon-bubble'];
          }
        } catch (e) {
          /* The count catches up on the next page load. */
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

      /* Counts a number from its current value to the new one. */
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

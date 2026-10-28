/*
  Хамелеон: paint catalogue page (sections/hameleon-paint-catalogue.liquid).
  Picking a colour paints the room's wall, remembers it in "Последно", puts ?color=CODE in the
  address and sends a "hameleon:color" event that the calculator listens to.
  Colours come from assets/hameleon-colors.js (window.HameleonColors, window.HameleonMotivo).
*/
if (!customElements.get('hameleon-catalogue')) {
  customElements.define(
    'hameleon-catalogue',
    class HameleonCatalogue extends HTMLElement {
      connectedCallback() {
        this.families = (window.HameleonColors && window.HameleonColors.families) || [];
        this.motivo = window.HameleonMotivo || [];
        this.tab = 'vitex';
        this.family = 'all';
        this.query = '';
        this.recent = [];
        this.grid = this.querySelector('[data-grid]');

        this.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => this.setTab(tab.dataset.tab)));
        this.querySelector('[data-search]').addEventListener('input', (event) => {
          this.query = event.target.value.trim().toLowerCase();
          this.render();
        });
        this.querySelectorAll('[data-scene-btn]').forEach((button) =>
          button.addEventListener('click', () => this.setScene(button.dataset.sceneBtn))
        );
        this.grid.addEventListener('click', (event) => {
          if (event.target.closest('[data-more]')) {
            this.limit += window.matchMedia('(min-width: 990px)').matches ? 240 : 60;
            this.render(true);
            return;
          }
          const chip = event.target.closest('[data-code]');
          if (chip) this.select(this.colorFromCode(chip.dataset.code), true);
        });
        this.querySelector('[data-recent]').addEventListener('click', (event) => {
          const chip = event.target.closest('[data-code]');
          if (chip) this.select(this.colorFromCode(chip.dataset.code), true);
        });
        this.querySelector('[data-now-go]').addEventListener('click', (event) => {
          event.preventDefault();
          this.querySelector('#kalkulator').scrollIntoView({ behavior: 'smooth' });
        });
        document.addEventListener('hameleon:open-catalogue', (event) => {
          this.setTab(event.detail && event.detail.catalogue === 'Motivo' ? 'motivo' : 'vitex');
          this.querySelector('#katalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        document.addEventListener('hameleon:cart-updated', () => this.loadOrder());

        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'motivo') this.tab = 'motivo';
        this.renderFamilies();
        this.setTab(this.tab);
        const first = this.colorFromCode(params.get('color')) || this.colorFromCode(this.tab === 'motivo' ? 'M1' : '675');
        /* Wait a tick so the calculator (defined in another deferred script) hears the first colour. */
        setTimeout(() => this.select(first, false), 0);
        this.loadOrder();
      }

      motivoImage(n) {
        return String(this.dataset.motivoBase || '').replace('hm-motivo-01', `hm-motivo-${String(n).padStart(2, '0')}`);
      }

      colorFromCode(code) {
        const value = String(code || '').trim();
        if (!value) return null;
        const m = value.match(/^m-?(\d+)$/i);
        if (m) {
          const item = this.motivo.find((x) => x[0] === parseInt(m[1], 10));
          return item ? { code: `M${item[0]}`, name: `Motivo ${item[0]}`, hex: `#${item[1]}`, catalogue: 'Motivo', image: this.motivoImage(item[0]) } : null;
        }
        for (const family of this.families) {
          const item = family.items.find((c) => String(c[0]) === value);
          if (item) return { code: String(item[0]), name: item[1], hex: `#${item[2]}`, catalogue: 'Vitex', family: family.name };
        }
        return null;
      }

      setTab(tab) {
        this.tab = tab;
        this.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
        this.querySelector('[data-families]').hidden = tab !== 'vitex';
        this.render();
      }

      setScene(scene) {
        this.querySelectorAll('[data-scene]').forEach((s) => (s.hidden = s.dataset.scene !== scene));
        this.querySelectorAll('[data-scene-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sceneBtn === scene)));
      }

      renderFamilies() {
        const list = this.querySelector('[data-families]');
        const total = this.families.reduce((sum, f) => sum + f.items.length, 0);
        const button = (key, name, dot, count) =>
          `<li><button type="button" class="hm-cat__family" data-family="${key}" aria-pressed="${key === this.family}">` +
          `<i style="background:${dot}"></i>${name} <small>${count}</small></button></li>`;
        list.innerHTML =
          button('all', 'Всички', 'conic-gradient(#FED426, #FE9A28, #F89495, #D771AF, #0095AB, #217553, #FED426)', total) +
          this.families.map((f) => button(f.key, f.name, `#${f.items[Math.floor(f.items.length * 0.6)][2]}`, f.items.length)).join('');
        list.querySelectorAll('[data-family]').forEach((b) =>
          b.addEventListener('click', () => {
            this.family = b.dataset.family;
            list.querySelectorAll('[data-family]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            this.render();
          })
        );
      }

      render(keepLimit) {
        if (!keepLimit) this.limit = window.matchMedia('(min-width: 990px)').matches ? 120 : 36;
        const q = this.query;
        let items;
        if (this.tab === 'motivo') {
          items = this.motivo
            .filter((m) => !q || String(m[0]).startsWith(q.replace(/^m-?/, '')) || `motivo ${m[0]}`.includes(q))
            .map((m) => ({ code: `M${m[0]}`, label: `M${m[0]}`, name: `Motivo ${m[0]}`, style: `background-image:url('${this.motivoImage(m[0])}');background-color:#${m[1]}` }));
        } else {
          const pool = this.family === 'all' || q ? this.families : this.families.filter((f) => f.key === this.family);
          items = pool
            .flatMap((f) => f.items)
            .filter((c) => !q || String(c[0]).startsWith(q) || c[1].toLowerCase().includes(q))
            .sort((a, b) => (q ? a[0] - b[0] : 0))
            .map((c) => ({ code: String(c[0]), label: `№ ${c[0]}`, name: c[1], style: `background:#${c[2]}` }));
        }
        const current = this.current ? this.current.code : '';
        this.querySelector('[data-count]').textContent = items.length
          ? `${items.length} ${items.length === 1 ? 'цвят' : 'цвята'}`
          : '';
        const shown = items.slice(0, this.limit);
        this.grid.innerHTML = items.length
          ? shown
              .map(
                (i) =>
                  `<button type="button" class="hm-chip" data-code="${i.code}" aria-pressed="${i.code === current}" aria-label="${i.label} ${i.name.replace(/"/g, '&quot;')}">` +
                  `<span class="hm-chip__color" style="${i.style}"></span>` +
                  `<span class="hm-chip__meta"><span class="hm-chip__code">${i.label}</span><span class="hm-chip__name">${i.name}</span></span></button>`
              )
              .join('')
          : '<p class="hm-cat__empty">Няма цвят с този код или име. Проверете кода от мострата.</p>';
        if (items.length > shown.length) {
          this.grid.insertAdjacentHTML(
            'beforeend',
            `<button type="button" class="hm-btn hm-btn--secondary hm-cat__more" data-more>Още цветове (${items.length - shown.length})</button>`
          );
        }
      }

      select(color, userAction) {
        if (!color) return;
        this.current = color;
        this.style.setProperty('--wall', color.hex);

        this.querySelectorAll('[data-room-svg]').forEach((svg) => {
          const wall = svg.querySelector('[data-room-wall]');
          const pattern = svg.querySelector('[data-room-pattern]');
          const id = pattern.closest('pattern').id;
          if (color.image) {
            pattern.setAttribute('href', color.image);
            wall.style.fill = `url(#${id})`;
          } else {
            wall.style.fill = 'var(--wall)';
          }
        });

        const chip = this.querySelector('[data-now-chip]');
        chip.style.backgroundImage = color.image ? `url('${color.image}')` : '';
        this.querySelector('[data-now-code]').textContent = color.catalogue === 'Motivo' ? `Motivo · ${color.code}` : `Vitex · № ${color.code}`;
        this.querySelector('[data-now-name]').textContent = color.name;

        this.grid.querySelectorAll('[aria-pressed="true"]').forEach((el) => el.setAttribute('aria-pressed', 'false'));
        const inGrid = this.grid.querySelector(`[data-code="${color.code}"]`);
        if (inGrid) inGrid.setAttribute('aria-pressed', 'true');

        if (userAction) {
          this.remember(color);
          const url = new URL(window.location.href);
          url.searchParams.set('color', color.code);
          window.history.replaceState(null, '', url.toString());
        }
        window.Hameleon = window.Hameleon || {};
        window.Hameleon.currentColor = color;
        document.dispatchEvent(new CustomEvent('hameleon:color', { detail: color }));
      }

      remember(color) {
        this.recent = [color, ...this.recent.filter((c) => c.code !== color.code)].slice(0, 8);
        const box = this.querySelector('[data-recent]');
        box.hidden = this.recent.length < 2;
        box.innerHTML =
          'Последно: ' +
          this.recent
            .map(
              (c) =>
                `<button type="button" data-code="${c.code}" title="${c.code} · ${c.name.replace(/"/g, '&quot;')}" aria-label="${c.code} ${c.name.replace(/"/g, '&quot;')}" style="background:${c.hex}${c.image ? ` url('${c.image}') center/cover` : ''}"></button>`
            )
            .join('');
      }

      /* Lists the paint lines in the cart, with the colour code each one carries. */
      async loadOrder() {
        const box = this.querySelector('[data-order]');
        try {
          const response = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
          if (!response.ok) return;
          const cart = await response.json();
          const lines = cart.items.filter((item) => item.properties && item.properties['Цвят']);
          if (!lines.length) {
            box.hidden = true;
            return;
          }
          const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
          this.querySelector('[data-order-lines]').innerHTML = lines
            .map((item) => {
              const code = String(item.properties['Цвят']).split(' ')[0];
              const color = this.colorFromCode(item.properties['Каталог'] === 'Motivo' ? code : code);
              const swatch = color ? `background:${color.hex}${color.image ? ` url('${color.image}') center/cover` : ''}` : 'background:#f4f4f0';
              return `<li class="hm-cat__line"><i style="${swatch}"></i><span><strong>${item.quantity} × ${esc(item.product_title)} ${esc(item.variant_title || '')}</strong> · ${esc(item.properties['Цвят'])}</span></li>`;
            })
            .join('');
          const total = lines.reduce((sum, item) => sum + item.final_line_price, 0);
          this.querySelector('[data-order-total]').innerHTML = `Общо за боята: <strong>${(total / 100).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>`;
          box.hidden = false;
        } catch (e) {
          box.hidden = true;
        }
      }
    }
  );
}

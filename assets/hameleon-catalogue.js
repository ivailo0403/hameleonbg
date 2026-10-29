/*
  Хамелеон: paint catalogue page (sections/hameleon-paint-catalogue.liquid).
  Picking a colour paints the room's wall, remembers it in "Последно", puts ?color=CODE in the
  address and sends a "hameleon:color" event that the calculator listens to.
  Colours come from assets/hameleon-colors.js: Vitex Global Collection, Vitex Colourful Collection and Motivo.
  The tabs are "global", "colourful" and "motivo"; "vitex" means Global.
*/
window.Hameleon = window.Hameleon || {};

/* A colour code that is not in our catalogues (RAL, NCS, another brand's fan deck): we tint by the code in the store. */
window.Hameleon.customColor =
  window.Hameleon.customColor ||
  ((code) => ({ code: String(code).trim(), name: 'друг каталог', hex: '', catalogue: 'Друг каталог', custom: true }));

/* The stripes shown for a colour we cannot draw on screen. */
window.Hameleon.customSwatch = 'repeating-linear-gradient(135deg, #f4f4f0 0 8px, #e2e5e3 8px 16px)';

if (!customElements.get('hameleon-catalogue')) {
  customElements.define(
    'hameleon-catalogue',
    class HameleonCatalogue extends HTMLElement {
      connectedCallback() {
        this.motivo = window.HameleonMotivo || [];
        this.bases = window.HameleonMotivoBases || [];
        /* A plaster product page shows only its own base (Silver, Gold or Titanium). */
        this.lockedBase = this.dataset.base || '';
        this.base = this.lockedBase || 'all';
        this.tab = 'global';
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
          if (event.target.closest('[data-custom-code]')) {
            const code = this.querySelector('[data-search]').value.replace(/[<>"]/g, '').trim().slice(0, 40).toUpperCase();
            if (code) this.select(window.Hameleon.customColor(code), true);
            return;
          }
          if (event.target.closest('[data-more]')) {
            this.limit += window.matchMedia('(min-width: 990px)').matches ? 240 : 60;
            this.render(true);
            return;
          }
          const chip = event.target.closest('[data-code]');
          if (chip) this.select(this.colorFromCode(chip.dataset.code, chip.dataset.col), true);
        });
        this.querySelector('[data-recent]').addEventListener('click', (event) => {
          const chip = event.target.closest('[data-code]');
          if (chip) this.select(this.colorFromCode(chip.dataset.code, chip.dataset.col), true);
        });
        this.querySelector('[data-now-go]').addEventListener('click', (event) => {
          event.preventDefault();
          this.querySelector('#kalkulator').scrollIntoView({ behavior: 'smooth' });
        });
        document.addEventListener('hameleon:open-catalogue', (event) => {
          const detail = event.detail || {};
          if (detail.base && !this.lockedBase) this.setBase(detail.base);
          if (detail.catalogue === 'Motivo' && !this.dataset.only) this.setTab('motivo');
          else if (detail.catalogue !== 'Motivo' && this.tab === 'motivo' && this.dataset.only !== 'motivo') this.setTab('global');
          this.querySelector('#katalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        document.addEventListener('hameleon:cart-updated', () => this.loadOrder());
        /* A code typed elsewhere on the page (the colour box next to "Add to cart"). */
        document.addEventListener('hameleon:pick-code', (event) => {
          const detail = event.detail || {};
          const color = (detail.color && !detail.color.custom && detail.color) || this.colorFromCode(detail.code);
          if (color) this.select(color, true);
        });

        const params = new URLSearchParams(window.location.search);
        this.tab = this.tabName(params.get('tab'));
        if (params.get('base') && !this.lockedBase && window.Hameleon.motivo.base(params.get('base'))) this.base = params.get('base');
        /* The paint product page shows only the catalogue that fits the product. */
        if (this.dataset.only === 'motivo') this.tab = 'motivo';
        if (this.dataset.only === 'vitex' && this.tab === 'motivo') this.tab = 'global';
        this.renderBases();
        this.setTab(this.tab);
        /* On the product page nothing is chosen until the visitor picks, so the order never gets a colour they did not choose. */
        const fallback = this.hasAttribute('data-no-default') ? null : this.colorFromCode(this.tab === 'motivo' ? 'SS-001' : '0675', 'global');
        const first = this.colorFromCode(params.get('color')) || fallback;
        /* Wait a tick so the calculator (defined in another deferred script) hears the first colour. */
        setTimeout(() => this.select(first, false), 0);
        this.loadOrder();
      }

      escape(text) {
        return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      }

      tabName(tab) {
        if (tab === 'motivo' || tab === 'colourful') return tab;
        return 'global';
      }

      families() {
        const collection = window.Hameleon.vitex.collection(this.tab);
        return collection ? collection.families() : [];
      }

      /* collection: 'global' or 'colourful' (or "Vitex Colourful Collection" from a cart line); the two share some codes. */
      colorFromCode(code, collection) {
        const value = String(code || '').trim();
        if (!value) return null;
        /* Motivo codes carry their base letter (SS-012); a bare number counts only on a plaster page or tab. */
        const V = window.Hameleon.vitex;
        const wanted = V.collection(collection || '');
        if ((/^[sgt]/i.test(value) || this.tab === 'motivo') && !wanted) {
          const plaster = window.Hameleon.motivo.find(value, this.base === 'all' ? '' : this.base, this.dataset.motivoBase);
          if (plaster && (!this.lockedBase || plaster.base === this.lockedBase)) return plaster;
          if (/^[sgt]/i.test(value)) return null;
        }
        return V.find(value, wanted ? wanted.key : this.tab);
      }

      setTab(tab) {
        tab = this.tabName(tab);
        const changed = tab !== this.tab || !this.familiesDone;
        this.tab = tab;
        this.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
        this.querySelector('[data-families]').hidden = tab === 'motivo';
        if (changed && tab !== 'motivo') {
          this.family = 'all';
          this.renderFamilies();
          this.familiesDone = true;
        }
        if (this.dataset.only !== 'motivo') {
          this.querySelector('[data-search]').placeholder = {
            motivo: 'Код, напр. SS-012 или G5',
            global: 'Код или име, напр. 0675',
            colourful: 'Код, напр. CL 11 или 150-10 R',
          }[tab];
        }
        const bases = this.querySelector('[data-bases]');
        if (bases) bases.hidden = tab !== 'motivo' || Boolean(this.lockedBase);
        this.render();
      }

      setBase(key) {
        this.base = key;
        this.querySelectorAll('[data-base-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.baseBtn === key)));
        this.render();
      }

      renderBases() {
        const list = this.querySelector('[data-bases]');
        if (!list) return;
        const count = (key) => this.motivo.filter((m) => key === 'all' || m[0].startsWith(window.Hameleon.motivo.base(key).prefix)).length;
        const sample = (key) => {
          const first = this.motivo.find((m) => m[0].startsWith(window.Hameleon.motivo.base(key).prefix));
          return first ? `#${first[1]}` : '#ccc';
        };
        const button = (key, name, dot) =>
          `<li><button type="button" class="hm-cat__family" data-base-btn="${key}" aria-pressed="${key === this.base}">` +
          `<i style="background:${dot}"></i>${name} <small>${count(key)}</small></button></li>`;
        list.innerHTML =
          button('all', 'Всички', 'conic-gradient(#C9CDD0, #C9A24A, #50575D, #C9CDD0)') +
          this.bases.map((b) => button(b.key, b.name, sample(b.key))).join('');
        list.querySelectorAll('[data-base-btn]').forEach((b) => b.addEventListener('click', () => this.setBase(b.dataset.baseBtn)));
      }

      setScene(scene) {
        this.querySelectorAll('[data-scene]').forEach((s) => (s.hidden = s.dataset.scene !== scene));
        this.querySelectorAll('[data-scene-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sceneBtn === scene)));
      }

      renderFamilies() {
        const list = this.querySelector('[data-families]');
        const families = this.families();
        const total = families.reduce((sum, f) => sum + f.items.length, 0);
        const hex = (item) => item[item.length - 1];
        const button = (key, name, dot, count) =>
          `<li><button type="button" class="hm-cat__family" data-family="${key}" aria-pressed="${key === this.family}">` +
          `<i style="background:${dot}"></i>${name} <small>${count}</small></button></li>`;
        list.innerHTML =
          button('all', 'Всички', 'conic-gradient(#FED426, #FE9A28, #F89495, #D771AF, #0095AB, #217553, #FED426)', total) +
          families.map((f) => button(f.key, f.name, `#${hex(f.items[Math.floor(f.items.length * 0.6)])}`, f.items.length)).join('');
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
          const M = window.Hameleon.motivo;
          const typed = q ? M.normalize(q, this.base === 'all' ? '' : this.base) : '';
          /* A typed base letter ("t7") searches that base, unless the page is locked to one. */
          let prefix = this.base === 'all' ? '' : M.base(this.base).prefix;
          if (typed && /^[sgt]/i.test(q) && !this.lockedBase) prefix = typed.slice(0, 2);
          items = this.motivo
            .filter((m) => !prefix || m[0].startsWith(prefix))
            .filter((m) => !q || m[0] === typed || m[0].toLowerCase().includes(q) || (/^\d+$/.test(q) && String(parseInt(m[0].slice(3), 10)).startsWith(q)))
            .map((m) => {
              const color = M.find(m[0], '', this.dataset.motivoBase);
              return { code: m[0], label: m[0], name: color.name, style: `background-image:url('${color.image}');background-color:#${m[1]}` };
            });
        } else {
          const V = window.Hameleon.vitex;
          const collection = V.collection(this.tab);
          const families = this.families();
          const pool = this.family === 'all' || q ? families : families.filter((f) => f.key === this.family);
          /* "893" finds 0893; "cl1" finds CL 11…; Global colours also by name. */
          const key = V.key(q);
          items = pool
            .flatMap((f) => f.items.map((c) => ({ c, family: f.name })))
            .filter(({ c }) => {
              if (!q) return true;
              const code = V.key(c[0]);
              return code.startsWith(key) || code.replace(/^0+/, '').startsWith(key) || (c.length > 2 && c[1].toLowerCase().includes(q));
            })
            .sort((a, b) => (q ? String(a.c[0]).localeCompare(String(b.c[0]), 'en', { numeric: true }) : 0))
            .map(({ c, family }) => {
              const color = V.color(collection, c, { name: family });
              return { code: color.code, col: collection.key, label: `№ ${color.code}`, name: color.name || family, style: `background:${color.hex}` };
            });
        }
        const current = this.current ? this.current.code : '';
        const currentCol = this.current && this.current.collection ? window.Hameleon.vitex.collection(this.current.collection).key : '';
        this.querySelector('[data-count]').textContent = items.length
          ? `${items.length} ${items.length === 1 ? 'цвят' : 'цвята'}`
          : '';
        const shown = items.slice(0, this.limit);
        this.grid.innerHTML = items.length
          ? shown
              .map(
                (i) =>
                  `<button type="button" class="hm-chip" data-code="${i.code}"${i.col ? ` data-col="${i.col}"` : ''} aria-pressed="${i.code === current && (!i.col || i.col === currentCol)}" aria-label="${i.label} ${i.name.replace(/"/g, '&quot;')}">` +
                  `<span class="hm-chip__color" style="${i.style}"></span>` +
                  `<span class="hm-chip__meta"><span class="hm-chip__code">${i.label}</span><span class="hm-chip__name">${i.name}</span></span></button>`
              )
              .join('')
          : `<div class="hm-cat__empty"><p>Няма такъв цвят в каталога ${this.tab === 'motivo' ? 'Motivo' : `Vitex ${window.Hameleon.vitex.collection(this.tab).name}`}. Ако кодът е от друг каталог (RAL, NCS, друга марка), пак можем да тонираме по него.</p>` +
            `<button type="button" class="hm-btn hm-btn--primary" data-custom-code>Поръчайте с код „${this.escape(this.query.toUpperCase())}“</button></div>`;
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
        this.style.setProperty('--wall', color.hex || '#e8e2d6');

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
        chip.style.backgroundImage = color.image ? `url('${color.image}')` : color.custom ? window.Hameleon.customSwatch : '';
        this.querySelector('[data-now-code]').textContent = color.custom
          ? 'Друг каталог'
          : color.catalogue === 'Motivo'
            ? `Motivo · ${color.code}`
            : color.name
              ? `Vitex ${String(color.collection || '').replace(' Collection', '')} · № ${color.code}`
              : `Vitex ${color.collection}`;
        /* Colourful colours have no name: the code is the big line ("№ NC 110", never split). */
        this.querySelector('[data-now-name]').textContent = color.custom
          ? `Код ${color.code}`
          : color.name || `№ ${color.code}`.replace(/ /g, '\u00a0');

        this.grid.querySelectorAll('[aria-pressed="true"]').forEach((el) => el.setAttribute('aria-pressed', 'false'));
        const col = color.collection ? window.Hameleon.vitex.collection(color.collection).key : '';
        const inGrid = color.custom ? null : this.grid.querySelector(`[data-code="${CSS.escape(color.code)}"]${col ? `[data-col="${col}"]` : ''}`);
        if (inGrid) inGrid.setAttribute('aria-pressed', 'true');

        if (userAction && !color.custom) {
          this.remember(color);
          const url = new URL(window.location.href);
          url.searchParams.set('color', color.code);
          url.searchParams.set('tab', col || 'motivo');
          window.history.replaceState(null, '', url.toString());
        }
        window.Hameleon = window.Hameleon || {};
        window.Hameleon.currentColor = color;
        document.dispatchEvent(new CustomEvent('hameleon:color', { detail: color }));
      }

      remember(color) {
        this.recent = [color, ...this.recent.filter((c) => c.code !== color.code || c.collection !== color.collection)].slice(0, 8);
        const colKey = (c) => (c.collection ? window.Hameleon.vitex.collection(c.collection).key : '');
        const title = (c) => [c.code, c.name || (c.collection ? `Vitex ${c.collection}` : '')].filter(Boolean).join(' · ').replace(/"/g, '&quot;');
        const box = this.querySelector('[data-recent]');
        box.hidden = this.recent.length < 2;
        box.innerHTML =
          'Последно: ' +
          this.recent
            .map(
              (c) =>
                `<button type="button" data-code="${c.code}"${colKey(c) ? ` data-col="${colKey(c)}"` : ''} title="${title(c)}" aria-label="${title(c)}" style="background:${c.hex}${c.image ? ` url('${c.image}') center/cover` : ''}"></button>`
            )
            .join('');
      }

      /* Lists the paint lines in the cart, with the colour code each one carries. */
      async loadOrder() {
        const box = this.querySelector('[data-order]');
        if (!box) return;
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
              /* Colourful codes have spaces ("CL 11") and no name; other lines are "code name". */
              const catalogue = String(item.properties['Каталог'] || '');
              const text = String(item.properties['Цвят']);
              const code = /Colourful/.test(catalogue) ? text : text.split(' ')[0];
              const color = this.colorFromCode(code, catalogue);
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

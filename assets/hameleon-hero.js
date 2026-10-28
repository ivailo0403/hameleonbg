/*
  Хамелеон: home hero (sections/hameleon-hero.liquid).
  The room's wall cycles through the "wall colours" until the visitor picks one, from the
  family tabs and shades under the hero or from the mini catalogue behind the fan deck.
  Colours come from assets/hameleon-colors.js.
*/
if (!customElements.get('hameleon-hero')) {
  customElements.define(
    'hameleon-hero',
    class HameleonHero extends HTMLElement {
      connectedCallback() {
        this.wall = this.querySelector('[data-hm-wall]');
        this.nameEl = this.querySelector('[data-hm-wall-name]');
        this.codeEl = this.querySelector('[data-hm-wall-code]');
        this.order = this.querySelector('[data-hm-wall-order]');
        this.deck = this.querySelector('[data-hm-deck]');
        this.mini = this.querySelector('[data-hm-mini]');
        this.shades = this.querySelector('[data-hm-shades]');
        this.families = (window.HameleonColors && window.HameleonColors.families) || [];

        this.startCycle();

        this.querySelectorAll('[data-hm-family]').forEach((button) =>
          button.addEventListener('click', () => this.showFamily(button.dataset.hmFamily, true))
        );
        if (this.families.length) this.showFamily(this.families[0].key, false);

        this.deck.addEventListener('click', () => this.toggleMini());
        this.querySelector('[data-hm-mini-close]').addEventListener('click', () => this.toggleMini(false));
        this.querySelector('[data-hm-mini-search]').addEventListener('input', (event) => this.renderMini(null, event.target.value));
        this.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && !this.mini.hidden) {
            this.toggleMini(false);
            this.deck.focus();
          }
        });
        this.addEventListener('click', (event) => {
          const swatch = event.target.closest('[data-code]');
          if (swatch) this.pick(swatch);
        });
      }

      startCycle() {
        let colors = [];
        try {
          colors = JSON.parse(this.dataset.wallColors || '[]')
            .map((line) => line.trim().split('|'))
            .filter((parts) => parts.length === 2)
            .map((parts) => ({ name: parts[0].trim(), hex: parts[1].trim() }));
        } catch (e) {
          colors = [];
        }
        if (!colors.length) return;
        let i = 0;
        const show = () => {
          const c = colors[i % colors.length];
          const found = this.findByHex(c.hex);
          this.paint(found ? found : { name: c.name, hex: c.hex, code: '' });
          i++;
        };
        show();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.timer = setInterval(show, 2800);
      }

      findByHex(hex) {
        const value = String(hex).replace('#', '').toUpperCase();
        for (const family of this.families) {
          const item = family.items.find((c) => c[2] === value);
          if (item) return { code: String(item[0]), name: item[1], hex: `#${item[2]}` };
        }
        return null;
      }

      paint(color) {
        this.style.setProperty('--wall', color.hex);
        this.nameEl.textContent = color.name;
        this.codeEl.textContent = color.code ? `№ ${color.code}` : '';
        const base = this.dataset.catalogueUrl;
        if (base && color.code) {
          const url = new URL(base, window.location.origin);
          url.searchParams.set('color', color.code);
          this.order.href = url.pathname + url.search;
        }
      }

      pick(swatch) {
        clearInterval(this.timer);
        this.querySelectorAll('[data-code][aria-pressed="true"]').forEach((el) => el.setAttribute('aria-pressed', 'false'));
        this.querySelectorAll(`[data-code="${swatch.dataset.code}"]`).forEach((el) => el.setAttribute('aria-pressed', 'true'));
        this.paint({ code: swatch.dataset.code, name: swatch.dataset.name, hex: swatch.dataset.hex });
      }

      swatchHTML(c) {
        const name = String(c[1]).replace(/"/g, '&quot;');
        return `<button type="button" class="hm-swatch" style="background:#${c[2]}" data-code="${c[0]}" data-name="${name}" data-hex="#${c[2]}" title="${c[0]} · ${name}" aria-label="${c[0]} ${name}" aria-pressed="false"></button>`;
      }

      showFamily(key, userAction) {
        const family = this.families.find((f) => f.key === key);
        if (!family) return;
        this.querySelectorAll('[data-hm-family]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hmFamily === key && userAction)));
        this.shades.innerHTML = family.items.map((c) => this.swatchHTML(c)).join('');
        this.shades.scrollLeft = 0;
        if (userAction) {
          const middle = family.items[Math.floor(family.items.length / 2)];
          this.pick(this.shades.querySelector(`[data-code="${middle[0]}"]`));
        }
      }

      toggleMini(force) {
        const open = force === undefined ? this.mini.hidden : force;
        this.mini.hidden = !open;
        this.deck.setAttribute('aria-expanded', String(open));
        if (open) {
          if (!this.miniFamily) this.renderMini(this.families.length ? this.families[1].key : null, '');
          this.querySelector('[data-hm-mini-search]').focus({ preventScroll: true });
        }
      }

      renderMini(key, query) {
        if (key) this.miniFamily = key;
        const tabs = this.querySelector('[data-hm-mini-tabs]');
        const grid = this.querySelector('[data-hm-mini-grid]');
        const q = String(query || '').trim().toLowerCase();
        tabs.innerHTML = this.families
          .map((f) => {
            const dot = f.items[Math.floor(f.items.length * 0.6)];
            return `<button type="button" class="hm-mini__tab" data-mini-family="${f.key}" aria-pressed="${!q && f.key === this.miniFamily}"><i style="background:#${dot[2]}"></i>${f.name}</button>`;
          })
          .join('');
        tabs.querySelectorAll('[data-mini-family]').forEach((b) =>
          b.addEventListener('click', () => {
            this.querySelector('[data-hm-mini-search]').value = '';
            this.renderMini(b.dataset.miniFamily, '');
          })
        );
        let items;
        if (q) {
          items = this.families.flatMap((f) => f.items).filter((c) => String(c[0]).startsWith(q) || c[1].toLowerCase().includes(q)).slice(0, 120);
        } else {
          const family = this.families.find((f) => f.key === this.miniFamily);
          items = family ? family.items : [];
        }
        grid.innerHTML = items.length
          ? items.map((c) => this.swatchHTML(c)).join('')
          : '<p style="grid-column: 1 / -1; margin: 0; color: var(--hm-text-muted);">Няма такъв цвят. Опитайте с друг код.</p>';
      }
    }
  );
}

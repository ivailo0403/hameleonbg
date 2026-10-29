/*
  Хамелеон: colour box above "Add to cart" (snippets/hameleon-product-color.liquid).
  Keeps the hidden properties[Цвят], properties[Каталог] and properties[_hex] of the product form
  in step with the chosen colour, and stops "Add to cart" until a colour is chosen when required.
  Colours come from assets/hameleon-colors.js.
*/
window.Hameleon = window.Hameleon || {};

/* A colour code that is not in our catalogues (RAL, NCS, another brand's fan deck): we tint by the code in the store. */
window.Hameleon.customColor =
  window.Hameleon.customColor ||
  ((code) => ({ code: String(code).trim(), name: 'друг каталог', hex: '', catalogue: 'Друг каталог', custom: true }));

/* The stripes shown for a colour we cannot draw on screen. */
window.Hameleon.customSwatch = 'repeating-linear-gradient(135deg, #f4f4f0 0 8px, #e2e5e3 8px 16px)';

if (!customElements.get('hameleon-product-color')) {
  customElements.define(
    'hameleon-product-color',
    class HameleonProductColor extends HTMLElement {
      connectedCallback() {
        this.catalogue = this.dataset.catalogue === 'motivo' ? 'Motivo' : 'Vitex';
        this.color = null;
        this.props = {
          color: this.querySelector('[data-prop="color"]'),
          catalogue: this.querySelector('[data-prop="catalogue"]'),
          hex: this.querySelector('[data-prop="hex"]'),
        };

        document.addEventListener('hameleon:color', (event) => this.set(event.detail));

        /* With the studio on the page, "Изберете" scrolls to it; otherwise it opens the catalogue page. */
        this.querySelector('[data-open]').addEventListener('click', (event) => {
          const studio = document.getElementById('katalog');
          if (!studio) return;
          event.preventDefault();
          studio.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        this.querySelector('[data-code-form]').addEventListener('submit', (event) => {
          event.preventDefault();
          this.applyCode(this.querySelector('[data-code-input]').value);
        });

        /* Runs before Dawn's product form handler, so the line never goes in without a colour. */
        this.onSubmit = (event) => {
          /* getAttribute: the form's own input named "id" hides form.id. */
          if (event.target.getAttribute('id') !== this.dataset.form || this.color || this.isWhite || !this.hasAttribute('data-required')) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          this.message('Изберете цвят, за да добавим боята в количката. Въведете кода от мострата или изберете от каталога по-долу.', true);
          this.classList.remove('is-shaking');
          void this.offsetWidth;
          this.classList.add('is-shaking');
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        document.addEventListener('submit', this.onSubmit, true);

        /* The floating button shows only while the colour box is off screen. */
        this.float = this.querySelector('[data-float]');
        this.float.addEventListener('click', () => {
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const add = document.querySelector(`#${CSS.escape(this.dataset.form)} [name="add"]`);
          if (add) setTimeout(() => add.focus({ preventScroll: true }), 600);
        });
        if ('IntersectionObserver' in window) {
          new IntersectionObserver((entries) => {
            this.offScreen = !entries[0].isIntersecting;
            this.toggleFloat();
          }).observe(this.querySelector('[data-card]'));
        }

        const fromUrl = new URLSearchParams(window.location.search).get('color');
        if (fromUrl) this.set(this.find(fromUrl));

        /* Sizes sold only in white (e.g. Vito 15 л): no colour box, the line goes in as white. */
        this.whiteIds = String(this.dataset.whiteVariants || '').split(',').filter(Boolean);
        if (this.whiteIds.length) {
          this.white(this.dataset.variant);
          if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            this.unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
              const variant = event.data && event.data.variant;
              this.white(variant ? variant.id : null);
            });
          }
        }
      }

      /* Switches the box between "white only" for the chosen variant and the normal colour choice. */
      white(variantId) {
        const isWhite = variantId != null && this.whiteIds.includes(String(variantId));
        if (isWhite === Boolean(this.isWhite)) return;
        this.isWhite = isWhite;
        this.classList.toggle('is-white', isWhite);
        const name = this.querySelector('[data-name]');
        const chip = this.querySelector('[data-chip]');
        const label = this.querySelector('.hm-pcol__label');
        if (!this.labelText) this.labelText = label.textContent;
        label.textContent = isWhite ? 'Цвят' : this.labelText;
        if (isWhite) {
          this.props.color.value = 'Бяла (без тониране)';
          this.props.catalogue.value = '—';
          this.props.hex.value = '';
          this.props.color.disabled = false;
          this.props.catalogue.disabled = false;
          this.props.hex.disabled = true;
          chip.style.background = '#ffffff';
          name.textContent = 'Само бяла, без тониране';
          this.message('Тази разфасовка се продава само в бяло. За цвят изберете 1, 3 или 9 л.', false);
          this.float.hidden = true;
        } else if (this.color) {
          const color = this.color;
          this.color = null;
          this.set(color);
        } else {
          Object.values(this.props).forEach((input) => {
            input.value = '';
            input.disabled = true;
          });
          chip.style.background = '';
          name.textContent = 'Не е избран';
          this.message('', false);
        }
      }

      disconnectedCallback() {
        document.removeEventListener('submit', this.onSubmit, true);
        if (this.unsubscribe) this.unsubscribe();
      }

      find(code) {
        const value = String(code || '').trim().replace(/^№\s*/, '');
        if (!value) return null;
        /* Motivo: "12" means 12 in this product's base; "SS-012" or "S12" must be this base too. */
        if (this.catalogue === 'Motivo' && window.Hameleon.motivo) {
          const color = window.Hameleon.motivo.find(value, this.dataset.base, this.dataset.motivoBase);
          return color && (!this.dataset.base || color.base === this.dataset.base) ? color : null;
        }
        if (this.catalogue === 'Vitex' && window.HameleonColors) {
          const q = value.toLowerCase();
          for (const family of window.HameleonColors.families) {
            const item = family.items.find((c) => String(c[0]) === value || c[1].toLowerCase() === q);
            if (item) return { code: String(item[0]), name: item[1], hex: `#${item[2]}`, catalogue: 'Vitex' };
          }
        }
        return null;
      }

      applyCode(code) {
        const value = String(code || '').replace(/[<>"]/g, '').trim().slice(0, 40);
        if (!value) return;
        /* A Motivo code from another base (e.g. SS-012 on Motivo Gold) is a mistake, not a custom colour. */
        if (this.catalogue === 'Motivo' && this.dataset.base && window.Hameleon.motivo) {
          const other = window.Hameleon.motivo.find(value, '', '');
          if (other && other.base !== this.dataset.base) {
            this.message(`${other.code} е цвят за ${other.name}. За тази мазилка изберете код, който започва с ${window.Hameleon.motivo.base(this.dataset.base).prefix}.`, true);
            return;
          }
        }
        /* A code from another brand's fan deck (RAL, NCS, …) is fine too: we tint by it in the store. */
        const color = this.find(value) || window.Hameleon.customColor(value);
        this.querySelector('[data-code-input]').value = '';
        /* The studio paints the room and tells the calculator; without it, this box takes the colour itself. */
        if (document.querySelector('hameleon-catalogue')) {
          document.dispatchEvent(new CustomEvent('hameleon:pick-code', { detail: { code: color.code, color } }));
        } else {
          document.dispatchEvent(new CustomEvent('hameleon:color', { detail: color }));
        }
      }

      set(color) {
        if (!color || (color.catalogue !== this.catalogue && !color.custom)) return;
        if (color.base && this.dataset.base && color.base !== this.dataset.base) return;
        this.color = color;
        /* A white-only size keeps its "white" line; the colour waits for a tintable size. */
        if (this.isWhite) return;
        this.props.color.value = color.custom ? color.code : `${color.code} ${color.name}`;
        this.props.catalogue.value = color.catalogue;
        this.props.hex.value = color.hex || '';
        Object.values(this.props).forEach((input) => (input.disabled = !input.value));

        const chip = this.querySelector('[data-chip]');
        const name = this.querySelector('[data-name]');
        if (color.custom) {
          chip.style.background = window.Hameleon.customSwatch;
          name.textContent = `Код ${color.code} · друг каталог`;
          this.message('Тонираме по Вашия код. Този цвят не можем да покажем на екрана, затова стаята остава неутрална.', false);
        } else {
          chip.style.background = color.image ? `center / cover url("${color.image}") ${color.hex}` : color.hex;
          name.textContent = color.catalogue === 'Motivo' ? `${color.code} · ${color.name}` : `№ ${color.code} · ${color.name}`;
          this.message('', false);
        }
        this.querySelector('[data-open-label]').textContent = 'Смени';
        this.classList.add('has-color');
        this.querySelector('[data-float-chip]').style.background = chip.style.background;
        this.querySelector('[data-float-name]').textContent = name.textContent;
        this.toggleFloat();
      }

      toggleFloat() {
        const show = Boolean(this.color && this.offScreen && !this.isWhite);
        this.float.hidden = !show;
        this.float.classList.toggle('is-on', show);
      }

      message(text, isError) {
        const msg = this.querySelector('[data-msg]');
        msg.textContent = text;
        msg.hidden = !text;
        msg.classList.toggle('is-error', Boolean(isError));
      }
    }
  );
}

/*
  Хамелеон: colour box above "Add to cart" (snippets/hameleon-product-color.liquid).
  Keeps the hidden properties[Цвят], properties[Каталог] and properties[_hex] of the product form
  in step with the chosen colour, and stops "Add to cart" until a colour is chosen when required.
  Colours come from assets/hameleon-colors.js.
*/
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
          if (event.target.getAttribute('id') !== this.dataset.form || this.color || !this.hasAttribute('data-required')) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          this.message('Изберете цвят, за да добавим боята в количката. Въведете кода от мострата или изберете от каталога по-долу.', true);
          this.classList.remove('is-shaking');
          void this.offsetWidth;
          this.classList.add('is-shaking');
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        document.addEventListener('submit', this.onSubmit, true);

        const fromUrl = new URLSearchParams(window.location.search).get('color');
        if (fromUrl) this.set(this.find(fromUrl));
      }

      disconnectedCallback() {
        document.removeEventListener('submit', this.onSubmit, true);
      }

      find(code) {
        const value = String(code || '').trim().replace(/^№\s*/, '');
        if (!value) return null;
        const motivo = value.match(/^m?-?\s*(\d+)$/i);
        if (this.catalogue === 'Motivo' && motivo && window.HameleonMotivo) {
          const n = parseInt(motivo[1], 10);
          const item = window.HameleonMotivo.find((m) => m[0] === n);
          if (!item) return null;
          const image = String(this.dataset.motivoBase || '').replace('hm-motivo-01', `hm-motivo-${String(n).padStart(2, '0')}`);
          return { code: `M${n}`, name: `Motivo ${n}`, hex: `#${item[1]}`, catalogue: 'Motivo', image };
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
        if (!String(code || '').trim()) return;
        const color = this.find(code);
        if (!color) {
          this.message(`Няма цвят „${String(code).trim()}“ в каталога ${this.catalogue}. Проверете кода от мострата.`, true);
          return;
        }
        this.querySelector('[data-code-input]').value = '';
        /* The studio paints the room and tells the calculator; without it, this box takes the colour itself. */
        if (document.querySelector('hameleon-catalogue')) {
          document.dispatchEvent(new CustomEvent('hameleon:pick-code', { detail: { code: color.code } }));
        } else {
          document.dispatchEvent(new CustomEvent('hameleon:color', { detail: color }));
        }
      }

      set(color) {
        if (!color || color.catalogue !== this.catalogue) return;
        this.color = color;
        this.props.color.value = `${color.code} ${color.name}`;
        this.props.catalogue.value = color.catalogue;
        this.props.hex.value = color.hex;
        Object.values(this.props).forEach((input) => (input.disabled = false));

        const chip = this.querySelector('[data-chip]');
        chip.style.background = color.image ? `center / cover url("${color.image}") ${color.hex}` : color.hex;
        this.querySelector('[data-name]').textContent = color.catalogue === 'Motivo' ? `${color.code} · Motivo` : `№ ${color.code} · ${color.name}`;
        this.querySelector('[data-open-label]').textContent = 'Смени';
        this.classList.add('has-color');
        this.message('', false);
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

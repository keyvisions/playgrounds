// deno-lint-ignore-file no-window
class WMSPlace extends HTMLElement {
	#codeInput

	constructor() {
		super();
		this.classList.add("wms");
	}

	connectedCallback() {
		this.innerHTML = `
			<label><span><i class="fa-solid fa-fw fa-box"></i> Unità di Carico (UdC)</span><br><input form name="lu" placeholder="es. 123456789" style="font-size: x-large" readonly></label>
			<label><span><i class="fa-solid fa-fw fa-warehouse"></i> Unità di Deposito (UdD)</span><br><input form name="location" placeholder="es. A01 001 01" style="font-size: x-large" readonly></label>
			<input form name="code" placeholder="codice" style="font-size: x-large" autofocus>
			<div id="sentiments" aria-disabled="true" style="display: flex; column-gap: 0.4em;">
				<div id="S1" class="sentiment">1</div>
				<div id="S2" class="sentiment">2</div>
				<div id="S3" class="sentiment">3</div>
				<div id="S4" class="sentiment">4</div>
				<div id="S5" class="sentiment">5</div>
			</div>
			<span style="font-size:small">A sentimento, quanto pieno è l'UdD?</span>
		`;

		this.#codeInput = this.querySelector('input[name=code]');

		// Register oncheck handler from attribute if present, else set default
		if (this.hasAttribute('oncheck')) {
			const fnName = this.getAttribute("oncheck").replace(/\(.*\)/, "").trim();
			if (typeof window[fnName] === 'function') {
				this.oncheck = window[fnName];
			} else {
				this.oncheck = () => false;
			}
		} else {
			this.oncheck = () => false;
		}
		this.#codeInput.addEventListener('change', async (event) => {
			const exists = await this.oncheck(this.#codeInput.value);
			this.#check(event, this.#codeInput, exists);
		});
		const sentiments = this.querySelector('#sentiments');
		sentiments.addEventListener('click', (event) => this.#allocate(event));
		this.#codeInput.focus();
	}

	#check(_event, el, exists = false) {
		const REGEX_LOCATION = /^[A-Za-z]\d{7}$/;
		const REGEX_LU = /^\d{1,9}$/;

		const Location = this.querySelector('[name=location]');
		const LU = this.querySelector('[name=lu]');
		const sentiments = this.querySelector('#sentiments');

		el.classList.remove('failureBox');
		if (REGEX_LOCATION.test(el.value) && exists) {
			Location.value = el.value.toUpperCase().replace(/^([A-Za-z])(\d{2})(\d{3})(\d{2})$/, "$1$2 $3 $4");
			Location.className = exists ? 'successBox' : 'warningBox';
			el.value = '';

		} else if (/^[0-5]$/.test(el.value)) {
			if (Location.value && LU.value)
				this.querySelector(`#S${el.value}`).click();
			el.value = '';

		} else if (REGEX_LU.test(el.value)) {
			LU.value = el.value.padStart(9, '0');
			LU.className = exists ? 'successBox' : 'warningBox';
			el.value = '';

		} else {
			el.classList.add('failureBox');
		}

		if (Location.value && LU.value)
			sentiments.setAttribute('aria-disabled', 'false');
		else
			sentiments.setAttribute('aria-disabled', 'true');

		this.#codeInput.focus()
	}

	#allocate(event) {
		event.stopPropagation();
		event.preventDefault();

		const sentiments = this.querySelector('#sentiments');
		if (sentiments.getAttribute('aria-disabled') === 'true' || event.target.className !== 'sentiment')
			return;

		if (this.hasAttribute('onsubmit')) {
			const fnName = this.getAttribute('onsubmit').replace(/\(.*\)/, '').trim();
			if (typeof window[fnName] === 'function') {
				window[fnName].call(this, {
					lu: this.querySelector('[name=lu]').value,
					location: this.querySelector('[name=location]').value,
					sentiment: Number(event.target.id[1])
				});
			}
		}

		this.querySelector('[name=lu]').classList.remove("successBox", "warningBox");
		this.querySelector('[name=location]').classList.remove("successBox", "warningBox");
		sentiments.setAttribute('aria-disabled', 'true');
	}
}

customElements.define('wms-place', WMSPlace);
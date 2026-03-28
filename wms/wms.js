// deno-lint-ignore-file no-window
class WMSPut extends HTMLElement {
	#codeInput
	#luInput
	#locationInput
	#sentiments

	constructor() {
		super();
		this.classList.add("wms", "wms-place");
	}

	connectedCallback() {
		this.innerHTML = `
			<label><span><i class="fa-solid fa-fw fa-box"></i> Unità di Carico (UdC)</span><br><input form name="lu" placeholder="es. 123456789" style="font-size: x-large" readonly></label>
			<label><span><i class="fa-solid fa-fw fa-warehouse"></i> Ubicazioni (UdD)</span><br><input form name="location" placeholder="es. A01 001 01" style="font-size: x-large" readonly></label>
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
		this.#luInput = this.querySelector('input[name=lu]');
		this.#locationInput = this.querySelector('input[name=location]');
		this.#sentiments = this.querySelector('#sentiments');

		// Register oncheck handler from attribute if present, else set default
		if (this.hasAttribute('oncheck')) {
			const fnName = this.getAttribute("oncheck").replace(/\(.*\)/, "").trim();
			if (typeof window[fnName] === 'function') {
				this.oncheck = window[fnName];
			} else {
				this.oncheck = () => { return { exists: false }; }
			}
		} else {
			this.oncheck = () => { return { exists: false }; }
		}
		this.#codeInput.addEventListener('change', async (event) => {
			this.#check(event, this.#codeInput, await this.oncheck(this.#codeInput.value));
		});
		this.#sentiments.addEventListener('click', (event) => this.#allocate(event));
		this.#codeInput.focus();
	}

	#check(_event, el, response) {
		const REGEX_LOCATION = /^[A-Za-z]\d{7}$/;
		const REGEX_LU = /^\d{1,9}$/;

		el.classList.remove('failureBox');
		if (REGEX_LOCATION.test(el.value) && response.exists) {
			this.#locationInput.value = el.value.toUpperCase().replace(/^([A-Za-z])(\d{2})(\d{3})(\d{2})$/, "$1$2 $3 $4");
			this.#locationInput.className = response.exists ? 'successBox' : 'warningBox';
			el.value = '';

		} else if (/^[0-5]$/.test(el.value)) {
			if (this.#locationInput.value && this.#luInput.value)
				this.querySelector(`#S${el.value}`).click();
			el.value = '';

		} else if (REGEX_LU.test(el.value)) {
			this.#luInput.value = el.value.padStart(9, '0');
			this.#luInput.className = response.exists ? 'successBox' : 'warningBox';
			el.value = '';

		} else {
			el.classList.add('failureBox');
		}

		if (this.hasAttribute("refmap"))
			document.querySelector(`#${this.getAttribute("refmap")}`).setAttribute("highlight", `lu=${this.#luInput.value}`);

		if (this.#locationInput.value && this.#luInput.value)
			this.#sentiments.setAttribute('aria-disabled', 'false');
		else
			this.#sentiments.setAttribute('aria-disabled', 'true');

		this.#codeInput.focus()
	}

	#allocate(event) {
		event.stopPropagation();
		event.preventDefault();

		if (this.#sentiments.getAttribute('aria-disabled') === 'true' || event.target.className !== 'sentiment')
			return;

		if (this.hasAttribute('onsubmit')) {
			const fnName = this.getAttribute('onsubmit').replace(/\(.*\)/, '').trim();
			if (typeof window[fnName] === 'function') {
				window[fnName].call(this, {
					lu: this.#luInput.value,
					location: this.#locationInput.value,
					sentiment: Number(event.target.id[1])
				});
			}
		}

		this.#luInput.classList.remove("successBox", "warningBox");
		this.#locationInput.classList.remove("successBox", "warningBox");
		this.#sentiments.setAttribute('aria-disabled', 'true');
	}
}

customElements.define('wms-put', WMSPut);

class WMSPick extends HTMLElement {
	#codeInput
	#quantityInput
	#sentiments

	constructor() {
		super();
		this.classList.add("wms", "wms-place");
	}

	connectedCallback() {
		this.innerHTML = `
			<label><span><i class="fa-solid fa-fw fa-box"></i> Codice</span><br><input form type="number" name="code" style="font-size: x-large" autofocus></label>
			<label><span><i class="fa-solid fa-comment-medical"></i> Quantità</span><br><input form type="number" step="any" name="quantity" style="font-size: x-large"></label>
			<div id="sentiments" aria-disabled="true" style="display: flex; column-gap: 0.4em;">
				<div id="S1" class="sentiment">1</div>
				<div id="S2" class="sentiment">2</div>
				<div id="S3" class="sentiment">3</div>
				<div id="S4" class="sentiment">4</div>
				<div id="S5" class="sentiment">5</div>
			</div>
			<span style="font-size:small">A sentimento, quanto pieno è l'UdD dopo il prelievo?</span>
		`;

		this.#codeInput = this.querySelector('input[name=code]');
		this.#quantityInput = this.querySelector('input[name=quantity]');
		this.#sentiments = this.querySelector('#sentiments');

		// Register oncheck handler from attribute if present, else set default
		if (this.hasAttribute('oncheck')) {
			const fnName = this.getAttribute("oncheck").replace(/\(.*\)/, "").trim();
			if (typeof window[fnName] === 'function') {
				this.oncheck = window[fnName];
			} else {
				this.oncheck = () => { return { exists: false }; }
			}
		} else {
			this.oncheck = () => { return { exists: false }; }
		}
		this.#codeInput.addEventListener('change', async (event) => {
			this.#check(event, this.#codeInput, await this.oncheck(this.#codeInput.value));
		});
		this.#sentiments.addEventListener('click', (event) => this.#allocate(event));
		this.#codeInput.focus();
	}

	#check(_event, el, response) {
		el.classList.remove('failureBox');
		if (/^[0-5]$/.test(el.value)) {
			if (this.#quantityInput.value && this.#codeInput.value)
				this.querySelector(`#S${el.value}`).click();
			el.value = '';

		} else if (response.exists && response.lu) {
			this.#codeInput.value = el.value.padStart(9, '0');
			this.#codeInput.className = response.exists ? 'successBox' : 'warningBox';
			this.#quantityInput.value = response.quantity;
			el.value = '';

		} else {
			el.classList.add('failureBox');
		}

		if (this.#quantityInput.value && this.#codeInput.value)
			this.#sentiments.setAttribute('aria-disabled', 'false');
		else
			this.#sentiments.setAttribute('aria-disabled', 'true');

		this.#codeInput.focus()
	}

	#allocate(event) {
		event.stopPropagation();
		event.preventDefault();

		if (this.#sentiments.getAttribute('aria-disabled') === 'true' || event.target.className !== 'sentiment')
			return;

		if (this.hasAttribute('onsubmit')) {
			const fnName = this.getAttribute('onsubmit').replace(/\(.*\)/, '').trim();
			if (typeof window[fnName] === 'function') {
				window[fnName].call(this, {
					lu: this.#codeInput.value,
					partnumber: this.#codeInput.value,
					quantity: this.#quantityInput.value,
					sentiment: Number(event.target.id[1])
				});
			}
		}

		this.#codeInput.classList.remove("successBox", "warningBox");
		this.#quantityInput.classList.remove("successBox", "warningBox");
		this.#sentiments.setAttribute('aria-disabled', 'true');
	}
}

customElements.define('wms-pick', WMSPick);

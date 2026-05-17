// deno-lint-ignore-file no-window
class WMSShared {
	static renderDescription(el, partnumber, description, batch, origin, quantity, um) {
		el.innerHTML = `<b>${partnumber || ''}</b><span style="font-size:smaller">${description || ''}</span><span style="font-size:smaller">${batch || ''} ${origin || ''}</span><span style="font-size:smaller">${[quantity, um].filter(Boolean).join(' ')}</span>`;
	}

	static normalizeLang(rawLang, fallback = "en") {
		const normalized = String(rawLang || "").trim().toLowerCase();
		if (!normalized) return fallback;
		if (normalized.startsWith("it")) return "it";
		if (normalized.startsWith("en")) return "en";
		if (normalized.startsWith("fr")) return "fr";
		return fallback;
	}

	static findNearestLangInDom(el) {
		let node = el?.parentNode || el?.getRootNode?.() || null;
		while (node && node !== document) {
			if (node.nodeType === 1 && typeof node.getAttribute === "function") {
				const lang = String(node.getAttribute("lang") || "").trim();
				if (lang) return lang;
			}
			node = node.parentNode || node.host || null;
		}
		return "";
	}

	static resolveLang(el) {
		if (el?.hasAttribute("lang")) {
			return WMSShared.normalizeLang(el.getAttribute("lang"), "en");
		}
		return WMSShared.normalizeLang(WMSShared.findNearestLangInDom(el), "en");
	}

	static t(translations, lang, key, params = null) {
		const value = translations[key];
		let text = "";
		if (value && typeof value === "object" && !Array.isArray(value)) {
			text = value[lang] || value.en || value.it || Object.values(value)[0] || key;
		} else if (typeof value === "string") {
			text = value;
		} else {
			text = key;
		}

		if (!params) return text;
		return text.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? ""));
	}
}

class WMSPut extends HTMLElement {
	#lang = "en"
	#translations = {
		put_lu_label: { it: "Unita di Carico (UdC)", en: "Loading Unit (LU)", fr: "Unite de Chargement (UL)" },
		put_location_label: { it: "Ubicazione (UdD)", en: "Location", fr: "Emplacement" },
		put_lu_placeholder: { it: "es. 123456789", en: "e.g. 123456789", fr: "ex. 123456789" },
		put_location_placeholder: { it: "es. A01 001 01", en: "e.g. A01 001 01", fr: "ex. A01 001 01" },
		put_code_placeholder: { it: "codice", en: "code", fr: "code" },
		put_sentiment_hint: {
			it: "A sentimento, quanto pieno e l'UdD?",
			en: "How full is the location?",
			fr: "Quel est le niveau de remplissage de l'emplacement ?"
		}
	}
	#description
	#codeInput
	#luInput
	#locationInput
	#sentiments

	constructor() {
		super();
		this.classList.add("wms", "wms-place");
	}

	#t(key, params = null) {
		return WMSShared.t(this.#translations, this.#lang, key, params);
	}

	async connectedCallback() {
		this.#lang = WMSShared.resolveLang(this);

		this.innerHTML = `
			<div class="description"></div>
			<label><span><i class="fa-solid fa-fw fa-barcode"></i> ${this.#t("put_lu_label")}</span><br><input form name="lu" placeholder="${this.#t("put_lu_placeholder")}" style="font-size: inherit" readonly></label>
			<label><span><i class="fa-solid fa-fw fa-warehouse"></i> ${this.#t("put_location_label")}</span><br><input form name="location" placeholder="${this.#t("put_location_placeholder")}" style="font-size: inherit" readonly></label>
			<input form name="code" placeholder="${this.#t("put_code_placeholder")}" style="font-size: inherit" virtualkeyboardpolicy="manual">
			<div id="sentiments" aria-disabled="true" style="display: flex; column-gap: 0.4em;">
				<div id="S1" class="sentiment">1</div>
				<div id="S2" class="sentiment">2</div>
				<div id="S3" class="sentiment">3</div>
				<div id="S4" class="sentiment">4</div>
				<div id="S5" class="sentiment">5</div>
			</div>
			<span style="font-size:small">${this.#t("put_sentiment_hint")}</span>
		`;

		this.#description = this.querySelector('.description');
		this.#codeInput = this.querySelector('input[name=code]');
		this.#luInput = this.querySelector('input[name=lu]');
		this.#locationInput = this.querySelector('input[name=location]');
		this.#sentiments = this.querySelector('#sentiments');

		// Show virtual keyboard on double-click
		this.#codeInput.addEventListener('dblclick', () => this.#codeInput.setAttribute('virtualkeyboardpolicy', 'auto'));

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

		const params = new URLSearchParams(window.location.search);
		if (params.has('location')) {
			this.#codeInput.value = params.get('location');
			this.#check(null, this.#codeInput, await this.oncheck(this.#codeInput.value));
		}
		if (params.has('lu')) {
			this.#codeInput.value = params.get('lu');
			this.#check(null, this.#codeInput, await this.oncheck(this.#codeInput.value));
		}
		if (this.#locationInput.value && this.#luInput.value)
			this.#sentiments.setAttribute('aria-disabled', 'false');

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
			this.#luInput.value = el.value.replace(/^0+/, '').padStart(9, '0');
			this.#luInput.className = response.exists ? 'successBox' : 'warningBox';
			el.value = '';

		} else {
			el.classList.add('failureBox');
		}

		if (!this.#luInput.value)
			this.#description.innerHTML = "";
		if (response.partnumber) {
			WMSShared.renderDescription(this.#description, response.partnumber, response.description, null, null, response.quantity, response.um);
			this.#locationInput.className = response.exists ? 'successBox' : 'warningBox';
			this.#locationInput.value = response.location || '';
		} else {
			this.#description.innerHTML = '';
		}

		console.log(response);
		if (this.hasAttribute("refmap") && response.exists)
			document.querySelector(`#${this.getAttribute("refmap")}`)?.setAttribute("highlight", `lu=${response.lu || ""}&partnumber=${response.partnumber || ""}`);

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
					lu: this.#luInput.value.replace(/^0+/, ''),
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
	#lang = "en"
	#translations = {
		pick_lu_label: { it: "Unita di Carico (UdC)", en: "Loading Unit (LU)", fr: "Unite de Chargement (UL)" },
		pick_lu_placeholder: { it: "es. 123456789", en: "e.g. 123456789", fr: "ex. 123456789" },
		pick_qty_label: { it: "Quantita prelevata", en: "Picked quantity", fr: "Quantite prelevee" },
		pick_left_label: { it: "Quantita residua", en: "Left quantity", fr: "Quantite restante" },
		pick_left_placeholder: { it: "residuo reale", en: "actual left", fr: "reste reel" },
		pick_sentiment_hint: {
			it: "A sentimento, quanto pieno e l'UdD dopo il prelievo?",
			en: "How full is the location after picking?",
			fr: "Quel est le niveau de remplissage apres le prelevement ?"
		}
	}
	#codeInput
	#quantityInput
	#leftInput
	#sentiments
	#description
	#lastResponse = null

	constructor() {
		super();
		this.classList.add("wms", "wms-place");
	}

	#t(key, params = null) {
		return WMSShared.t(this.#translations, this.#lang, key, params);
	}

	async connectedCallback() {
		this.#lang = WMSShared.resolveLang(this);

		this.innerHTML = `
				<div class="description"></div>
				<label><span><i class="fa-solid fa-fw fa-barcode"></i> ${this.#t("pick_lu_label")}</span><br><input form type="number" name="code" style="font-size: inherit" placeholder="${this.#t("pick_lu_placeholder")}" autofocus></label>
				<label><span>${this.#t("pick_qty_label")}</span><br><input form type="number" step="any" name="quantity" style="font-size: inherit"></label>
				<label><span>${this.#t("pick_left_label")}</span><br><input form type="number" step="any" name="leftQuantity" style="font-size: inherit" placeholder="${this.#t("pick_left_placeholder")}"></label>
				<div id="sentiments" aria-disabled="true" style="display: flex; column-gap: 0.4em;">
					<div id="S1" class="sentiment">1</div>
					<div id="S2" class="sentiment">2</div>
					<div id="S3" class="sentiment">3</div>
					<div id="S4" class="sentiment">4</div>
					<div id="S5" class="sentiment">5</div>
				</div>
				<span style="font-size:small">${this.#t("pick_sentiment_hint")}</span>
			`;

		this.#description = this.querySelector('.description');
		this.#codeInput = this.querySelector('input[name=code]');
		this.#quantityInput = this.querySelector('input[name=quantity]');
		this.#leftInput = this.querySelector('input[name=leftQuantity]');
		this.#sentiments = this.querySelector('#sentiments');

		// Show virtual keyboard on double-click
		this.#codeInput.addEventListener('dblclick', () => {
			if (this.#codeInput.showPicker) {
				this.#codeInput.showPicker();
			} else {
				this.#codeInput.focus();
			}
		});

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
		this.#quantityInput.addEventListener('input', () => this.#suggestLeftQuantity());
		this.#leftInput.addEventListener('input', () => this.#leftInput.dataset.auto = '0');
		this.#codeInput.addEventListener('focus', () => this.#codeInput.select());
		this.#sentiments.addEventListener('click', (event) => this.#allocate(event));
		this.#codeInput.focus();
	}

	#check(_event, el, response) {
		el.classList.remove('failureBox');
		if (/^[0-5]$/.test(el.value)) {
			if (this.#quantityInput.value && this.#codeInput.value)
				this.querySelector(`#S${el.value}`).click();
			this.#codeInput.focus()

		} else if (response.exists && response.lu) {
			this.#codeInput.value = el.value.padStart(9, '0');
			this.#codeInput.className = response.exists ? 'successBox' : 'warningBox';
			this.#quantityInput.value = "";
			this.#quantityInput.setAttribute("placeholder", response.quantity);
			this.#quantityInput.focus();

		} else {
			el.classList.add('failureBox');
			this.#quantityInput.value = "";
			this.#quantityInput.removeAttribute("placeholder");
			this.#codeInput.select();
			if (/^\d{1,9}$/.test(el.value) && !response.exists) {
				this.#description.innerHTML = '';
			}
		}

		console.log(response);
		if (response.partnumber) {
			this.#lastResponse = response;
			this.#leftInput?.setAttribute('placeholder', response.quantity || this.#t("pick_left_placeholder"));
			if (this.#leftInput) {
				this.#leftInput.value = '';
				this.#leftInput.dataset.auto = '1';
			}
		}
		if (this.hasAttribute("refmap") && response.exists)
			document.querySelector(`#${this.getAttribute("refmap")}`)?.setAttribute("highlight", `lu=${response.lu || ""}&partnumber=${response.partnumber || ""}`);

		if (response.partnumber)
			WMSShared.renderDescription(this.#description, response.partnumber, response.description, '', '', response.quantity, response.um);
		else
			this.#description.innerHTML = '';

		if (this.#quantityInput.value && this.#codeInput.value)
			this.#sentiments.setAttribute('aria-disabled', 'false');
		else
			this.#sentiments.setAttribute('aria-disabled', 'true');

		this.dispatchEvent(new CustomEvent('wms-pick-check', {
			detail: {
				code: this.#codeInput.value,
				lu: this.#codeInput.value.replace(/^0+/, ''),
				response
			},
			bubbles: true
		}));
	}
	
	#allocate(event) {
		event.stopPropagation();
		event.preventDefault();

		if (this.#sentiments.getAttribute('aria-disabled') === 'true' || event.target.className !== 'sentiment')
			return;

		if (this.hasAttribute('onsubmit')) {
			const fnName = this.getAttribute('onsubmit').replace(/\(.*\)/, '').trim();
			if (typeof window[fnName] === 'function') {
				window[fnName].call(this, this.#buildPayload(Number(event.target.id[1])));
			}
		}

		const payload = this.#buildPayload(Number(event.target.id[1]));
		this.dispatchEvent(new CustomEvent('wms-pick-submit', {
			detail: payload,
			bubbles: true
		}));

		this.#codeInput.classList.remove("successBox", "warningBox");
		this.#quantityInput.classList.remove("successBox", "warningBox");
		this.#sentiments.setAttribute('aria-disabled', 'true');
	}

	#buildPayload(sentiment) {
		const totalQty = parseInt(this.#lastResponse?.quantity ?? '', 10);
		const pickedQty = parseInt(this.#quantityInput.value, 10);
		const fallbackLeft = Number.isFinite(totalQty) && Number.isFinite(pickedQty)
			? Math.max(0, totalQty - pickedQty)
			: '';
		const leftQty = this.#leftInput?.value !== '' ? this.#leftInput.value : fallbackLeft;

		return {
			lu: this.#codeInput.value.replace(/^0+/, ''),
			partnumber: this.#lastResponse?.partnumber || this.#codeInput.value,
			quantity: this.#quantityInput.value,
			leftQty,
			sentiment,
			response: this.#lastResponse
		};
	}

	#suggestLeftQuantity() {
		if (!this.#leftInput || !this.#lastResponse) return;
		if (this.#leftInput.dataset.auto !== '1') return;
		if (this.#quantityInput.value === '') return;

		const totalQty = parseInt(this.#lastResponse.quantity, 10);
		const pickedQty = parseInt(this.#quantityInput.value, 10);
		if (Number.isFinite(totalQty) && Number.isFinite(pickedQty)) {
			this.#leftInput.value = Math.max(0, totalQty - pickedQty);
		}
	}
}

customElements.define('wms-pick', WMSPick);

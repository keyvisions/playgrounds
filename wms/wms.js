// deno-lint-ignore-file no-window
class WMSShared {
	static renderDescription(el, partnumber, description, batch, origin, quantity, um) {
		el.innerHTML = `<b>${partnumber || ''}</b><span style="font-size:smaller">${description || ''}</span><span style="font-size:smaller">${batch || ''} ${origin || ''}</span><span style="font-size:smaller"><input type="number" name="quantity" value="${quantity}" style="border:0;padding:0;font-size:medium">${um}</span>`;
	}

	static normalizeLang(rawLang, fallback = "en") {
		const normalized = String(rawLang || "").trim().toLowerCase();
		if (!normalized) return fallback;
		if (normalized.startsWith("it")) return "it";
		if (normalized.startsWith("en")) return "en";
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
		put_lu_label: { it: "Unità di Carico (UdC)", en: "Loading Unit (LU)" },
		put_location_label: { it: "Ubicazione (UdD)", en: "Location" },
		put_lu_placeholder: { it: "es. 123456789", en: "e.g. 123456789" },
		put_location_placeholder: { it: "es. A01 001 01", en: "e.g. A01 001 01" },
		put_code_placeholder: { it: "codice", en: "code" },
		put_sentiment_hint: { it: "Quanto piena e l'UdD?", en: "How full is the location?" }
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
			<input form name="code" placeholder="${this.#t("put_code_placeholder")}" style="font-size: inherit" virtualkeyboardpolicy="manual" autofocus>
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
		if (el.name === 'code' && REGEX_LOCATION.test(el.value) && response.exists) {
			this.#locationInput.value = el.value.toUpperCase().replace(/^([A-Za-z])(\d{2})(\d{3})(\d{2})$/, "$1$2 $3 $4");
			   if (!this.#locationInput.value) {
				   this.#locationInput.className = '';
			   } else if (response.exists) {
				   this.#locationInput.className = 'successBox';
			   }
			el.value = '';

		} else if (el.name !== 'code' && /^[0-5]$/.test(el.value) && this.#locationInput.value && this.#luInput.value) {
			this.querySelector(`#S${el.value}`).click();
			el.value = '';

		} else if (el.name === 'code' && REGEX_LU.test(el.value)) {
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
			   if (!response.location) {
				   this.#locationInput.className = '';
			   } else if (response.exists) {
				   this.#locationInput.className = 'successBox';
			   }
			this.#locationInput.value = response.location?.replace(/^([A-Za-z])(\d{2})(\d{3})(\d{2})$/, "$1$2 $3 $4") || '';
		} else {
			this.#description.innerHTML = '';
		}

		// console.log(response);
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

		const sentimentEl = event.target?.closest?.('.sentiment');

		if (this.#sentiments.getAttribute('aria-disabled') === 'true' || !event.isTrusted || !sentimentEl)
			return;

		if (this.hasAttribute('onsubmit')) {
			const fnName = this.getAttribute('onsubmit').replace(/\(.*\)/, '').trim();
			if (typeof window[fnName] === 'function') {
				window[fnName].call(this, {
					lu: this.#luInput.value.replace(/^0+/, ''),
					location: this.#locationInput.value.replaceAll(' ', ''),
					sentiment: Number(sentimentEl.id[1]),
					quantity: Number(this.querySelector('[name=quantity]')?.value)
				});
			}
		}

		this.#luInput.classList.remove("successBox", "warningBox");
		this.#locationInput.classList.remove("successBox", "warningBox");
		this.#sentiments.setAttribute('aria-disabled', 'true');
		this.#codeInput.focus();
	}
}

customElements.define('wms-put', WMSPut);

class WMSPick extends HTMLElement {
	#lang = "en"
	#translations = {
		pick_lu_label: { it: "Unità di Carico (UdC)", en: "Loading Unit (LU)" },
		pick_lu_placeholder: { it: "es. 123456789", en: "e.g. 123456789" },
		pick_qty_label: { it: "Quantità prelevata", en: "Picked quantity" },
		pick_left_label: { it: "Quantità residua", en: "Left quantity" },
		pick_left_placeholder: { it: "residuo reale", en: "actual left" },
		pick_sentiment_hint: { it: "Quanto piena è l'UdD dopo il prelievo?", en: "How full is the location after picking?" }
	}
	#codeInput
	#quantityInput
	#leftInput
	#sentiments
	#description
	#lastResponse = null
	#validLu = false

	constructor() {
		super();
		this.classList.add("wms", "wms-place");
	}

	static get observedAttributes() {
		return ['partnumber', 'quantity'];
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;
		if (!this.isConnected) return;

		if (name === 'quantity') {
			const quantity = String(newValue || '');
			if (this.#quantityInput && this.#quantityInput.value !== quantity)
				this.#quantityInput.value = quantity;
			this.#suggestLeftQuantity();
			this.#updateSentimentsState();
			return;
		}

		if (name === 'partnumber') {
			this.#validLu = false;
			this.#lastResponse = null;
			if (this.#quantityInput) {
				this.#quantityInput.value = '';
				this.#quantityInput.removeAttribute('placeholder');
			}
			if (this.#leftInput) {
				this.#leftInput.value = '';
				this.#leftInput.dataset.auto = '0';
			}
			this.#syncQuantityAttribute();
			this.#renderPickDescription();
			this.#updateSentimentsState();
		}
	}

	#t(key, params = null) {
		return WMSShared.t(this.#translations, this.#lang, key, params);
	}

	connectedCallback() {
		this.#lang = WMSShared.resolveLang(this);

		this.innerHTML = `
				<div class="description"></div>
				<label><span><i class="fa-solid fa-fw fa-barcode"></i> ${this.#t("pick_lu_label")}</span><br><input form type="number" name="code" style="font-size: inherit" placeholder="${this.#t("pick_lu_placeholder")}" autofocus></label>
				<label><span>${this.#t("pick_qty_label")}</span><br><input form type="number" step="any" name="quantity" style="font-size: inherit"></label>
				<label><span><small>${this.#t("pick_left_label")}</small></span><br><input form type="number" step="any" name="leftQuantity" placeholder="${this.#t("pick_left_placeholder")}"></label>
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
		this.#quantityInput.addEventListener('input', () => {
			this.#syncQuantityAttribute();
			this.#suggestLeftQuantity();
			this.#updateSentimentsState();
		});
		this.#leftInput.addEventListener('input', () => this.#leftInput.dataset.auto = '0');
		this.#codeInput.addEventListener('focus', () => this.#codeInput.select());
		this.#sentiments.addEventListener('click', (event) => this.#allocate(event));
		if (this.hasAttribute('quantity'))
			this.#quantityInput.value = this.getAttribute('quantity') || '';
		this.#syncQuantityAttribute();
		this.#renderPickDescription();
		this.#codeInput.focus();
	}

	#syncQuantityAttribute() {
		const quantity = this.#quantityInput?.value || '';
		if (!quantity) {
			if (this.hasAttribute('quantity'))
				this.removeAttribute('quantity');
			return;
		}

		if (this.getAttribute('quantity') !== quantity)
			this.setAttribute('quantity', quantity);
	}

	#normalizePartnumber(value) {
		return String(value || '').trim().toUpperCase();
	}

	#getTargetPartnumber() {
		return this.#normalizePartnumber(this.getAttribute('partnumber'));
	}

	#renderPickDescription() {
		if (!this.#description) return;
		if (this.#lastResponse?.partnumber) {
			WMSShared.renderDescription(this.#description, this.#lastResponse.partnumber, this.#lastResponse.description, '', '', this.#lastResponse.quantity, this.#lastResponse.um || "");
			return;
		}

		this.#description.innerHTML = '';
	}

	#check(_event, el, response) {
		const targetPartnumber = this.#getTargetPartnumber();
		const responsePartnumber = this.#normalizePartnumber(response?.partnumber);
		const partnumberMatches = !targetPartnumber || responsePartnumber === targetPartnumber;
		const isAcceptedLU = response.exists && response.lu && partnumberMatches;

		el.classList.remove('failureBox');
		if (/^[0-5]$/.test(el.value)) {
			if (this.#quantityInput.value && this.#codeInput.value)
				this.querySelector(`#S${el.value}`).click(_event);
			this.#codeInput.focus()

		} else if (isAcceptedLU) {
			this.#validLu = true;
			this.#codeInput.value = el.value.padStart(9, '0');
			this.#codeInput.className = response.exists ? 'successBox' : 'warningBox';
			this.#quantityInput.value = "";
			this.#syncQuantityAttribute();
			this.#quantityInput.setAttribute("placeholder", response.quantity);
			this.#quantityInput.focus();
			this.#lastResponse = response;
			this.#leftInput?.setAttribute('placeholder', response.quantity || this.#t("pick_left_placeholder"));
			if (this.#leftInput) {
				this.#leftInput.value = '';
				this.#leftInput.dataset.auto = '1';
			}

		} else {
			this.#validLu = false;
			this.#lastResponse = null;
			el.classList.add('failureBox');
			this.#quantityInput.value = "";
			this.#syncQuantityAttribute();
			this.#quantityInput.removeAttribute("placeholder");
			this.#codeInput.select();
			if (/^\d{1,9}$/.test(el.value) && !response.exists) {
				this.#description.innerHTML = '';
			}
		}

		// console.log(response);
		if (this.hasAttribute("refmap") && response.exists)
			document.querySelector(`#${this.getAttribute("refmap")}`)?.setAttribute("highlight", `lu=${response.lu || ""}&partnumber=${response.partnumber || ""}`);

		this.#renderPickDescription();

		this.#updateSentimentsState();

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

		if (this.#sentiments.getAttribute('aria-disabled') === 'true' || !event.isTrusted)
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

	#updateSentimentsState() {
		if (this.#validLu && this.#quantityInput.value !== '')
			this.#sentiments.setAttribute('aria-disabled', 'false');
		else
			this.#sentiments.setAttribute('aria-disabled', 'true');
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

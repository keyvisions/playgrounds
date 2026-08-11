class KvJsonForm extends HTMLElement {
	dataset = {};
	#jsonField = null;
	#handlers = new Map();
	#onchange = (event) => this.#stringifyDataset(event);

	static get observedAttributes() {
		return ['formid', 'for', 'content-type', 'value']; // content-type: application/json | application/xml
	}

	attributeChangedCallback(name, _oldValue, newValue) {
		if (name === 'value') {
			this.#jsonField.value = newValue;
			this.#IO();
			this.#parseDataset(this.dataset);
		}
	}

	constructor() {
		super();
	}

	connectedCallback() {
		this.#jsonField = document.getElementById(this.getAttribute("for"));

		this.#jsonField?.addEventListener('change', () => {
			this.#IO();
			this.#parseDataset(this.dataset);
		});

		const observer = new MutationObserver(mutations => {
			mutations.forEach(mutation => {
				if (mutation.type === "attributes" && mutation.attributeName === "value") {
					mutation.target.value = mutation.target.getAttribute('value');
					this.#stringifyDataset(mutation);
				} else {
					const node = mutation.target.nodeType === Node.TEXT_NODE
						? mutation.target.parentElement
						: mutation.target;
					this.#stringifyDataset({ target: node.closest("[contenteditable]") });
				}
			});
		});
		observer.observe(this.#jsonField, { attributes: true, attributeFilter: ['value'] });

		this.#IO();
		this.#parseDataset(this.dataset);

		const form = document.createElement('form');
		form.setAttribute('id', this.getAttribute('formid') || 'kv-jsonform');
		this.replaceChildren(form);
		[...form.elements].forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['value'] }));

		document.querySelectorAll(`[form="${this.getAttribute('formid')}"][contenteditable]`).forEach(el =>
			observer.observe(el, { childList: true, subtree: true, characterData: true })
		);
	}

	#IO(action = 'r') {
		if (action === 'r')
			try {
				if (this.getAttribute('content-type') === 'application/xml') {
					const xml = document.createElement('div');
					xml.innerHTML = this.#jsonField?.getAttribute('value') || this.#jsonField?.value || '<dataset></dataset>';
					Array.from(xml.firstElementChild?.children || []).forEach(node => {
						this.dataset[node.localName] = node.textContent;
					});
				} else {
					this.dataset = JSON.parse(this.#jsonField?.getAttribute('value') || this.#jsonField?.value || "{}");
				}
			} catch {
				this.dataset = {};
			}
		else {
			if (this.getAttribute('content-type') === 'application/xml') {
				const xml = document.createElement('dataset');
				Object.keys(this.dataset).forEach(key =>
					xml.insertAdjacentHTML('beforeend', `<${key}>${this.dataset[key] || ''}</${key}>`)
				);
				this.#jsonField.value = xml.outerHTML;
			} else {
				this.#jsonField.value = JSON.stringify(this.dataset);
			}
		}
	}

	#parseDataset(dataset) {
		const formName = this.getAttribute('formid') || 'kv-jsonform';
		document.querySelectorAll(`[form="${formName}"]`).forEach(element => {
			if (!this.#handlers.has(element)) {
				element.addEventListener('change', this.#onchange);
				this.#handlers.set(element, this.#onchange);
			}

			const name = element.getAttribute('name');

			// KeyVisions eSite patch
			const skip = (name[0] == '_' && element.type == 'checkbox') || (name[0] == '*' && element.tagName == 'SELECT');

			if (!skip)
				switch (element.tagName) {
					case 'INPUT':
						switch (element.type) {
							case 'checkbox':
								if (typeof dataset[name] === 'string') {
									const checks = dataset[name]?.split(',') || [];
									document.querySelectorAll(`input[form="${formName}"][type="checkbox"][name="${name}"]`).forEach(check =>
										check.checked = (checks.indexOf(check.value) !== -1)
									);
								} else {
									document.querySelectorAll(`input[form="${formName}"][type="checkbox"][name="${name}"]`).forEach((check, i) =>
										check.checked = (dataset[name] || 0) & 1 << i ? true : false
									);
								}
								break;
							case 'radio': {
								const radio = document.querySelector(`input[form="${formName}"][type="radio"][name="${name}"][value="${dataset[name] || ''}"]`);
								if (radio) radio.checked = true;
								break;
							}
							case 'color':
								element.value = dataset[name] || '#000000';
								break;
							default:
								if (dataset[name])
									element.value = dataset[name];
								else
									dataset[name] = element.value;
						}
						break;
					case 'SELECT': {
						const options = dataset[name]?.split(',') || [];
						element.querySelectorAll('option').forEach(option =>
							option.selected = options.indexOf(option.value) === -1 ? false : true
						);
						break;
					}
					case 'DIV':
						if (dataset[name])
							element.innerHTML = dataset[name];
						else
							dataset[name] = element.innerHTML;
						break;
					default:
						if (dataset[name])
							element.value = dataset[name];
						else
							dataset[name] = element.value;
				}
		});

		// Call external onchange if defined (property or attribute)
		if (typeof this.onchange === 'function') {
			this.onchange({
				type: 'change',
				target: this,
				detail: { dataset: this.dataset }
			});
		} else if (this.hasAttribute('onchange')) {
			// Support inline attribute handler (e.g., onchange="handler(event)")
			const handler = new Function('event', this.getAttribute('onchange'));
			handler.call(this, {
				type: 'change',
				target: this,
				detail: { dataset: this.dataset }
			});
		}
	}

	#stringifyDataset(event) {
		const formName = this.getAttribute('formid') || 'kv-jsonform';
		const element = event.target;
		let name = element.getAttribute('name');

		let value;
		switch (element.tagName) {
			case 'INPUT':
				switch (element.getAttribute("type")) {
					case 'checkbox':
					case 'radio':
						value = [];
						document.querySelectorAll(`[form="${formName}"][name="${name}"]`).forEach((box, i) => {
							if (box.checked && box.hasAttribute('value'))
								value.push(box.value);
							else if (box.checked)
								value[0] = (value[0] || 0) | 1 << i;
						});
						if (value.length === 1 && typeof value[0] === 'number')
							value = value[0];
						else
							value = value.join(',');
						break;
					case 'number':
						value = parseFloat(element.value);
						break;
					default:
						value = element.value;
				}
				break;
			case 'SELECT':
				element.options
				value = [];
				element.querySelectorAll('option').forEach(option => {
					if (option.selected) value.push(option.value);
				});
				value = value.join(',');
				break;
			case 'DIV':
				value = element.innerHTML;
				break;
			default:
				value = element.value;
		}

		if (name[0] === '*' || name[0] === '_') { // KeyVisions eSite patch
			name = name.replace(/^[_*]/, '');
			this.dataset[name] = element.form.elements[name]?.value || null;
		} else
			this.dataset[name] = value || null;

		if (this.hasAttribute('onchange'))
			this.onchange({
				type: 'change',
				target: this,
				detail: { dataset: this.dataset }
			});

		this.#IO('w');
	}

	disconnectedCallback() {
		this.#handlers.forEach((handler, element) => element.removeEventListener('change', handler));
		this.#jsonField?.removeEventListener('change', this.#parseDataset);
	}
}

if (!customElements.get('kv-jsonform')) {
	customElements.define('kv-jsonform', KvJsonForm);
}



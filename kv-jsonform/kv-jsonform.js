class KvJsonForm extends HTMLElement {
	dataset = {};
	#jsonField = null;
	#handlers = new Map();
	#onchange = (event) => this.#stringifyDataset(event);

	static get observedAttributes() {
		return ['name', 'for', 'content-type']; // content-type: application/json | application/xml
	}

	constructor() {
		super();
	}

	connectedCallback() {
		this.#jsonField = document.getElementById(this.getAttribute("for"));

		this.#jsonField?.addEventListener('change', () => {
			this.#IO();
			this.#parseDataset(this.dataset)
		});

		this.#IO();
		this.#parseDataset(this.dataset);
	}

	#IO(action = 'r') {
		if (action === 'r')
			try {
				if (this.getAttribute('content-type') === 'application/xml') {
					const xml = document.createElement('div');
					xml.innerHTML = this.#jsonField?.value || '<dataset></dataset>';
					Array.from(xml.firstElementChild?.children || []).forEach(node => {
						this.dataset[node.localName] = node.textContent;
					});
				} else {
					this.dataset = JSON.parse(this.#jsonField?.value || "{}");
				}
			} catch {
				this.dataset = {};
			}
		else {
			if (this.getAttribute('content-type') === 'application/xml') {
				const xml = document.createElement('root');
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
		document.querySelectorAll(`[form="${this.getAttribute("name")}"]`).forEach(element => {
			if (!this.#handlers.has(element)) {
				element.addEventListener('change', this.#onchange);
				this.#handlers.set(element, this.#onchange);
			}

			const name = element.name.replace('*', '');
			switch (element.tagName) {
				case 'INPUT':
					switch (element.type) {
						case 'checkbox':
							if (typeof dataset[name] === 'string') {
								const checks = dataset[name]?.split(',') || [];
								document.querySelectorAll(`input[form="${this.getAttribute("name")}"][type="checkbox"][name="${name}"]`).forEach(check =>
									check.checked = (checks.indexOf(check.value) !== -1)
								);
							} else {
								document.querySelectorAll(`input[form="${this.getAttribute("name")}"][type="checkbox"][name="${name}"]`).forEach((check, i) =>
									check.checked = (dataset[name] ?? 0) & 1 << i ? true : false
								);
							}
							break;
						case 'radio': {
							const radio = document.querySelector(`input[form="${this.getAttribute("name")}"][type="radio"][name="${name}"][value="${dataset[name] ?? ''}"]`);
							if (radio) radio.checked = true;
							break;
						}
						case 'color':
							element.value = dataset[name] ?? '#000000';
							break;
						default:
							element.value = dataset[name] ?? element.value;
					}
					break;
				case 'SELECT': {
					const options = dataset[name]?.split(',') || [];
					element.querySelectorAll('option').forEach(option =>
						option.selected = options.indexOf(option.value) === -1 ? false : true
					);
					break;
				}
				default:
					element.value = dataset[name] ?? element.value;
			}
		});
	}

	#stringifyDataset(event) {
		const element = event.target;
		const name = element.name.replace('*', '');

		let value;
		switch (element.tagName) {
			case 'INPUT':
				switch (element.getAttribute("type")) {
					case 'checkbox':
					case 'radio':
						value = [];
						document.querySelectorAll(`[form="${this.getAttribute("name")}"][name="${name}"]`).forEach((box, i) => {
							if (box.checked && box.hasAttribute('value'))
								value.push(box.value);
							else if (box.checked)
								value[0] = (value[0] ?? 0) | 1 << i;
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
			default:
				value = element.value;
		}
		this.dataset[name] = value || null;

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



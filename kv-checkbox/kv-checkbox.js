class TriStateCheckbox extends HTMLElement {
	static formAssociated = true;
	static get observedAttributes() { return ["checked", "disabled"]; }

	constructor() {
		super();
		this._internals = this.attachInternals();
		const shadow = this.attachShadow({ mode: "open" });

		shadow.innerHTML = `
            <style>
                :host {
                    display: inline-flex;
                    align-items: center;
                    cursor: pointer;
                    user-select: none;
                }
                :host([disabled]) {
                    opacity: 0.5;
                    cursor: default;
                    pointer-events: none;
                }
                label {
                    display: inline-flex;
                    align-items: center;
                    cursor: inherit;
                }
                input[type="checkbox"]:indeterminate {
                    background: #ddd;
                    border-color: #666;
                }
            </style>
            <label part="wrapper"><input part="input" type="checkbox"><slot part="label"></slot></label>
        `;

		this.input = shadow.querySelector("input");
		this.wrapper = shadow.querySelector("label");

		this.wrapper.addEventListener("click", () => {
			if (!this.disabled) this.nextState();
		});
	}

	connectedCallback() {
		if (!this.hasAttribute("checked")) this.checked = 0;
		this._syncDisabled();
		this._render();
		this._updateFormValue();
	}

	attributeChangedCallback(name) {
		if (name === "disabled") this._syncDisabled();
		if (name === "checked") this._normalizeChecked();
		this._render();
		this._updateFormValue();
	}

	get checked() { return Number(this.getAttribute("checked")); }
	set checked(v) { this.setAttribute("checked", v); }

	get disabled() { return this.hasAttribute("disabled"); }
	set disabled(v) {
		if (v) this.setAttribute("disabled", "");
		else this.removeAttribute("disabled");
	}

	_syncDisabled() {
		this._internals.states.disabled = this.disabled;
		this.input.disabled = this.disabled;
	}

	get value() {
		return this.checked === 1 ? "true" :
			this.checked === 0 ? "false" :
				"null";
	}

	set value(v) {
		if (v === true || v === "true") this.checked = 1;
		else if (v === false || v === "false") this.checked = 0;
		else this.checked = -1;
	}

	_normalizeChecked() {
		const c = Number(this.getAttribute("checked"));
		if (c !== 0 && c !== 1 && c !== -1) {
			this.checked = -1;
		}
	}

	nextState() {
		this.checked =
			this.checked === 0 ? 1 :
				this.checked === 1 ? -1 :
					0;

		this.dispatchEvent(new Event("change", { bubbles: true }));
	}

	_render() {
		const c = this.checked;

		if (c === -1) {
			this.input.indeterminate = true;
			this.input.checked = false;
			this.input.setAttribute("aria-checked", "mixed");
		} else {
			this.input.indeterminate = false;
			this.input.checked = (c === 1);
			this.input.setAttribute("aria-checked", c === 1 ? "true" : "false");
		}
	}
	_updateFormValue() {
		this._internals.setFormValue(this.value);
	}
	formResetCallback() {
		this.checked = 0;
	}
	formDisabledCallback(disabled) {
		this.disabled = disabled;
	}
}

customElements.define("kv-checkbox", TriStateCheckbox);

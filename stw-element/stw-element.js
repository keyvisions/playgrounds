class StwElement extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.type = this.getAttribute('type') || 'content';
		this.dialogOpen = false;
		this.render();
	}

	static get observedAttributes() {
		return ['type'];
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'type') {
			this.type = newValue;
			this.render();
		}
	}

	render() {
		this.shadowRoot.innerHTML = `
			<style>
				.icon {
					cursor: pointer;
					font-size: 2em;
				}
				dialog {
					border: 1px solid #ccc;
					border-radius: 8px;
					padding: 1em;
				}
				/* Font Awesome styles are loaded globally */
			</style>
			<span class="icon">${this.getIcon(this.type)}</span>
			<dialog id="editDialog">
				<form method="dialog">
					<label>Type: <input name="type" value="${this.type}" /></label><br>
					<button id="saveBtn">Save</button>
					<button id="closeBtn">Close</button>
				</form>
			</dialog>
		`;
		this.shadowRoot.querySelector('.icon').onclick = () => this.openDialog();
		this.shadowRoot.querySelector('#closeBtn').onclick = (e) => {
			e.preventDefault();
			this.closeDialog();
		};
		this.shadowRoot.querySelector('#saveBtn').onclick = (e) => {
			e.preventDefault();
			const typeValue = this.shadowRoot.querySelector('input[name="type"]').value;
			this.setAttribute('type', typeValue);
			this.closeDialog();
		};
	}

	getIcon(type) {
		// Font Awesome icon mapping for all supported types
		const icons = {
			site: 'fa-solid fa-globe',
			area: 'fa-solid fa-map',
			page: 'fa-solid fa-file',
			content: 'fa-solid fa-file-lines',
			shortcut: 'fa-solid fa-link',
			user: 'fa-solid fa-user',
			settings: 'fa-solid fa-gear',
			default: 'fa-solid fa-star'
		};
		const iconClass = icons[type] || icons['default'];
		return `<i class="${iconClass}"></i>`;
	}

	openDialog() {
		this.shadowRoot.querySelector('#editDialog').showModal();
		this.dialogOpen = true;
	}

	closeDialog() {
		this.shadowRoot.querySelector('#editDialog').close();
		this.dialogOpen = false;
	}
}

customElements.define('stw-element', StwElement);

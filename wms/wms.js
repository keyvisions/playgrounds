class WmsManage extends HTMLElement {
	#codeInput

	constructor() {
		super();
	}
	connectedCallback() {
		this.classList.add("wms");
		this.innerHTML = `
			<label><span><i class="fa-solid fa-fw fa-barcode"></i> UDC</span>: <input name="lu" placeholder="es. 123456789" readonly></label>
			<label><span><i class="fa-solid fa-warehouse"></i> UDD</span>: <input name="location" placeholder="es. A01 001 01" readonly></label>
			<input name="code">
			<div id="sentiments" aria-disabled="true" style="display: flex; justify-content: space-evenly; font-size: larger;">
				<!--div id="S0" class="sentiment">&bull;</div-->
				<div id="S1" class="sentiment">1</div>
				<div id="S2" class="sentiment">2</div>
				<div id="S3" class="sentiment">3</div>
				<div id="S4" class="sentiment">4</div>
				<div id="S5" class="sentiment">5</div>
				<!--div id="S6" class="sentiment"><i class="fa-solid fa-trash"></i></div-->
			</div>
			<hr>
			<table id="inventory" style="font-size:smaller"></table>
		`;

		this.#codeInput = this.querySelector('input[name=code]');
		this.#codeInput.addEventListener('change', (event) => this.check(event, this.#codeInput));
		const sentiments = this.querySelector('#sentiments');
		sentiments.addEventListener('click', (event) => this.allocate(event));
		this.#codeInput.focus();
	}
	check(event, el) {
		event.stopPropagation();
		event.preventDefault();

		const REGEX_LOCATION = /^[A-Za-z]\d{7}$/;
		const REGEX_LU = /^\d{1,9}$/;
		const Location = this.querySelector('[name=location]');
		const LU = this.querySelector('[name=lu]');
		const sentiments = this.querySelector('#sentiments');

		el.classList.remove('warningBox');
		if (REGEX_LOCATION.test(el.value)) {
			Location.classList.add("successBox");
			Location.value = el.value.toUpperCase();
			el.value = '';
		} else if (/^[0-5]$/.test(el.value)) {
			this.querySelector(`#S${el.value}`).click();
			el.value = '';
		} else if (REGEX_LU.test(el.value)) {
			LU.classList.add("successBox");
			LU.value = el.value.padStart(9, '0');
			el.value = '';
		} else {
			el.classList.add('warningBox');
		}

		if (Location.value && LU.value)
			sentiments.setAttribute('aria-disabled', 'false');
		else
			sentiments.setAttribute('aria-disabled', 'true');

		this.#codeInput.focus()
	}
	allocate(event) {
		event.stopPropagation();
		event.preventDefault();

		const sentiments = this.querySelector('#sentiments');
		if (sentiments.getAttribute('aria-disabled') === 'true' || event.target.className !== 'sentiment')
			return;

		const Location = this.querySelector('[name=location]');
		const LU = this.querySelector('[name=lu]');
		const Inventory = this.querySelector('#inventory');
		const d = new Date();
		const timestamp = d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(',', '');

		Inventory.insertAdjacentHTML('afterbegin', `<tr><td><i class="fa-solid fa-clock"></i> ${timestamp}</td><td><i class="fa-solid fa-barcode"></i></td><td>${LU.value}</td><td><i class="fa-solid fa-right-to-bracket"></i></td><td>${Location.value.replace(/(.{3})(.{3})(.{2})/, "$1 $2 $3")}</td><td class="sentiment" style="font-size: xx-small">${event.target.textContent}</td></tr>`);

		Location.value = '';
		Location.classList.remove("successBox");
		LU.value = '';
		LU.classList.remove("successBox");

		sentiments.setAttribute('aria-disabled', 'true');
	}
}

customElements.define('wms-manage', WmsManage);

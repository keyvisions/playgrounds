class WmsTransfer extends HTMLElement {
	constructor() {
		super();
	}
	connectedCallback() {
		this.innerHTML = `
			<label><span><i class="fa-solid fa-cubes-stacked"></i> Ubicazione</span>: <output name="location"></output></label>
			<label><span><i class="fa-solid fa-fw fa-barcode"></i> UDC</span>: <output name="lu"></output></label>
			<input name="code" style="font-size: x-large">
			<div id="sentiments" aria-disabled="true" style="display: flex; justify-content: space-evenly; font-size: larger;">
				<div id="S0" class="sentiment">&bull;</div>
				<div id="S1" class="sentiment">1</div>
				<div id="S2" class="sentiment">2</div>
				<div id="S3" class="sentiment">3</div>
				<div id="S4" class="sentiment">4</div>
				<div id="S5" class="sentiment">5</div>
			</div>
			<hr>
			<table id="inventory"></table>
		`;

		const codeInput = this.querySelector('input[name=code]');
		codeInput.focus();
		codeInput.addEventListener('change', (event) => this.check(event, codeInput));
		const sentiments = this.querySelector('#sentiments');
		sentiments.addEventListener('click', (event) => this.allocate(event));
	}
	check(event, el) {
		event.preventDefault();
		
		const REGEX_LOCATION = /^[A-Za-z]\d{7}$/;
		const REGEX_LU = /^\d{1,13}$/;
		const Location = this.querySelector('[name=location]');
		const LU = this.querySelector('[name=lu]');
		const sentiments = this.querySelector('#sentiments');

		el.classList.remove('warning');
		if (REGEX_LOCATION.test(el.value)) {
			Location.value = el.value.toUpperCase();
			el.value = '';
		} else if (/^[0-5]$/.test(el.value)) {
			this.querySelector(`#S${el.value}`).click();
			el.value = '';
		} else if (REGEX_LU.test(el.value)) {
			LU.value = el.value.padStart(13, '0');
			el.value = '';
		} else {
			el.classList.add('warning');
		}

		if (Location.value && LU.value)
			sentiments.setAttribute('aria-disabled', 'false');
		else
			sentiments.setAttribute('aria-disabled', 'true');
	}
	allocate(event) {
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
		LU.value = '';
		sentiments.setAttribute('aria-disabled', 'true');
	}
}

customElements.define('wms-transfer', WmsTransfer);

// deno-lint-ignore-file
class KvPutaway extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		try {
			this.putawayData = JSON.parse(this.textContent);
			if (!this.putawayData.hasOwnProperty("quantity") || !this.putawayData.hasOwnProperty("lu"))
				throw new Error();
		} catch {
			this.putawayData = {
				quantity: parseInt(this.textContent) || null,
				lu: [{ code: null, units: 1, quantity: parseInt(this.textContent), batch: null, origin: null }]
			}
		}

		this._render();
		this._initEvents();
	}

	_render() {
		this.shadowRoot.innerHTML = `
			<style>
				:host {
					font-family: inherit;
					color: inherit;
					background: inherit;
				}
				table, input, button, label, output {
					font-family: inherit;
					color: inherit;
				}
				button {
					min-width: 5em;
				}
				.modal {
					display: none;
					position: fixed;
					z-index: 1000;
					left: 0; top: 0; width: 100vw; height: 100vh;
					background: rgba(0,0,0,0.1);
					justify-content: center; align-items: center;
				}
				.modal.active { display: flex; }
				.modal-content {
					background: Canvas;
					color: CanvasText;
					min-width: 320px;
					font-size: smaller;
				}
				.modal-content header {
					background-color: CanvasText;
					color: Canvas;
					padding: 0.5em;
				}
				.modal-content table {
					padding: 0.5em;
				}
			</style>
			<strong title="Quantità dichiarata">${this.putawayData.quantity || ''}</strong> / <strong id="putawayRealQty" title="Quantità riscontrata">${this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0) || ''}</strong>
			<input id="putawayData" type="hidden" name="${this.getAttribute("name")}">
			<button id="openModalBtn" title="Crea UDC">UDC</button>
			<button id="printLabels" title="Stampa UDC">Etichette</button>
			<div class="modal" id="putawayModal">
				<form class="modal-content">
					<header>${this.getAttribute("title")}: ${this.putawayData.quantity || ''}<span class="esc" style="float: right; cursor:pointer">&#10006;</span></header>
					<table>
						<thead>
							<tr>
								<th>Units</th>
								<th>Qt.y</th>
								<th>Batch</th>
								<th>Origin</th>
								<th id="addUnits" style="cursor: pointer">&#10011;</th>
							</tr>
						</thead>
						<tbody id="luTbody"></tbody>
						<tfoot>
							<tr>
								<td><output name="totalUnits"></output></td>
								<td><output name="totalQuantity"></output></td>
							</tr>
							<tr>
								<td colspan="5"><label><input type="checkbox" name="end">Fine carico</label></td>
							</tr>
							<tr>
								<td colspan="3"><button class="esc">Annulla</button></td>
								<td colspan="2"><button id="saveData" style="float:right">OK</button></td>
							</tr>
						</tfoot>
					</table>
				</form>
			</div>`;
	}

	_initEvents() {
		const putawayData = this.shadowRoot.getElementById('putawayData');
		putawayData.value = JSON.stringify(this.putawayData);

		const putawayRealQty = this.shadowRoot.getElementById('putawayRealQty');

		const openModalBtn = this.shadowRoot.getElementById('openModalBtn');
		const printBtn = this.shadowRoot.getElementById('printLabels');

		const modal = this.shadowRoot.getElementById('putawayModal');
		const form = modal.querySelector('form');
		const tbody = modal.querySelector('#luTbody');
		const addBtn = modal.querySelector('#addUnits');
		const saveBtn = modal.querySelector('#saveData');

		const endCheckbox = form.querySelector('input[name="end"]');

		// Open modal: load LU structure from innerText or default
		openModalBtn.addEventListener('click', () => {
			if (!this.putawayData.quantity)
				return;

			if (this.putawayData.lu.length === 0)
				this.putawayData.lu.push({ code: null, units: 1, quantity: this.putawayData.quantity, batch: null, origin: null });

			this._renderLUs(tbody, this.putawayData.lu);
			modal.classList.add('active');
		});

		this.addEventListener('keydown', event => {
			if (event.code === 'Escape') {
				modal.classList.remove('active');
				event.stopPropagation();
			}
		});
		this.shadowRoot.querySelectorAll(".esc").forEach(el => {
			el.addEventListener('click', (event) => {
				modal.classList.remove('active');
			});
		});

		// Add units row
		addBtn.addEventListener('click', (event) => {
			event.preventDefault();
			const luRows = Array.from(tbody.querySelectorAll('tr')).map(tr => this._rowToData(tr));
			luRows.push({ units: 1, quantity: '', batch: '', origin: '' });
			this._renderLUs(tbody, luRows);
		});

		// Delete units row
		tbody.addEventListener('click', (event) => {
			if (event.target.classList.contains('deleteUnits')) {
				if (tbody.children.length > 1 && confirm('Are you sure?')) {
					event.target.closest('tr').remove();
					this._summary();
				}
			}
		});

		// Summary on input change
		tbody.addEventListener('input', (event) => {
			if (["units", "quantity"].includes(event.target.name)) {
				this._summary();
			}
		});

		// Save data on checkbox
		endCheckbox.addEventListener('change', (event) => {
			this._saveData(event, event.target.checked);
		});

		// Print labels
		printBtn.addEventListener('click', (event) => {
			alert('Print LU labels');
		});

		// Save data
		saveBtn.addEventListener('click', (event) => {
			event.preventDefault();
			this._saveData(event);

			const realQty = this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
			const statusQty = Math.sign(realQty - this.putawayData.quantity);
			putawayRealQty.style.color = ['black', 'green', 'red'].at(statusQty);
			putawayRealQty.textContent = realQty || '';

			modal.classList.remove('active');
		});

		// Helper to render LU rows
		this._renderLUs = (tbody, luData) => {
			tbody.innerHTML = '';
			luData.forEach(lu => {
				const tr = document.createElement('tr');
				tr.className = 'putaway';
				tr.innerHTML = `
					<td><input name="units" type="number" value="${lu.units || 1}" min="1" max="999" style="width:3em" required></td>
					<td><input name="quantity" type="number" min="1" max="1000000" value="${lu.quantity || ''}" style="width:5em" required></td>
					<td><input name="batch" type="text" value="${lu.batch || ''}" style="width:5em"></td>
					<td><input name="origin" type="text" value="${lu.origin || ''}" style="width:5em"></td>
					<td class="deleteUnits" style="cursor: pointer"><input type="hidden" name="code" value="${lu.code}">${lu.code ? "" : "&#10006;"}</td>
				`;
				tbody.appendChild(tr);
			});
			this._summary();
		};

		// Helper to extract row data
		this._rowToData = (tr) => {
			return {
				code: parseInt(tr.querySelector('[name=units]').code) || '',
				units: parseInt(tr.querySelector('[name=units]').value) || 1,
				quantity: parseInt(tr.querySelector('[name=quantity]').value) || '',
				batch: tr.querySelector('[name=batch]').value || '',
				origin: tr.querySelector('[name=origin]').value || ''
			};
		};

		this._summary = () => {
			let totalUnits = 0, totalQuantity = 0;
			this.shadowRoot.querySelectorAll('.putaway').forEach(putaway => {
				const units = parseInt(putaway.querySelector('[name=units]').value) || 0;
				const quantity = parseInt(putaway.querySelector('[name=quantity]').value) || 0;
				totalUnits += units;
				totalQuantity += units * quantity;
			});
			this.shadowRoot.querySelector('[name=totalUnits]').value = totalUnits;
			this.shadowRoot.querySelector('[name=totalQuantity]').value = totalQuantity;
		};

		this._saveData = (_event, disabled = false) => {
			const form = this.shadowRoot.querySelector('form');
			form.querySelectorAll('input[type=number], input[type=text]').forEach(input => input.disabled = disabled);
			this.shadowRoot.getElementById("addUnits").style.display = disabled ? "none" : "";
			this.shadowRoot.querySelectorAll(".deleteUnits").forEach(element => element.style.display = disabled ? "none" : "");

			this.putawayData.lu = [];
			this.shadowRoot.querySelectorAll('.putaway').forEach(putaway => {
				const data = {};
				putaway.querySelectorAll('input').forEach(input => {
					data[input.name] = input.value;
				});
				this.putawayData.lu.push(data);
			});
			if (form.end.checked) {
				this.putawayData.lu.push({
					units: null,
					quantity: parseInt(form.querySelector('[name=totalQuantity]').value) || null
				});
			}
			putawayData.value = JSON.stringify(this.putawayData);
			return false;
		};
	}
}

customElements.define('kv-putaway', KvPutaway);

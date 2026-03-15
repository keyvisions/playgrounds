// deno-lint-ignore-file
class KvPutaway extends HTMLElement {
	constructor() {
		super();
	}

	connectedCallback() {
		try {
			this.putawayData = JSON.parse(this.textContent);
			if (!this.putawayData.hasOwnProperty("quantity") || !this.putawayData.hasOwnProperty("lu"))
				throw new Error();
		} catch {
			this.putawayData = {
				itemid: this.getAttribute("itemid"),
				quantity: parseInt(this.textContent) || null,
				lu: [{ units: 1, quantity: parseInt(this.textContent), batch: "", origin: "", coded: false }]
			}
		}

		this.textContent = "";

		// Setup custom onprint event if attribute exists
		if (this.hasAttribute("onprint")) {
			const fnName = this.getAttribute("onprint").replace(/\(.*\)/, "").trim();
			if (typeof window[fnName] === "function") {
				this.onprint = window[fnName];
			}
		}

		if (!(this.putawayData.quantity > 0))
			return;

		this._render();

		if (document.getElementById("kvPutawayDialog"))
			return;

		const dialog = document.createElement("dialog");
		dialog.id = "kvPutawayDialog";
		dialog.innerHTML = `
			<header><span></span><span style="float: right; cursor:pointer" onclick="this.closest('dialog').close()"><i class="fa-solid fa-fw fa-xmark"></i></span></header>
			<form style="padding: 0.5em;">
				<table>
					<thead>
						<tr>
							<th>UDC</th>
							<th>Qt.à</th>
							<th>Lotto</th>
							<th>Origine</th>
							<th class="addUnits" style="cursor: pointer"><i class="fa-solid fa-fw fa-plus" title="Aggiungi riga"></i></th>
						</tr>
					</thead>
					<tbody></tbody>
					<tfoot>
						<tr style="font-size:smaller; text-align: center">
							<td><output name="totalUnits"></output></td>
							<td><output name="totalQuantity"></output></td>
						</tr>
						<tr>
							<td colspan="5"><label><input type="checkbox" name="end">Fine carico</label></td>
						</tr>
						<tr>
							<td colspan="5" style="text-align:right"><button id="saveData">OK</button></td>
						</tr>
					</tfoot>
				</table>
			</form>`;
		document.body.appendChild(dialog);

		this._dialogEvents(dialog);
	}

	_render() {
		this.insertAdjacentHTML("afterbegin", `
			<input id="kvPutawayData" type="hidden" name="${this.getAttribute("name")}">
			<span title="Quantità dichiarata">${this.putawayData.quantity || ''}</span> / <span id="kvPutawayRealQty" title="Quantità riscontrata">${this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0) || ''}</span>
			<i class="fa-solid fa-fw fa-boxes-stacked openDialog" title="Crea UDC" stype="cursor:pointer"></i>
		`);
		this.removeAttribute("name");

		this.addEventListener('click', (event) => {
			event.stopPropagation();

			const putawayData = event.currentTarget.putawayData;

			if (event.target.classList.contains("openDialog")) {
				if ((putawayData.quantity || 0) <= 0)
					return;

				if (putawayData.lu.length === 0)
					putawayData.lu.push({ coded: false, units: 1, quantity: putawayData.quantity, batch: null, origin: null });

				this._renderLUs(putawayData);

				const dialog = document.getElementById('kvPutawayDialog');
				dialog.querySelector("header>span").innerHTML = this.getAttribute("itemid");
				dialog.showModal();

			}
		});

		this.putawayData = this.putawayData;
		this.querySelector("input").value = JSON.stringify(this.putawayData);

		const realQty = this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
		const statusQty = Math.sign(realQty - this.putawayData.quantity)
			* (this.putawayData.lu.find(lu => !lu.coded) ? 0 : 1);;
		this.querySelector('#kvPutawayRealQty').style.color = ['red', 'green', 'red'].at(statusQty);
	}

	_dialogEvents(dialog) {
		const form = dialog.querySelector('form');
		const saveBtn = dialog.querySelector('#saveData');

		const endCheckbox = form.querySelector('input[name="end"]');

		dialog.querySelector("thead").addEventListener('click', (event) => {
			if (event.target.tagName !== "I")
				return;
			event.preventDefault();
			const luRows = Array.from(dialog.querySelector("tbody").querySelectorAll('tr')).map(tr => this._rowToData(tr));
			luRows.push({ units: 1, quantity: null, batch: '', origin: '', coded: false });
			this._renderLUs({ lu: luRows });
		});

		dialog.querySelector("tbody").addEventListener('click', (event) => {
			const action = event.target;
			if (action.tagName !== "I")
				return;
			event.preventDefault();

			if (action.classList.contains("fa-xmark") && confirm('Sicuri di voler eliminare la riga?')) {
				action.closest('tr').remove();
				this._summary();
			} else if (action.classList.contains("fa-barcode") && this.onprint) {
				const i = parseInt(action.closest("td").dataset.i);

				this.putawayData.lu[i].coded = this.onprint(this.putawayData, i);
				action.closest("tr").querySelector("[name=coded]").value = this.putawayData.lu[i].coded; // Labels printed
				action.closest("td").style.color = this.putawayData.lu[i].coded ? "" : "red";

				this.querySelector("input").value = JSON.stringify(this.putawayData);
			}
		});

		// Input change
		dialog.querySelector("tbody").addEventListener('input', (event) => {
			event.target.closest("tr").querySelector("[name=coded]").value = false; // Labels need to be reprinted
			if (["units", "quantity"].includes(event.target.name)) {
				this._summary();
			}
		});

		// Toggle putaway status
		endCheckbox.addEventListener('change', (event) => {
			const disabled = event.target.checked;

			const dialog = document.getElementById("kvPutawayDialog");

			const form = dialog.querySelector('form');
			form.querySelectorAll('input[type=number], input[type=text]').forEach(input => input.disabled = disabled);
			dialog.querySelector(".addUnits i").style.display = disabled ? "none" : "";
			dialog.querySelectorAll(".action").forEach(el => {
				if (!disabled && el.closest("tr").previousElementSibling) {
					el.className = "action deleteUnits";
					el.querySelector("i").insertAdjacentHTML("afterend", `<i class="fa-solid fa-fw fa-xmark" title="Elimina riga"></i>`);
					el.querySelector("i").remove();
				} else if (disabled && this.onprint) {
					el.className = "action printLabels";
					el.style.color = el.querySelector("input").value === "false" ? "red" : "";
					el.querySelector("i").insertAdjacentHTML("afterend", `<i class="fa-solid fa-fw fa-barcode" title="Genera etichette"></i>`);
					el.querySelector("i").remove();
				} else {
					el.className = "action";
					el.querySelector("i").insertAdjacentHTML("afterend", `<i></i>`);
					el.querySelector("i").remove();
				}
			});

			if (disabled && !this.putawayData.hasOwnProperty("totalLU")) {
				this.putawayData.totalLU = 1;
			} else if (!disabled) {
				delete this.putawayData.totalLU;
			}
		});

		// Save data
		saveBtn.addEventListener('click', (event) => {
			event.preventDefault();

			const dialog = document.getElementById("kvPutawayDialog");

			this.putawayData.lu = [];
			dialog.querySelectorAll('.putaway').forEach(putaway => {
				const lu = this._rowToData(putaway);
				if (lu.units && lu.quantity)
					this.putawayData.lu.push(lu)
			});

			delete this.putawayData.totalLU;
			if (dialog.querySelector("[type=checkbox]").checked)
				this.putawayData.totalLU = this.putawayData.lu.reduce((a, b) => a + b.units, 0);

			this.querySelector("input").value = JSON.stringify(this.putawayData);

			const realQty = this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
			const statusQty = Math.sign(realQty - this.putawayData.quantity)
				* (this.putawayData.lu.find(lu => !lu.coded) ? 0 : 1);
			this.querySelector('#kvPutawayRealQty').style.color = ['red', 'green', 'red'].at(statusQty);
			this.querySelector('#kvPutawayRealQty').textContent = realQty || '—';

			document.getElementById("kvPutawayDialog").close();
		});
	}

	_renderLUs = (data) => {
		const tbody = document.getElementById("kvPutawayDialog").querySelector("tbody");

		const disabled = data.hasOwnProperty("totalLU") ? "disabled" : "";

		tbody.innerHTML = '';
		data.lu.forEach((lu, i) => {
			const tr = document.createElement('tr');
			tr.className = 'putaway';
			tr.innerHTML = `
				<td><input name="units" type="number" value="${lu.units || 1}" min="1" max="999" style="width:3em" required ${disabled}></td>
				<td><input name="quantity" type="number" min="1" max="1000000" value="${lu.quantity || ''}" style="width:5em" required ${disabled}></td>
				<td><input name="batch" type="text" value="${lu.batch || ''}" style="width:5em" ${disabled}></td>
				<td><input name="origin" type="text" value="${lu.origin || ''}" style="width:5em" ${disabled}></td>`;
			if (!disabled && tbody.children.length > 0)
				tr.innerHTML += `<td data-i="${i}" class="action deleteUnits" style="cursor: pointer"><input type="hidden" name="coded" value="${lu.coded}"><i class="fa-solid fa-fw fa-xmark" title="Elimina riga"></i></td>`;
			else if (disabled && this.onprint)
				tr.innerHTML += `<td data-i="${i}" class="action printLabels" style="cursor: pointer${lu.coded ? `` : `; color: red`}"><input type="hidden" name="coded" value="${lu.coded}"><i class="fa-solid fa-fw fa-barcode" title="Genera etichette"></i></td>`;
			else
				tr.innerHTML += `<td data-i="${i}" class="action"><input type="hidden" name="coded" value="false"><i></i></td>`;

			if (lu.units > 0)
				tbody.appendChild(tr);
		});
		this._summary();
	};

	_rowToData = (tr) => {
		return {
			units: parseInt(tr.querySelector('[name=units]').value) || 1,
			quantity: parseInt(tr.querySelector('[name=quantity]').value) || null,
			batch: tr.querySelector('[name=batch]').value || '',
			origin: tr.querySelector('[name=origin]').value || '',
			coded: tr.querySelector('[name=coded]').value === "true" ? true : false
		};
	};

	_summary = () => {
		const dialog = document.getElementById("kvPutawayDialog");

		let totalUnits = 0, totalQuantity = 0;
		dialog.querySelectorAll('.putaway').forEach(putaway => {
			const units = parseInt(putaway.querySelector('[name=units]').value) || 0;
			const quantity = parseInt(putaway.querySelector('[name=quantity]').value) || 0;
			totalUnits += units;
			totalQuantity += units * quantity;
		});
		dialog.querySelector('[name=totalUnits]').value = totalUnits;
		dialog.querySelector('[name=totalQuantity]').value = totalQuantity;
	};
}

customElements.define('kv-putaway', KvPutaway);

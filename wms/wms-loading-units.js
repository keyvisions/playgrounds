// deno-lint-ignore-file
class WMSLoadingUnits extends HTMLElement {
	constructor() {
		super();
		this.classList.add("wms");
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

		if (document.getElementById("WMSLoadingUnitsDialog"))
			return;

		const dialog = document.createElement("dialog");
		dialog.id = "WMSLoadingUnitsDialog";
		dialog.innerHTML = `
			<header><span></span><span style="float: right; cursor:pointer" onclick="this.closest('dialog').close()"><i class="fa-solid fa-fw fa-xmark"></i></span></header>
			<form style="padding: 0.5em;">
				<table>
					<thead>
						<tr>
							<th>Imballi</th>
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
		this.appendChild(dialog);

		this._dialogEvents(dialog);
	}

	_render() {
		this.insertAdjacentHTML("afterbegin", `
			<style>.warning { color: red; }</style>
			<input id="WMSLoadingUnitsData" type="hidden" name="${this.getAttribute("name")}">
			<span title="Quantità dichiarata">${this.putawayData.quantity || ''}</span> / <span id="WMSLoadingUnitsRealQty" title="Quantità riscontrata">${this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0) || ''}</span>
			<i class="fa-solid fa-fw fa-boxes-stacked openDialog" title="Crea UDC" stype="cursor:pointer"></i>
		`);
		this.removeAttribute("name");

		this.addEventListener('click', (e) => {
			e.stopPropagation();

			const putawayData = e.currentTarget.putawayData;

			if (e.target.classList.contains("openDialog")) {
				if ((putawayData.quantity || 0) <= 0)
					return;

				if (putawayData.lu.length === 0)
					putawayData.lu.push({ coded: false, units: 1, quantity: putawayData.quantity, batch: null, origin: null });

				const dialog = document.getElementById('WMSLoadingUnitsDialog');

				this._renderLUs(dialog, putawayData);

				dialog.querySelector("header>span").innerHTML = `${this.getAttribute("itemid")}: ${this.putawayData.quantity}`;
				dialog.showModal();
			}
		});

		this.querySelector("input").value = JSON.stringify(this.putawayData);

		const realQty = this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
		const statusQty = this.putawayData.lu.find(lu => !lu.coded) ? -1 : Math.sign(realQty - this.putawayData.quantity);
		this.querySelector('#WMSLoadingUnitsRealQty').style.color = ['', 'green', 'red'].at(statusQty);
	}

	_dialogEvents(dialog) {
		const form = dialog.querySelector('form');
		const saveBtn = dialog.querySelector('#saveData');

		const endCheckbox = form.querySelector('input[name="end"]');

		dialog.querySelector("thead").addEventListener('click', (e) => {
			if (e.target.tagName !== "I")
				return;
			e.preventDefault();

			const luRows = Array.from(dialog.querySelector("tbody").querySelectorAll('tr')).map(tr => this._rowToData(tr));
			luRows.push({ units: 1, quantity: null, batch: '', origin: '', coded: false });
			this._renderLUs(dialog, { lu: luRows });
		});

		dialog.querySelector("tbody").addEventListener('click', (e) => {
			const action = e.target;
			if (action.tagName !== "I")
				return;
			e.preventDefault();

			if (action.classList.contains("fa-xmark") && confirm('Sicuri di voler eliminare la riga?')) {
				action.closest('tr').remove();
				this._summary();

			} else if (action.classList.contains("fa-barcode") && this.onprint) {
				const i = parseInt(action.closest("td").dataset.i);

				this.putawayData.lu[i].coded = this.onprint(this.putawayData, i);
				action.closest("tr").querySelector("[name=coded]").value = this.putawayData.lu[i].coded; // Labels printed
				if (this.putawayData.lu[i].coded)
					action.closest("td").classList.remove(`warning`);
				else
					action.closest("td").classList.add(`warning`);

				this.querySelector("input").value = JSON.stringify(this.putawayData);
			}
		});

		// Input change
		dialog.querySelector("tbody").addEventListener('change', (e) => {
			e.target.closest("tr").querySelector("[name=coded]").value = false; // Labels need to be reprinted
			switch (e.target.name) {
				case "units": {
					const oldvalue = parseFloat(e.target.oldvalue),
						newvalue = parseFloat(e.target.value),
						quantity = parseFloat(e.target.closest("tr").querySelector("[name=quantity]").value);
					e.target.closest("tr").querySelector("[name=quantity]").value = parseInt(quantity * oldvalue / newvalue);
					e.target.oldvalue = newvalue;
/*
					// Add residue row
					const luRows = Array.from(dialog.querySelector("tbody").querySelectorAll('tr')).map(tr => this._rowToData(tr));
					if (quantity % newvalue > 0) {
						const lastElement = luRows[luRows.length - 1];
						const luResidue = { ...lastElement };
						luResidue.units = 1;
						luResidue.quantity = quantity % newvalue;
						luRows.push(luResidue);
					}
*/
					this._renderLUs(dialog, { lu: luRows });
				}

				case "quantity":
					this._summary();
			}
		});

		dialog.addEventListener(`close`, (_e) => {
			const realQty = this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
			const statusQty = this.putawayData.lu.find(lu => !lu.coded) ? -1 : Math.sign(realQty - this.putawayData.quantity);
			this.querySelector('#WMSLoadingUnitsRealQty').style.color = ['', 'green', 'red'].at(statusQty);
			this.querySelector('#WMSLoadingUnitsRealQty').textContent = realQty || '—';
		});

		// Toggle putaway status
		endCheckbox.addEventListener('change', (e) => {
			const disabled = e.target.checked;

			const dialog = document.getElementById("WMSLoadingUnitsDialog");
			dialog.querySelector(".addUnits i").style.display = disabled ? "none" : "";
			dialog.querySelectorAll('.putaway').forEach(putaway => {
				const lu = this._rowToData(putaway);
				if (!(lu.units && lu.quantity))
					putaway.remove();
			});

			dialog.querySelectorAll('input[type=number], input[type=text]').forEach(input => input.disabled = disabled);

			dialog.querySelectorAll(".action").forEach(el => {
				if (!disabled && el.closest("tr").previousElementSibling) {
					el.className = "action deleteUnits";
					el.querySelector("i").insertAdjacentHTML("afterend", `<i class="fa-solid fa-fw fa-xmark" title="Elimina riga"></i>`);
					el.querySelector("i").remove();
				} else if (disabled && this.onprint) {
					el.className = `action printLabels ${el.querySelector("input").value === "false" ? "warning" : ""}`;
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
		saveBtn.addEventListener('click', (e) => {
			e.preventDefault();

			const dialog = document.getElementById("WMSLoadingUnitsDialog");

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

			document.getElementById("WMSLoadingUnitsDialog").close();
		});
	}

	_renderLUs = (dialog, data) => {
		const tbody = dialog.querySelector("tbody");

		const barcode = data.hasOwnProperty("totalLU");
		dialog.querySelector("[name=end]").checked = barcode;
		dialog.querySelector(".addUnits i").style.display = barcode ? "none" : "";

		tbody.innerHTML = '';
		data.lu.forEach((lu, i, lus) => {
			const disabled = i !== lus.length - 1;

			const tr = document.createElement('tr');
			tr.className = 'putaway';
			tr.innerHTML = `
				<td><input name="units" type="number" onfocus="this.oldvalue = this.value" value="${lu.units || 1}" min="1" max="999" style="width:3em" required ${disabled || barcode ? "disabled" : ""}></td>
				<td><input name="quantity" type="number" min="1" max="99999999" value="${lu.quantity || ''}" style="width:5em" required ${disabled || barcode ? "disabled" : ""}></td>
				<td><input name="batch" type="text" value="${lu.batch || ''}" style="width:5em" ${disabled || barcode ? "disabled" : ""}></td>
				<td><input name="origin" type="text" value="${lu.origin || ''}" style="width:5em" ${disabled || barcode ? "disabled" : ""}></td>`;
			if (!barcode && !disabled && tbody.children.length > 0)
				tr.innerHTML += `<td data-i="${i}" class="action deleteUnits" style="cursor: pointer"><input type="hidden" name="coded" value="${lu.coded}"><i class="fa-solid fa-fw fa-xmark" title="Elimina riga"></i></td>`;
			else if (barcode && this.onprint)
				tr.innerHTML += `<td data-i="${i}" class="action printLabels ${lu.coded ? `` : `warning`}" style="cursor: pointer"><input type="hidden" name="coded" value="${lu.coded}"><i class="fa-solid fa-fw fa-barcode" title="Genera etichette"></i></td>`;
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
		const dialog = document.getElementById("WMSLoadingUnitsDialog");

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
customElements.define('wms-loading-units', WMSLoadingUnits);
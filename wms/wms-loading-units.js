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
				refid: this.getAttribute("refid"),
				itemid: this.getAttribute("itemid"),
				quantity: parseInt(this.textContent) || null,
				lu: [{ units: 1, quantity: parseInt(this.textContent), batch: "", origin: "", coded: false }]
			}
		}

		this.textContent = "";

		// Setup custom onaction event if attribute exists
		if (this.hasAttribute("onaction")) {
			const fnName = this.getAttribute("onaction").replace(/\(.*\)/, "").trim();
			if (typeof window[fnName] === "function") {
				this.onaction = window[fnName];
			}
		}

		if (!(this.putawayData.quantity > 0))
			return;

		this._render();

		if (document.getElementById("WMSLoadingUnitsDialog"))
			return;

		const dialog = document.createElement("dialog");
		dialog.id = "WMSLoadingUnitsDialog";
		dialog.className = "wms";
		dialog.innerHTML = `
			<header><span></span><span style="float: right; cursor:pointer" onclick="this.closest('dialog').close()"><i class="fa-solid fa-fw fa-xmark"></i></span></header>
			<form style="padding: 0.5em 0;">
				<table>
					<thead>
						<tr>
							<th>Imballi</th>
							<th>Quantità</th>
							<th>Data code</th>
							<th>Origine</th>
							<th class="addUnits" style="cursor: pointer"><i class="fa-solid fa-fw fa-plus" title="Aggiungi riga"></i></th>
						</tr>
					</thead>
					<tbody></tbody>
					<tfoot>
						<tr style="font-size:smaller; text-align: center; font-weight: bolder">
							<td name="totalUnits"></td>
							<td name="totalQuantity"></td>
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

		WMSLoadingUnits._dialogEvents(dialog);
	}

	_render() {
		let formAttr = '';
		const form = this.closest('form');
		if (form && form.id) {
			formAttr = `form="${form.id}"`;
		}
		this.insertAdjacentHTML("afterbegin", `
			<style>.warning { color: red; }</style>
			<input type="hidden" name="${this.getAttribute("name") || this.constructor.name}" ${formAttr}>
			<span title="Quantità dichiarata">${this.putawayData.quantity.toLocaleString() || ''}</span>/<span data-realquantity title="Quantità riscontrata">${this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0).toLocaleString() || ''}</span>
			<i class="fa-solid fa-fw fa-2x fa-boxes-stacked openDialog" title="Crea UDC" stype="cursor:pointer"></i>
		`);

		this.addEventListener('click', (e) => {
			e.stopPropagation();

			const putawayData = e.currentTarget.putawayData;

			if (e.target.classList.contains("openDialog")) {
				if ((putawayData.quantity || 0) <= 0)
					return;

				if (putawayData.lu.length === 0)
					putawayData.lu.push({ coded: false, units: 1, quantity: putawayData.quantity, batch: null, origin: null });

				const dialog = document.getElementById('WMSLoadingUnitsDialog');
				dialog.refComponent = e.currentTarget;

				WMSLoadingUnits._renderLUs(dialog, putawayData);

				dialog.querySelector("header>span").innerHTML = this.getAttribute("itemid");
				dialog.showModal();
			}
		});

		this.querySelector("input").value = JSON.stringify(this.putawayData);

		const realQty = this.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
		const statusQty = Math.sign(realQty - this.putawayData.quantity);
		this.querySelector('[data-realquantity]').style.color = ['red', 'green', 'red'].at(statusQty);
		this.querySelector('.fa-boxes-stacked').style.color = this.putawayData.totalLU && this.putawayData.lu.find(lu => !lu.coded) ? 'orange' : '';
	}

	static _dialogEvents(dialog) {
		const form = dialog.querySelector('form');
		const saveBtn = dialog.querySelector('#saveData');

		const endCheckbox = form.querySelector('input[name="end"]');

		dialog.querySelector("thead").addEventListener('click', (e) => {
			if (e.target.tagName !== "I")
				return;
			e.preventDefault();

			const luRows = Array.from(dialog.querySelector("tbody").querySelectorAll('tr')).map(tr => WMSLoadingUnits._rowToData(tr));
			luRows.push({ units: 1, quantity: null, batch: '', origin: '', coded: false });
			WMSLoadingUnits._renderLUs(dialog, { lu: luRows });
		});

		dialog.querySelector("tbody").addEventListener('click', (e) => {
			const action = e.target;
			if (action.tagName !== "I")
				return;
			e.preventDefault();

			const refComponent = dialog.refComponent;

			if (action.classList.contains("fa-xmark") && confirm('Sicuri di voler eliminare la riga?')) {
				action.closest('tr').remove();
				WMSLoadingUnits._summary(dialog);

			} else if (action.classList.contains("fa-barcode") && refComponent.onaction) {
				const i = parseInt(action.closest("td").dataset.i);
				refComponent.putawayData.lu[i].coded = refComponent.onaction(refComponent.putawayData, i);
				action.closest("tr").querySelector("[name=coded]").value = refComponent.putawayData.lu[i].coded; // Labels printed
				if (refComponent.putawayData.lu[i].coded)
					action.closest("td").classList.remove(`warning`);
				else
					action.closest("td").classList.add(`warning`);
				refComponent.querySelector("input").value = JSON.stringify(refComponent.putawayData);
			}
		});

		// Input change
		dialog.querySelector("tbody").addEventListener('change', (e) => {
			e.target.closest("tr").querySelector("[name=coded]").value = false; // Labels need to be reprinted
			switch (e.target.name) {
				case "units":
					WMSLoadingUnits._renderLUs(dialog, { lu: [...dialog.querySelectorAll('tbody tr')].map(tr => WMSLoadingUnits._rowToData(tr)) });
				case "quantity":
					WMSLoadingUnits._summary(dialog);
			}
		});

		dialog.addEventListener(`close`, (_e) => {
			const refComponent = dialog.refComponent;
			delete dialog.refComponent;

			const realQty = refComponent.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
			const statusQty = Math.sign(realQty - refComponent.putawayData.quantity);
			refComponent.querySelector('[data-realquantity]').style.color = ['red', 'green', 'red'].at(statusQty);
			refComponent.querySelector('[data-realquantity]').textContent = realQty.toLocaleString() || '—';
			refComponent.querySelector('.fa-boxes-stacked').style.color = refComponent.putawayData.totalLU && refComponent.putawayData.lu.find(lu => !lu.coded) ? 'orange' : '';
		});

		// Toggle put status
		endCheckbox.addEventListener('change', (e) => {
			const disabled = e.target.checked;

			const dialog = document.getElementById("WMSLoadingUnitsDialog");
			dialog.querySelector(".addUnits i").style.display = disabled ? "none" : "";
			dialog.querySelectorAll('.put').forEach(put => {
				const lu = WMSLoadingUnits._rowToData(put, disabled);
				if (!(lu.units && lu.quantity))
					put.remove();
			});

			dialog.querySelectorAll('input[type=number], input[type=text]').forEach(input => input.disabled = disabled);

			dialog.querySelectorAll(".action").forEach(el => {
				if (!disabled && el.closest("tr").previousElementSibling) {
					el.className = "action deleteUnits";
					el.querySelector("i").insertAdjacentHTML("afterend", `<i class="fa-solid fa-fw fa-xmark" title="Elimina riga"></i>`);
				} else if (disabled && dialog.refComponent.onaction) {
					el.className = `action printLabels ${el.querySelector("input").value === "false" ? "warning" : ""}`;
					el.querySelector("i").insertAdjacentHTML("afterend", `<i class="fa-solid fa-barcode" title="Genera etichette"></i>`);
				} else {
					el.className = "action";
					el.querySelector("i").insertAdjacentHTML("afterend", `<i></i>`);
				}
				el.querySelector("i").remove();
			});

			if (disabled && !dialog.refComponent.putawayData.hasOwnProperty("totalLU")) {
				dialog.refComponent.putawayData.totalLU = 1;
				if (typeof dialog.refComponent.onaction === "function") {
					dialog.refComponent.onaction(dialog.refComponent.putawayData, -1);
				}
			} else if (!disabled) {
				delete dialog.refComponent.putawayData.totalLU;
			}

			WMSLoadingUnits._saveData(dialog);
		});

		saveBtn.addEventListener('click', (e) => {
			e.preventDefault();

			const dialog = document.getElementById("WMSLoadingUnitsDialog");
			WMSLoadingUnits._saveData(dialog);
			dialog.close();
		});
	}

	static _saveData = (dialog) => {
		const refComponent = dialog.refComponent;

		refComponent.putawayData.lu = [];
		dialog.querySelectorAll('.put').forEach(put => {
			const lu = WMSLoadingUnits._rowToData(put);
			if (lu.units && lu.quantity)
				refComponent.putawayData.lu.push(lu)
		});

		delete refComponent.putawayData.totalLU;
		if (dialog.querySelector("[type=checkbox]").checked)
			refComponent.putawayData.totalLU = refComponent.putawayData.lu.reduce((a, b) => a + b.units, 0);

		refComponent.querySelector("input").value = JSON.stringify(refComponent.putawayData);

		if (typeof dialog.refComponent.onaction === "function") {
			dialog.refComponent.onaction(refComponent.putawayData, -1);
		}

		const realQty = refComponent.putawayData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
		const statusQty = Math.sign(realQty - refComponent.putawayData.quantity);
		refComponent.querySelector('[data-realquantity]').style.color = ['red', 'green', 'red'].at(statusQty);
		refComponent.querySelector('[data-realquantity]').textContent = realQty.toLocaleString() || '—';
		refComponent.querySelector('.fa-boxes-stacked').style.color = refComponent.putawayData.totalLU && refComponent.putawayData.lu.find(lu => !lu.coded) ? 'orange' : '';
	}

	static _renderLUs = (dialog, data) => {
		const tbody = dialog.querySelector("tbody");

		const barcode = data.hasOwnProperty("totalLU");
		dialog.querySelector("[name=end]").checked = barcode;
		dialog.querySelector(".addUnits i").style.display = barcode ? "none" : "";

		tbody.innerHTML = '';
		data.lu.forEach((lu, i, lus) => {
			const tr = document.createElement('tr');
			tr.className = 'put';
			tr.innerHTML = `
				   <td><input name="units" type="number" onfocus="this.oldvalue = this.value" value="${lu.units || 1}" min="1" max="999" style="width:3em" required ${barcode ? "disabled" : ""}></td>
				   <td><input name="quantity" type="number" min="1" max="99999999" value="${lu.quantity || ''}" style="width:5em" required ${barcode ? "disabled" : ""}></td>
				   <td><input name="batch" type="text" value="${lu.batch || ''}" style="width:5em" ${barcode ? "disabled" : ""}></td>
				   <td><input name="origin" type="text" value="${lu.origin || ''}" style="width:5em" ${barcode ? "disabled" : ""}></td>`;
			if (!barcode && tbody.children.length > 0)
				tr.innerHTML += `<td data-i="${i}" class="action deleteUnits" style="cursor: pointer"><input type="hidden" name="coded" value="${lu.coded}"><i class="fa-solid fa-fw fa-xmark" title="Elimina riga"></i></td>`;
			else if (barcode && dialog.refComponent.onaction)
				tr.innerHTML += `<td data-i="${i}" class="action printLabels ${lu.coded ? `` : `warning`}" style="cursor: pointer"><input type="hidden" name="coded" value="${lu.coded}"><i class="fa-solid fa-fw fa-barcode" title="Genera etichette"></i></td>`;
			else
				tr.innerHTML += `<td data-i="${i}" class="action"><input type="hidden" name="coded" value="false"><i></i></td>`;

			if (lu.units > 0)
				tbody.appendChild(tr);
		});
		WMSLoadingUnits._summary(dialog);
	};

	static _rowToData = (tr, disabled) => {
		return {
			units: parseInt(tr.querySelector('[name=units]').value) || 1,
			quantity: parseInt(tr.querySelector('[name=quantity]').value) || null,
			batch: tr.querySelector('[name=batch]').value || '',
			origin: tr.querySelector('[name=origin]').value || '',
			coded: disabled === false ? false : tr.querySelector('[name=coded]').value === "true"
		};
	};

	static _summary = (dialog) => {
		const putawayData = dialog.refComponent.putawayData;

		let totalUnits = 0, totalQuantity = 0;
		dialog.querySelectorAll('.put').forEach(put => {
			const units = parseInt(put.querySelector('[name=units]').value) || 0;
			const quantity = parseInt(put.querySelector('[name=quantity]').value) || 0;
			totalUnits += units;
			totalQuantity += units * quantity;
		});
		dialog.querySelector('[name=totalUnits]').innerHTML = totalUnits;
		dialog.querySelector('[name=totalQuantity]').innerHTML = `${putawayData.quantity}/<span style="color:${putawayData.quantity == totalQuantity ? "inherit" : "red"}">${totalQuantity}</span>`;
	};
}
customElements.define('wms-loading-units', WMSLoadingUnits);
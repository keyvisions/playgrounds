// deno-lint-ignore-file
class WMSLoadingUnits extends HTMLElement {
	#lang = "en";
	#translations = {
		dlg_head_packages: { it: "Imballi", en: "Packages" },
		dlg_head_quantity: { it: "Quantità", en: "Quantity" },
		dlg_head_batch: { it: "Data code", en: "Data code" },
		dlg_head_origin: { it: "Origine", en: "Origin" },
		dlg_add_row: { it: "Aggiungi riga", en: "Add row" },
		dlg_save: { it: "OK", en: "Save" },
		declared_qty: { it: "Quantità dichiarata", en: "Declared quantity" },
		actual_qty: { it: "Quantità riscontrata", en: "Actual quantity" },
		manage_lu: { it: "Gestisci UDC", en: "Manage LU" },
		generate_labels: { it: "Genera etichette", en: "Generate labels" }
	};

	constructor() {
		super();
		this.classList.add('wms');
	}

	#normalizeLang(rawLang, fallback = "en") {
		const normalized = String(rawLang || "").trim().toLowerCase();
		if (!normalized) return fallback;
		if (normalized.startsWith("it")) return "it";
		if (normalized.startsWith("en")) return "en";
		return fallback;
	}

	#findNearestLangInDom() {
		let node = this.parentNode || this.getRootNode?.() || null;
		while (node && node !== document) {
			if (node.nodeType === 1 && typeof node.getAttribute === "function") {
				const lang = String(node.getAttribute("lang") || "").trim();
				if (lang) return lang;
			}
			node = node.parentNode || node.host || null;
		}
		return "";
	}

	#loadTranslations() {
		this.#lang = this.hasAttribute("lang")
			? this.#normalizeLang(this.getAttribute("lang"), "en")
			: this.#normalizeLang(this.#findNearestLangInDom(), "en");
	}

	t(key, params = null) {
		const value = this.#translations[key];
		let text = "";
		if (value && typeof value === "object" && !Array.isArray(value)) {
			text = value[this.#lang] || value.en || value.it || Object.values(value)[0] || key;
		} else if (typeof value === "string") {
			text = value;
		} else {
			text = key;
		}

		if (!params) return text;
		return text.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? ""));
	}

	async connectedCallback() {
		this.#loadTranslations();

		try {
			const lusData = document.getElementById(this.getAttribute('for'))?.value || '[]';
			this.lusData = JSON.parse(lusData)[this.getAttribute('refid')] ?? JSON.parse(this.textContent);
			if (!Object.hasOwn(this.lusData, 'refid'))
				throw new Error();
		} catch {
			this.lusData = {
				refid: this.getAttribute('refid'),
				itemid: this.getAttribute('itemid'),
				quantity: parseInt(this.textContent) || null,
				lu: [{ units: 1, quantity: parseInt(this.textContent), batch: '', origin: '', firstLU: null }]
			}
		}

		const realQty = this.lusData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
		this.lusData.status = Math.sign(realQty - this.lusData.quantity);
		delete this.lusData.totalLU;

		this.textContent = '';

		// Setup custom onaction event if attribute exists
		if (this.hasAttribute('onaction')) {
			const fnName = this.getAttribute('onaction').replace(/\(.*\)/, '').trim();
			if (typeof window[fnName] === 'function') {
				this.onaction = window[fnName];
			}
		}

		if (!(this.lusData.quantity > 0))
			return;

		this.#render();

		if (document.getElementById('WMSLoadingUnitsDialog'))
			return;

		const dialog = document.createElement('dialog');
		dialog.id = 'WMSLoadingUnitsDialog';
		dialog.className = 'wms';
		dialog.innerHTML = `
			<header><span></span><span style="cursor:pointer" onclick="this.closest('dialog').close()"><i class="fa-solid fa-xmark" style="font-size:1.5em"></i></span></header>
			<form style="padding: 0.5em 0;">
				<table>
					<thead>
						<tr>
							<th>${this.t("dlg_head_packages")}</th>
							<th>${this.t("dlg_head_quantity")}</th>
							<th>${this.t("dlg_head_batch")}</th>
							<th>${this.t("dlg_head_origin")}</th>
							<th class="addUnits" style="cursor: pointer"><i class="fa-solid fa-plus" style="font-size:1.5em" title="${this.t("dlg_add_row")}"></i></th>
						</tr>
					</thead>
					<tbody></tbody>
					<tfoot>
						<tr style="font-size:smaller; text-align: center; font-weight: bolder">
							<td name="totalUnits"></td>
							<td name="totalQuantity"></td>
							<td colspan="3"></td>
						</tr>
						<tr>
							<td colspan="5" style="text-align:right"><button id="saveData">${this.t("dlg_save")}</button></td>
						</tr>
					</tfoot>
				</table>
			</form>`;
		document.body.appendChild(dialog);

		WMSLoadingUnits.#dialogEvents(dialog);
	}

	#render() {
		this.insertAdjacentHTML('afterbegin', `
			<span title="${this.t("declared_qty")}">${this.lusData.quantity.toLocaleString() || ''}</span>/<span data-realquantity title="${this.t("actual_qty")}"${this.lusData.totalLU ? '' : 'style="color:red"'}>${this.lusData.lu.reduce((a, b) => a + b.units * b.quantity, 0).toLocaleString() || '—'}</span>
			<i class="fa-solid fa-fw fa-2x fa-boxes-stacked openDialog" title="${this.t("manage_lu")}" style="cursor:pointer"></i>
		`);

		this.addEventListener('click', (e) => {
			e.stopPropagation();

			const lusData = e.currentTarget.lusData;

			if (e.target.classList.contains('openDialog')) {
				if ((lusData.quantity || 0) <= 0)
					return;

				if (lusData.lu.length === 0)
					lusData.lu.push({ units: 1, quantity: lusData.quantity, batch: null, origin: null, firstLU: null });

				const dialog = document.getElementById('WMSLoadingUnitsDialog');
				dialog.refComponent = e.currentTarget;

				WMSLoadingUnits.#renderLUs(dialog, lusData);

				dialog.querySelector('header>span').innerHTML = this.getAttribute('itemid');
				dialog.showModal();
			}
		});

		const realQty = this.lusData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
		const statusQty = Math.sign(realQty - this.lusData.quantity);
		this.lusData.status = statusQty;

		this.querySelector('[data-realquantity]').style.color = ['', 'green', 'red'].at(statusQty);
		this.querySelector('.fa-boxes-stacked').style.color = this.onaction && this.lusData.lu.some(lu => (lu.quantity || 0) > 0 && !lu.firstLU) ? 'orange' : '';

		WMSLoadingUnits.#updateAggregatedInput(this.getAttribute('for') || this.constructor.name);
	}

	static #dialogEvents(dialog) {
		const form = dialog.querySelector('form');
		const saveBtn = dialog.querySelector('#saveData');

		dialog.querySelector('thead').addEventListener('click', (e) => {
			if (e.target.tagName !== 'I')
				return;
			e.preventDefault();

			const luRows = Array.from(dialog.querySelector('tbody').querySelectorAll('tr')).map(tr => WMSLoadingUnits.#rowToData(tr));
			luRows.push({
				units: 1,
				quantity: dialog.refComponent.lusData.quantity - luRows.reduce((a, b) => a + b.units * b.quantity, 0),
				batch: luRows.at(-1).batch,
				origin: luRows.at(-1).origin,
				firstLU: null
			});
			WMSLoadingUnits.#renderLUs(dialog, { lu: luRows });
		});

		dialog.querySelector('tbody').addEventListener('click', async (e) => {
			const action = e.target;
			if (action.tagName !== 'I')
				return;
			e.preventDefault();

			const refComponent = dialog.refComponent;

			if (action.classList.contains('fa-barcode') && refComponent.onaction) {
				const i = parseInt(action.closest('td').dataset.i);
				if ((refComponent.lusData.lu[i]?.quantity || 0) <= 0) return;
				refComponent.lusData = await refComponent.onaction(refComponent.lusData, i);
				action.closest('tr').querySelector('[name=firstLU]').value = refComponent.lusData.lu[i].firstLU || '';
				if (refComponent.lusData.lu[i].firstLU)
					action.closest('td').classList.remove(`warning`);
				else
					action.closest('td').classList.add(`warning`);
				WMSLoadingUnits.#updateAggregatedInput(refComponent.getAttribute('for'));
			}
		});

		// Input change
		dialog.querySelector('tbody').addEventListener('change', (e) => {
			e.target.closest('tr').querySelector('[name=firstLU]').value = null; // Labels need to be reprinted
			switch (e.target.name) {
				case 'units':
					WMSLoadingUnits.#renderLUs(dialog, { lu: [...dialog.querySelectorAll('tbody tr')].map(tr => WMSLoadingUnits.#rowToData(tr)) });
				case 'quantity':
					WMSLoadingUnits.#renderLUs(dialog, { lu: [...dialog.querySelectorAll('tbody tr')].map(tr => WMSLoadingUnits.#rowToData(tr)) });
					break;
				default:
					WMSLoadingUnits.#summary(dialog);
			}
			// WMSLoadingUnits.#saveData(dialog);
		});

		dialog.addEventListener(`close`, (_e) => {
			const refComponent = dialog.refComponent;
			delete dialog.refComponent;

			const realQty = refComponent.lusData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
			const statusQty = Math.sign(realQty - refComponent.lusData.quantity);
			refComponent.lusData.status = statusQty;

			refComponent.querySelector('[data-realquantity]').style.color = ['', 'green', 'red'].at(statusQty);
			refComponent.querySelector('[data-realquantity]').textContent = realQty.toLocaleString() || '—';
			refComponent.querySelector('.fa-boxes-stacked').style.color = refComponent.onaction && refComponent.lusData.lu.some(lu => (lu.quantity || 0) > 0 && !lu.firstLU) ? 'orange' : '';

			WMSLoadingUnits.#updateAggregatedInput(refComponent.getAttribute('for'));
		});

		saveBtn.addEventListener('click', (e) => {
			e.preventDefault();

			const dialog = document.getElementById('WMSLoadingUnitsDialog');
			WMSLoadingUnits.#saveData(dialog);
			dialog.close();
		});
	}

	static #saveData = (dialog) => {
		const refComponent = dialog.refComponent;

		refComponent.lusData.lu = [];
		dialog.querySelectorAll('.put').forEach(put => {
			const lu = WMSLoadingUnits.#rowToData(put);
			if (lu.units && lu.quantity > 0) // Ensure quantity > 0
				refComponent.lusData.lu.push(lu)
		});

		const realQty = refComponent.lusData.lu.reduce((a, b) => a + b.units * b.quantity, 0);
		const statusQty = Math.sign(realQty - refComponent.lusData.quantity);
		refComponent.lusData.status = statusQty;

		refComponent.querySelector('[data-realquantity]').style.color = ['', 'green', 'red'].at(statusQty);
		refComponent.querySelector('[data-realquantity]').textContent = realQty.toLocaleString() || '—';
		refComponent.querySelector('.fa-boxes-stacked').style.color = refComponent.onaction && refComponent.lusData.lu.some(lu => (lu.quantity || 0) > 0 && !lu.firstLU) ? 'orange' : '';

		WMSLoadingUnits.#updateAggregatedInput(refComponent.getAttribute('for'));

		if (typeof dialog.refComponent.onaction === 'function') {
			dialog.refComponent.onaction(JSON.parse(document.getElementById(dialog.refComponent.getAttribute('for'))?.value) || refComponent.lusData, -1);
		}
	}

	static #renderLUs = (dialog, data) => {
		const tbody = dialog.querySelector('tbody');
		const allowBarcode = Boolean(dialog.refComponent?.onaction);
		dialog.querySelector('.addUnits i').style.display = '';

		tbody.innerHTML = '';
		data.lu.forEach((lu, i, lus) => {
			const tr = document.createElement('tr');
			tr.className = 'put';
			tr.innerHTML = `
				   <td><input name="units" type="number" onfocus="this.oldvalue = this.value" value="${lu.units || 1}" min="1" max="999" style="width:3em" required></td>
				   <td><input name="quantity" type="number" min="1" max="99999999" value="${lu.quantity || ''}" style="width:5em" required></td>
				   <td><input name="batch" type="text" value="${lu.batch || ''}" style="width:5em"></td>
				   <td><input name="origin" type="text" value="${lu.origin || ''}" style="width:5em"></td>`;
			if (allowBarcode && (lu.quantity || 0) > 0)
				tr.innerHTML += `<td data-i="${i}" class="action printLabels ${lu.firstLU ? '' : 'warning'}" style="cursor: pointer"><input type="hidden" name="firstLU" value="${lu.firstLU || ''}"><i class="fa-solid fa-barcode" style="font-size:1.5em" title="${dialog.refComponent.t("generate_labels")}"></i></td>`;
			else
				tr.innerHTML += `<td data-i="${i}" class="action"><input type="hidden" name="firstLU" value="${lu.firstLU || ''}"><i></i></td>`;

			if (lu.units > 0)
				tbody.appendChild(tr);
		});
		WMSLoadingUnits.#summary(dialog);
	};

	static #rowToData = (tr) => {
		return {
			units: parseInt(tr.querySelector('[name=units]').value) || 1,
			quantity: parseInt(tr.querySelector('[name=quantity]').value) || null,
			batch: tr.querySelector('[name=batch]').value || '',
			origin: tr.querySelector('[name=origin]').value || '',
			firstLU: parseInt(tr.querySelector('[name=firstLU]').value) || null
		};
	};

	static #summary = (dialog) => {
		const lusData = dialog.refComponent.lusData;

		let totalUnits = 0, totalQuantity = 0;
		dialog.querySelectorAll('.put').forEach(put => {
			const units = parseInt(put.querySelector('[name=units]').value) || 0;
			const quantity = parseInt(put.querySelector('[name=quantity]').value) || 0;
			totalUnits += units;
			totalQuantity += units * quantity;
		});
		dialog.querySelector('[name=totalUnits]').innerHTML = totalUnits;
		dialog.querySelector('[name=totalQuantity]').innerHTML = `${lusData.quantity}/<span style="color:${lusData.quantity === totalQuantity ? 'inherit' : 'red'}">${totalQuantity}</span>`;
	};

	static #updateAggregatedInput(id) {
		if (!id) return;
		const elements = document.body.querySelectorAll(`wms-loading-units[for="${id}"]`);
		const aggregated = {};
		elements.forEach(el => {
			if (el.lusData && el.getAttribute('refid')) {
				aggregated[el.getAttribute('refid')] = el.lusData;
			}
		});
		let input = document.body.querySelector(`input[id="${id}"]`);
		if (!input) {
			input = document.createElement('input');
			input.id = id;
			input.type = 'hidden';
			input.name = id;
			input.setAttribute('form', '');
			document.body.appendChild(input);
		}
		input.value = JSON.stringify(aggregated);
	}
}
customElements.define('wms-loading-units', WMSLoadingUnits);
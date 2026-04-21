class KvFringe extends HTMLElement {
	constructor() {
		super();

		const caption = this.getAttribute('caption') || '';
		this.innerHTML = `
      <style>.selected * {background-color:SelectedItem;color:SelectedItemText;}</style>
      <input form type="hidden" name="kv-fringe"/>
		<table>
			${caption ? `<caption>${caption}</caption>` : ''}
			<thead>
			<tr>
				<th>Data</th>
				<th>Tipo</th>
				<th>Importo</th>
				<th>Tessere</th>
				<th style="width:1em"><i class="fas fa-fw fa-plus" style="cursor:pointer"></i></th>
			</tr>
			</thead>
			<tbody>
			<tr>
				<td><input form type="month" name="data"></td>
				<td><input form type="text" name="tipo"></td>
				<td><input form type="number" name="importo" step="0.01" min="0" style="text-align:right;width:8ex"></td>
				<td><input form type="text" name="tessere"></td>
				<td><i class="fas fa-fw fa-trash" style="display:none;cursor:pointer"></i></td>
			</tr>
			</tbody>
			<tfoot>
			<tr>
				<td colspan="2">Totale</td>
				<td><output form name="totale" style="display:block;text-align:right"></output></td>
				<td></td>
			</tr>
			</tfoot>
		</table>`;
	}
	connectedCallback() {
		this.data = [{ data: null, tipo: null, importo: null, tessere: null }];
		this.tbody = this.querySelector("tbody");
		this.output = this.querySelector('output');

		const forAttr = this.getAttribute('for');
		if (forAttr) {
			this.dataInput = document.getElementById(forAttr);
		}
		if (!this.dataInput) {
			this.dataInput = this.querySelector('[name="kv-fringe"]');
		}
		this.querySelector('.fa-plus').onclick = () => this.#insertRow();
		this.tbody.addEventListener('click', e => {
			if (e.target.classList.contains('fa-trash')) this.#deleteRow(e);
		});
		this.querySelector('table').addEventListener('change', e => {
			if (e.target.name === 'importo') {
				e.target.value = Number(e.target.value).toFixed(2);
			}
			this.#saveTable(true);
		});
		this.#render();
	}
	#render() {
		try {
			if (!isNaN(Number(this.dataInput.value))) {
				this.data = [{ data: null, tipo: this.dataInput.value, importo: null, tessere: null }];
			} else {
				this.data = JSON.parse(this.dataInput.value);
			}
		} catch {
			this.data = [{ data: null, tipo: null, importo: null, tessere: null }];
			this.dataInput.value = JSON.stringify(this.data);
			this.dataInput.dispatchEvent(new Event('change', { bubbles: true }));
		}
		let tr = this.tbody.firstElementChild;
		this.data.forEach((row, i) => {
			if (i > 0) tr = this.#insertRow(false);
			for (const [key, value] of Object.entries(row)) {
				tr.querySelector(`input[name=${key}]`).value = value;
			}
		});
		this.#saveTable(true);
	}
	#insertRow(save = true) {
		const tr = this.tbody.firstElementChild.cloneNode(true);
		tr.querySelector(".fa-trash").style.display = "";
		tr.querySelectorAll('input').forEach(element => element.value = "");
		this.tbody.insertAdjacentElement('beforeend', tr);
		this.#saveTable(save);
		return tr;
	}
	#deleteRow(event) {
		const tr = event.target.closest('tr');
		tr.classList.add('selected');
		setTimeout(() => {
			if (tr !== this.tbody.firstElementChild && (event.ctrlKey || confirm('Sicuri di voler eliminare la riga?')))
				tr.remove();
			else
				tr.classList.remove('selected');
			this.#saveTable(true);
		}, 0);
	}
	#saveTable(save = false) {
		if (!save) return;
		this.data = [];
		this.tbody.querySelectorAll('tr').forEach(tr => {
			const r = {};
			tr.querySelectorAll('input').forEach(input => r[input.getAttribute('name')] = input.value);
			this.data.push(r);
		});
		this.dataInput.value = JSON.stringify(this.data);
		this.dataInput.dispatchEvent(new Event('change', { bubbles: true }));
		this.output.value = this.data.reduce((acc, r) => acc + Number(r.importo || 0), 0).toFixed(2);
	}
}
customElements.define('kv-fringe', KvFringe);
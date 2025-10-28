/*
** Author: Giancarlo Trevisan
** Date: 2025/03/17
** Description: Object parametrizer. Allow to add parameters to an object
** Usage: <kv-params name="parameters"></kv-params>
*/
class kvParams extends HTMLElement {
	static observedAttributes = ['schema', 'data', 'mode', 'um', 'sheet', 'lang', 'columns', 'template']; // mode = [ *show | edit | range | manage | template] um = [ *msu | isu ]
	static #Texts = {
		'type': { en: 'Type', it: 'Tipo' },
		'label': { en: 'Label', it: 'Etichetta' },
		'um': { en: 'U.M.', it: 'U.M.' },
		'flags': { en: 'Attributes', it: 'Attributi' },
		'number': { en: 'Number', it: 'Numero' },
		'text': { en: 'Text', it: 'Testo' },
		'date': { en: 'Date', it: 'Data' },
		'select': { en: 'Selection', it: 'Selezione' },
		'checkbox': { en: 'Checkbox', it: 'Checkbox' },
		'textarea': { en: 'Notes', it: 'Note' },
		'group': { en: 'Group', it: 'Gruppo' },
		'separator': { en: 'Line', 'it': 'Linea' },
		'delete': { en: 'You sure you want to delete the parameter?', it: 'Sicuri di voler eliminare il parametro?' },
		'optionless': { en: 'Options are not applicabile to $1 parameters.', it: 'Le opzioni non sono applicabili ai parametri $1.' },
		'tests': { en: 'Test', it: 'Test' },
		'testRemove': { en: 'Sure you want to delete the test?', it: 'Sicuri di voler eliminare il test?' },
		'na': { en: 'Allow Not Applicable (NA)', it: 'Consenti Non Applicabile (NA)' },
		'decimals': { en: 'Decimals', it: 'Decimali' },
		'save': { en: 'Save', it: 'Salva' },
		'pair': { en: 'Pair', it: 'Accoppia' },
		'new': { en: 'New parameter', it: 'Nuovo parametro' },
		'required': { en: 'Required', it: 'Obbligatorio' },
		'showhide': { en: 'Show all parameters', it: 'Mostra tutti i parametri' }
	};
	static #Flags = [
		{ en: 'Described', it: 'Descrittivo', icon: 'fas fa-font' },
		{ en: 'Searched', it: 'Ricercabile', icon: 'fas fa-search' },
		{ en: '', it: '', icon: '' }, // Available: fas fa-code-branch multivalued for test
		{ en: 'Imported', it: 'Importato', icon: 'fas fa-file-download' },
		{ en: 'Technical sheet', it: 'Scheda tecnica', icon: 'fas fa-drafting-compass' },
		{ en: 'Sales sheet', it: 'Scheda commerciali', icon: 'fas fa-handshake' },
		{ en: 'Production sheet', it: 'Scheda produzione', icon: 'fas fa-tools' },
		{ en: 'Test sheet', it: 'Scheda collaudo', icon: 'fas fa-tachometer-alt' },
		{ en: 'Logistics sheet', it: 'Scheda logistica', icon: 'fas fa-truck-loading' },
		{ en: 'Plate', it: 'Targa', icon: 'fas fa-qrcode' },
		{ en: 'Required', it: 'Obbligatorio', icon: 'fas fa-exclamation' }
	];
	Schema = [];
	Data = {};
	Mode = 'show';
	Sheet = 4;
	Columns = 1;
	UM = 'msu';
	Lang = 'it';

	static findId(array, id) { return array.find(el => el.id == id) }
	static sizeArray(arr = [], size = 1) {
		if (size <= arr.length)
			return arr.slice(0, size);
		return arr.concat(new Array(size - arr.length).fill(null));
	}

	constructor() {
		super();

		this.Schema = JSON.parse(this.innerText || "[]");

		this.addEventListener('mouseup', event => {
			const target = event.target;

			if (target.name === 'showhide') {
				target.closest("kv-params").querySelectorAll('table :is(input, select, textarea):not([required])').forEach(el => 
					el.closest('tr').style.display = target.checked ? 'none' : ''
				);
				return;
			}

			target.closest('kv-params tbody')?.querySelector('.selected')?.classList.remove('selected');
			if (target.closest('kv-params tbody'))
				target.closest('tr')?.classList.add('selected');

			if (target.classList.contains('tests')) {
				const colspan = this.querySelectorAll('tfoot th').length + 1;

				if (colspan > 4)
					return; // Limit number of tests to 3

				this.querySelector('thead th[colspan]').setAttribute('colspan', colspan - 1);

				const count = this.querySelectorAll('tbody>tr').length;
				this.querySelectorAll('tbody>tr').forEach(row => {
					if (row.children[0].hasAttribute('colspan'))
						row.children[0].setAttribute('colspan', colspan)
					else {
						const node = row.lastElementChild.cloneNode(true);
						node.children[0].value = '';
						node.children[0].checked = false;
						node.children[0].setAttribute('tabindex', count + parseInt(node.children[0].getAttribute('tabindex')));
						row.lastElementChild.insertAdjacentElement('afterend', node);
					}
				});
				if (colspan > 2) {
					this.querySelector('tfoot tr').lastElementChild.innerText = '';
					this.querySelector('tfoot tr').lastElementChild.insertAdjacentHTML('afterend', '<th><i class="far fa-trash-alt testRemove"></i></th>');
				}
			} else if (target.classList.contains('testRemove')) {
				if (!confirm(kvParams.#Texts.testRemove[this.Lang]))
					return;

				const colspan = this.querySelectorAll('tfoot th').length - 1;
				this.querySelector('thead [colspan]').setAttribute('colspan', colspan);

				this.querySelectorAll('tbody>tr').forEach(row => {
					if (row.children[0].hasAttribute('colspan'))
						row.children[0].setAttribute('colspan', colspan)
					else
						row.lastElementChild.remove();
				});
				if (colspan == 2)
					this.querySelector('tfoot tr').lastElementChild.remove();
				else
					this.querySelector('tfoot tr').lastElementChild.previousElementSibling.remove();
			} else if (target.classList.contains('add')) {
				const row = this.#newRow(target.closest('tr'));
				row.scrollIntoView({ block: 'nearest' });
			} else if (target.classList.contains('remove') && target.closest('tbody')?.children.length != 1 && (event.ctrlKey || confirm(kvParams.#Texts.delete[this.Lang]))) {
				target.closest('tr').remove();
			} else if (target.classList.contains('manageOptions')) {
				this.#manageOptions(event);
			} else if (target.getAttribute('name') == 'flags') {
				target.classList.toggle('deselected');
				const flags = parseInt(target.closest('td').children[0].value);
				target.closest('td').children[0].value = target.classList.contains('deselected') ? flags & ~(1 << target.getAttribute('value')) : flags | (1 << target.getAttribute('value'));
			} else if (target.classList.contains('range')) {
				const range = [
					isNaN(parseFloat(target.form.min.value)) ? null : parseFloat(target.form.min.value),
					isNaN(parseFloat(target.form.max.value)) ? null : parseFloat(target.form.max.value),
					isNaN(parseInt(target.form.decimals.value)) ? null : parseInt(target.form.decimals.value),
					Array.from(target.form.querySelectorAll('[name="flag"]')).reduce((acc, flag, i) => {
						return acc | ((flag.checked ? 1 : 0) << i);
					}, 0)
				];
				if (target.options.hasAttribute('range')) {
					target.options.setAttribute('range', JSON.stringify(range));
					target.options.setAttribute('min', range[0]);
					target.options.setAttribute('max', range[1]);
					target.options.setAttribute('step', range[2] == null ? 'any' : Math.pow(10, -range[2]));
				} else
					target.options.value = JSON.stringify(range);

				const options = range || kvParams.findId(this.Schema, target.getAttribute('ref').replace('P', '')).options;
				const span = this.querySelector(`[title="${target.getAttribute('ref').replace('P', '@')}"] span`);
				if (span)
					span.innerHTML = this.#range(options);

				target.closest('dialog').remove();
			} else if (target.classList.contains('options')) {
				target.options.value = target.form.options.value;
				target.closest('dialog').remove();
			} else if (target.dataset.flag) {
				if (!target.classList.contains('set')) {
					this.querySelectorAll('th i.set').forEach(el => el.classList.remove('set'));
					target.classList.toggle('set');
					this.querySelectorAll('tbody input[name=flags]').forEach(el => {
						el.closest('tr').style.display = (parseInt(el.value) & (1 << parseInt(target.dataset.flag))) && target.classList.contains('set') ? '' : 'none';
					});
				} else {
					target.classList.remove('set');
					this.querySelectorAll('tbody>tr').forEach(el => el.style.display = '');
				}

				// Set kvParamsSheet cookie
				document.cookie = `kvParamsSheet=${parseInt(target.getAttribute('data-flag')) || 4}; path=/; max-age=31536000; SameSite=Strict`; // Cookie valid for 1 year
			}
		});
		this.addEventListener('focusin', event => {
			const target = event.target;
			this?.querySelector('tbody tr.selected')?.classList.remove('selected');
			if (target.closest('tbody'))
				target.closest('tr')?.classList.add('selected');
		});
		this.addEventListener('focusout', this.querySelector('tbody tr.selected')?.classList.remove('selected'));
		document.addEventListener('keyup', event => {
			if (event.key == 'Enter' && event.target.classList.contains('manageOptions'))
				this.#manageOptions(event);
			else if ((event.key == 'Enter' || event.key == ' ') && event.target.tagName === 'I' && event.target.hasAttribute('tabindex'))
				event.target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
			else if (this.Mode == 'manage' && event.altKey && (event.key == 'ArrowUp' || event.key == 'ArrowDown')) {
				const row = this.querySelector('tbody tr.selected');
				if (event.key == 'ArrowUp' && row.previousElementSibling) {
					let prevRow = row.previousElementSibling
					while (prevRow?.style.display == 'none')
						prevRow = prevRow.previousElementSibling;
					row.parentNode.insertBefore(row, prevRow);
				} else if (row.nextElementSibling) {
					let nextRow = row.nextElementSibling;
					while (nextRow?.style.display == 'none')
						nextRow = nextRow.nextElementSibling;
					row.parentNode.insertBefore(nextRow || row.parentNode.children[0], row);
				}
			}
		});
	}
	async #fetchData(name, json) {
		if (name == 'schema' && this.Schema.length == 0)
			await fetch(json).then(res => res.json()).then(data => this.Schema = data || []).catch(() => this.Schema = []);
		else if (name == 'data')
			await fetch(json).then(res => res.json()).then(data => this.Data = data || {}).catch(() => this.Data = {});
	}
	async attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue != 'show' && this.Mode != 'show')
			this.save();

		switch (name) {
			case 'sheet': this.Sheet = parseInt(newValue); break;
			case 'lang': this.Lang = newValue; break;
			case 'um': this.UM = newValue; break;
			case 'schema': await this.#fetchData(name, newValue); break;
			case 'data': await this.#fetchData(name, newValue); break;
			case 'mode': this.Mode = newValue; break;
			case 'columns': this.Columns = newValue || 1; break;
		}
		if (name != 'mode')
			name = 'mode', newValue = this.Mode || 'show';

		this.innerHTML = '';
		if (newValue == 'manage') {
			const sheetCookie = document.cookie.split('; ').find(row => row.startsWith('kvParamsSheet='));
			if (sheetCookie) {
				const sheet = parseInt(sheetCookie.split('=')[1]);
				if (!isNaN(sheet))
					this.Sheet = sheet;
			}
			this.#manageSchema();
		} else
			this.#manageSheet(newValue, this.getAttribute('template'));
	}
	#manageSchema() {
		const html =
			`<input type="hidden" name="${this.getAttribute('name')}">` +
			`<table class="schema">` +
			`<thead>` +
			`<tr>` +
			`<th>${kvParams.#Texts.type[this.Lang]}</th>` +
			`<th style="width:100%">${kvParams.#Texts.label[this.Lang]}</th>` +
			`<th>${kvParams.#Texts.um[this.Lang]}</th>` +
			`<th></th>` +
			`<th style="white-space:nowrap">${kvParams.#Flags.map((el, i) => `<i class="${el.icon}" title="${el[this.Lang]}" data-flag="${i}"></i>`).join(' ')}</th>` +
			`<th><i class="far fa-trash-alt" style="visibility:hidden"></i> <i class="fas fa-plus add" tabindex="0"></i></th>` +
			`</tr>` +
			'</thead>' +
			`<tbody class="kv-params">` +
			`<tr>` +
			`<td><input form="kv-params" type="hidden" name="id"><select form="kv-params" title="Type" name="type">` +
			`<option value="number">${kvParams.#Texts.number[this.Lang]}</option>` +
			`<option value="text">${kvParams.#Texts.text[this.Lang]}</option>` +
			`<option value="date">${kvParams.#Texts.date[this.Lang]}</option>` +
			`<option value="select">${kvParams.#Texts.select[this.Lang]}</option>` +
			`<option value="checkbox">${kvParams.#Texts.checkbox[this.Lang]}</option>` +
			`<option value="textarea">${kvParams.#Texts.textarea[this.Lang]}</option>` +
			`<option value="group">${kvParams.#Texts.group[this.Lang]}</option>` +
			`<option value="separator">${kvParams.#Texts.separator[this.Lang]}</option>` +
			`</select>` +
			`</td>` +
			`<td><input form="kv-params" name="label" title="Label" data-value="${JSON.stringify({ "en": kvParams.#Texts.new[0], "it": kvParams.#Texts.new[1] })}" style="width: -webkit-fill-available" value="${kvParams.#Texts.new[this.Lang]}"></td>` +
			`<td>` +
			`<select form="kv-params" name="um" title="UM">` +
			`<option></option>` +
			UMS.map(um => `<option value="${um.id}">${um.msu} ${um.isu?.replace(/(.*)/, ' [$1]') || ''}</option>`).join('') +
			`</select>` +
			`</td>` +
			`<td><input form="kv-params" type="hidden" name="options"><i class="fas fa-sliders-h manageOptions" ref="options" tabindex="0"></i></td>` +
			`<td style="white-space:nowrap">` +
			`<input form="kv-params" type="hidden" name="flags">` +
			kvParams.#Flags.map((flag, i) => `<i class="${flag.icon} deselected" name="flags" value="${i}" title="${flag[this.Lang]}" tabindex="0"></i>`).join(' ') +
			`</td>` +
			`<td style="white-space:nowrap"><i class="far fa-trash-alt remove" tabindex="0"></i> <i class="fas fa-plus add" tabindex="0"></i></td>` +
			`</tr>` +
			`</body>` +
			`</table>`;
		this.insertAdjacentHTML('afterbegin', html);

		this.querySelector(`i[data-flag="${this.Sheet}"]`)?.classList.toggle('set');
		this.Schema.forEach(param => {
			const row = this.#newRow(this.querySelector('tbody>tr:last-child'));
			row.style.display = (param.flags & (1 << this.Sheet)) ? '' : 'none';
			row.setAttribute('title', '@' + param.id);

			row.querySelectorAll("input,select").forEach(el => {
				if (el.name == 'label') {
					el.dataset.value = JSON.stringify(param.label); // Save dual language
					el.value = param.label[this.Lang]; // Show current language
				} else if (el.name == 'flags') {
					el.value = param.flags;
					for (let i = 0; i < kvParams.#Flags.length; ++i) {
						if ((param.flags & (1 << i)))
							row.querySelector(`i[name="flags"][value="${i}"]`).classList.remove('deselected');
						else
							row.querySelector(`i[name="flags"][value="${i}"]`).classList.add('deselected');
					}
				} else if (el.name == 'options') {
					el.value = JSON.stringify(param.options);
					if (param.options.join('') == '')
						el.nextElementSibling.classList.remove('set');
					else
						el.nextElementSibling.classList.add('set');
				} else if (el.type == 'checkbox')
					el.checked = (param[el.name] & (1 << parseInt(el.value))) == 0 ? false : true;
				else
					el.value = param[el.name];
			});
		});
		if (this.Schema.length > 0)
			this.querySelector('tbody>tr').remove();
		this.children[0].value = JSON.stringify(this.Schema);
		this.scrollIntoView({ block: 'nearest' });
	}
	#newRow(sibling) {
		if (sibling.firstChild.tagName == 'TH')
			sibling = this.querySelector('tbody').firstElementChild;
		const row = sibling.cloneNode(true);
		row.style.display = '';
		row.querySelector('select').value = 'number';
		row.querySelector('input[name="id"]').value = '';
		row.querySelector('input[name="label"]').setAttribute('data-value', JSON.stringify(kvParams.#Texts.new));
		row.querySelector('input[name="label"]').value = kvParams.#Texts.new[this.Lang];
		row.querySelector('select[name="um"]').value = '';
		row.querySelector('input[name="options"]').value = '';
		sibling.insertAdjacentElement('afterend', row);
		sibling.classList.remove('selected');
		return row;
	}
	#manageOptions(event) {
		const row = event.target.closest('tr');
		const um = kvParams.findId(UMS, row.querySelector('[name=um]')?.value || event.target.getAttribute('um'));

		row.closest('tbody').querySelector('.selected')?.classList.remove('selected');
		row.closest('tbody').classList.add('selected');
		row.classList.add('selected');

		let html = '', options, param;
		switch (row.querySelector('[name=type]')?.value || 'number') {
			case 'number':
				if (event.target.getAttribute('ref') == 'options')
					options = JSON.parse(row.querySelector('[name="options"]')?.value || '[null, null, null, null]');
				else {
					param = kvParams.findId(this.Schema, event.target.getAttribute('ref').substring(1));
					try {
						options = JSON.parse(row.querySelector(`[name=${event.target.getAttribute('ref')}]`)?.getAttribute('range')) || param?.options;
					} catch {
						options = param?.options;
					}
				}
				options[0] = isNaN(parseFloat(options[0])) ? '' : parseFloat(options[0]);
				options[1] = isNaN(parseFloat(options[1])) ? '' : parseFloat(options[1]);
				options[2] = isNaN(parseInt(options[2])) ? '' : parseInt(options[2]);
				options[3] = options[3] || 0;
				html =
					`<dialog id="kv-params-dialog" onkeydown="if (event.key=='Escape') this.close()" onclose="this.remove()">` +
					`<header onclick="this.closest('dialog').close()">`;
				if (row.querySelector('[name=label]'))
					html += `${row.querySelector('[name=label]').value} +  [${um?.msu}]`
				else
					html += row.children[0].innerText;
				html += `</header><form>` +
					`<label><span>Min</span> <input type="number" name="min" step="any" value="${options[0]}"></label>` +
					`<label><span>Max</span> <input type="number" name="max" step="any" value="${options[1]}"></label>` +
					`<label><span>${kvParams.#Texts.decimals[this.Lang]}</span> <input type="number" name="decimals" min="0" max="5" step="1" value="${options[2]}"></label>` +
					`<p style="margin:0.5rem 0"><label><input type="checkbox" name="flag" ${(options[3] & 1) ? 'checked' : ''}> ${kvParams.#Texts.na[this.Lang]}</label><br><label><input type="checkbox" name="flag" ${(options[3] & 2) ? 'checked' : ''}> ${kvParams.#Texts.required[this.Lang]}</label></p>` +
					`<button type="button" class="range" ref="${event.target.getAttribute('ref')}" id="kv-params-options" style="float:right">${kvParams.#Texts.save[this.Lang]}</button>` +
					`</form></dialog>`;
				break;

			case 'select':
				try {
					options = JSON.parse(row.querySelector('[name=options]').value || '["", ""]');
				} catch {
					options = [row.querySelector('[name=options]').value, ''];
				}
				html =
					`<dialog id="kv-params-dialog" onkeydown="if (event.key=='Escape') this.close()" onclose="this.remove()">` +
					`<header onclick="this.closest('dialog').close()">${row.querySelector('[name=label]').value}</header><form>` +
					`<kv-pair name="options" src="${row.querySelector('[name=options]').value.replaceAll('"', '&quot;')}" labels="${um ? um.msu + ',' + um.isu : 'en,it'}"></kv-pair>` +
					`<input type="checkbox" ${options[1] ? 'checked' : ''} onchange="this.previousElementSibling.setAttribute('pair', this.checked)"><label> ${kvParams.#Texts.pair[this.Lang]}</label><br>` +
					`<button type="button" ref="${event.target.getAttribute('ref')}" class="options" id="kv-params-options" style="float:right">${kvParams.#Texts.save[this.Lang]}</button>` +
					`</form></dialog>`;
				break;

			default:
				alert(kvParams.#Texts.optionless[this.Lang].replace('$1', row.querySelector('[name=type]').value));
				return;
		}

		if (html) {
			this.insertAdjacentHTML('beforeend', html);
			document.getElementById('kv-params-options').options = row.querySelector('[name=options]') || event.target.previousElementSibling;
			document.getElementById('kv-params-dialog').showModal();
		}
	}
	#manageSheet(mode, templateId) {
		if (document.getElementById(templateId)) {
			this.#manageTemplate(mode, document.getElementById(templateId));
			return;
		}

		const sheet = parseInt(this.getAttribute('sheet')) || 5;
		let cols = 1, html = '';

		this.Schema.forEach(param => {
			if (param.flags & (1 << sheet) && (mode != 'range' || (mode == 'range' && param.type == 'number')))
				cols = Math.max(cols, this.Data[`P${param.id}`]?.length || 1);
		});

		const count = this.Schema.length;

		this.Schema.forEach((param, j) => {
			if (param.flags & (1 << sheet) && (mode != 'range' || (mode == 'range' && param.type == 'number'))) {
				const ums = kvParams.findId(UMS, param.um);
				const um = param.um ? '[' + (ums[(mode == 'edit' || mode == 'range') ? 'msu' : this.UM] || ums.msu) + ']' : '';
				const icons = (param.flags & 1 ? '<i class="fas fa-font"></i>' : '') + (param.flags & 1 ? '<i class="fas fa-search"></i>' : '');

				let options, i;
				switch (param.type) {
					case 'number':
						options = this.Data[`PR${param.id}`] || [param.options] || [[null, null, null, null]];
						html += `<tr><td title="@${param.id}">${param.label[this.Lang]} ${um} ${icons}<span>${this.#range(options[0])}</span></td>`;
						kvParams.sizeArray(this.Data[`P${param.id}`], cols).forEach((value, k) => {
							value = (mode == 'show' && this.UM != 'msu' && typeof ums?.convert == 'function' ? ums.convert(value).toFixed(options[3]) : value) || '';
							html += `<td><input type="${mode == 'range' ? 'hidden' : 'number'}" ${attributes(param)} value="${value}" range="${JSON.stringify(options[k] || []).replaceAll('"', '&quot;')}" tabindex="${k * count + j}">`;
							if (mode == 'range')
								html += `<i class="fas fa-sliders-h manageOptions" ref="P${param.id}" um="${param.um}" tabindex="${k * count + j}"></i>`;
							html += '</td>';
						});
						html += '</tr>';
						break;

					case 'text':
						html += `<tr><td title="@${param.id}">${param.label[this.Lang]}  ${icons}</td>`;
						kvParams.sizeArray(this.Data[`P${param.id}`], cols).forEach((value, k) => {
							html += `<td><input ${attributes(param)} value="${value || ''}" tabindex="${k * count + j}"></td>`;
						});
						html += '</tr>';
						break;

					case 'date':
						html += `<tr><td title="@${param.id}">${param.label[this.Lang]} ${icons}</td>`;
						kvParams.sizeArray(this.Data[`P${param.id}`], cols).forEach((value, k) => {
							html += `<td><input type="date" ${attributes(param)} value="${value || ''}" tabindex="${k * count + j}"></td>`;
						});
						html += '</tr>';
						break;

					case 'checkbox':
						html += `<tr><td title="@${param.id}">${param.label[this.Lang]} ${icons}</td>`;
						kvParams.sizeArray(this.Data[`P${param.id}`], cols).forEach((value, k) => {
							html += `<td><input type="checkbox" ${attributes(param)} ${value ? 'checked' : ''} tabindex="${k * count + j}"></td>`
						});
						html += '</tr>';
						break;

					case 'select': {
						const ref = param.options[0]?.split(',');
						let paired = [];
						switch (mode) {
							case 'edit':
								i = param.options[1] && !param.um && this.Lang != 'en' ? 1 : 0;
								if (param.um)
									paired = param.options[1]?.split(',') || [];
								break;
							default:
								i = param.options[1] && (param.um && this.UM == 'isu' || !param.um && this.Lang != 'en') ? 1 : 0;
						}
						html += `<tr><td title="@${param.id}">${param.label[this.Lang]} ${um} ${icons}</td>`;
						kvParams.sizeArray(this.Data[`P${param.id}`], cols).forEach((value, k) => {
							const l = ref?.findIndex(option => option == value);
							html += `<td><select ${attributes(param)} tabindex="${k * count + j}"><option></option>${param.options[i]?.split(',').map((option, j) => `<option value="${ref[j].replace(/"/g, '&quot;')}" ${l == j ? ' selected' : ''}>${option}${paired[j] ? ' [' + paired[j] + ums.isu + ']' : ''}</option>`).join('')}</select></td>`
						});
						html += '</tr>';
						break;
					}
					case 'textarea': {
						const value = typeof this.Data[`P${param.id}`] != 'undefined' ? this.Data[`P${param.id}`][0] : '';
						html += `<tr><td colspan="*" title="@${param.id}"><label><span>${param.label[this.Lang]}${param.um ? ` [${param.um}]` : ''} ${icons}</span><textarea ${attributes(param)} tabindex="${j}">${value}</textarea></label></td></tr>`;
						break;
					}
					case 'separator':
						html += '<tr class="colspan"><td colspan="*">&nbsp;</td></tr>';
						break;

					case 'group':
						html += `<tr class="colspan"><td colspan="*">${param.label[this.Lang]}</td></tr>`;
						break;
				}
			}
		});
		html += `</tbody><tfoot><tr>${'<th></th>'.repeat(cols)}<th>${(sheet == 7 && mode == 'edit' && cols > 1) ? '<i class="far fa-trash-alt testRemove"></i>' : ''}</th></tr></tfoot>`;
		this.insertAdjacentHTML('afterbegin',
			`<div style="columns:${this.Columns};"><table class="test"><thead ${mode == 'manage' || sheet == 7 ? '' : 'style="display:none"'}><tr><th style="width:100%;text-align:left" title="${kvParams.#Flags[sheet][this.Lang]}"></th><th${(sheet == 7 && (mode == 'edit' || mode == 'range')) ? ` class="tests" colspan="${cols}">${kvParams.#Texts.tests[this.Lang]} <i class="fas fa-plus tests"></i>` : ` colspan="${cols}">`}</th></tr></thead><tbody class="kv-params">` +
			html.replaceAll('colspan="*"', `colspan="${cols + 1}"`) +
			'</table></div>');

		if (mode == 'show')
			this.querySelectorAll('input, textarea, select').forEach(el => el.setAttribute('disabled', ''));
		this.insertAdjacentHTML('afterbegin', `<label><input form="none" name="showhide" type="checkbox">${kvParams.#Texts.showhide[this.Lang]}</label>`);

		const target = this.querySelector('[name="showhide"]');
		target.closest("kv-params").querySelectorAll('table :is(input, select, textarea):not([required])').forEach(el => 
			el.closest('tr').style.display = target.checked ? '' : 'none'
		);
				
		function attributes(param) {
			const options = param.options;
			let range = '';
			if (param.type == 'number')
				range = `${isNaN(parseFloat(options[0])) ? '' : ` min="${options[0]}"`}${isNaN(parseFloat(options[1])) ? '' : ` max="${options[1]}"`}${isNaN(parseInt(options[2])) ? ' step="any"' : ` step="${Math.pow(10, -parseInt(options[2]))}"`}`;
			return `name="P${param.id}"${(param.flags & (1 << 10)) == 0 ? '' : ' required'}${(param.flags & (1 << 3)) == 0 ? '' : ' disabled'} ${range} form="kvParams"`;
		}
	}
	#manageTemplate(mode, template) {
		this.appendChild(document.importNode(template.content, true));

		if (mode != 'edit')
			mode = 'show';

		this.querySelectorAll('slot[name^="P"]').forEach(el => {
			const paramName = el.getAttribute("name");
			const param = kvParams.findId(this.Schema, parseInt(paramName.substring(1)));

			if (param) {
				const ums = kvParams.findId(UMS, param.um);
				const um = param.um ? '[' + (ums[mode == 'edit' ? 'msu' : this.UM] || ums.msu) + ']' : '';
				const icons = (param.flags & 1 ? '<i class="fas fa-font"></i>' : '') + (param.flags & 1 ? '<i class="fas fa-search"></i>' : '');

				let options, i;
				const value = this.Data[paramName] ? this.Data[paramName][0] : '';
				switch (param.type) {
					case 'number':
						options = this.Data[`PR${param.id}`] || [param.options] || [[null, null, null, null]];
						value = (mode == 'show' && this.UM != 'msu' && typeof ums?.convert == 'function' ? ums.convert(value).toFixed(options[3]) : value) || '';
						el.insertAdjacentHTML('afterend', `<label title="@${param.id}"><span>${param.label[this.Lang]} ${um} ${icons} ${this.#range(options[0])}</span><input ${attributes(param)} value="${value}" range="${JSON.stringify(options[k] || []).replaceAll('"', '&quot;')}"></label>`);
						break;

					case 'text':
						el.insertAdjacentHTML('afterend', `<label title="@${param.id}"><span>${param.label[this.Lang]} ${um} ${icons}</span> <input ${attributes(param)} value="${value || ''}"></label>`);
						break;

					case 'date':
						el.insertAdjacentHTML('afterend', `<label title="@${param.id}"><span>${param.label[this.Lang]} ${um} ${icons}</span> <input type="date" ${attributes(param)} value="${value || ''}"></label>`);
						break;

					case 'checkbox':
						el.insertAdjacentHTML('afterend', `<label title="@${param.id}"><span>${param.label[this.Lang]} ${um} ${icons}</span> <input type="checkbox" ${attributes(param)} ${value ? 'checked' : ''}></label>`);
						break;

					case 'select': {
						const ref = param.options[0]?.split(',');
						let paired = [];
						switch (mode) {
							case 'edit':
								i = param.options[1] && !param.um && this.Lang != 'en' ? 1 : 0;
								if (param.um)
									paired = param.options[1]?.split(',') || [];
								break;
							default:
								i = param.options[1] && (param.um && this.UM == 'isu' || !param.um && this.Lang != 'en') ? 1 : 0;
						}
						const l = ref?.findIndex(option => option == value);
						el.insertAdjacentHTML('afterend', `<label title="@${param.id}"><span>${param.label[this.Lang]} ${um} ${icons}</span><select ${attributes(param)}><option></option>${param.options[i]?.split(',').map((option, j) => `<option value="${ref[j].replace(/"/g, '&quot;')}" ${l == j ? ' selected' : ''}>${option}${paired[j] ? ' [' + paired[j] + ums.isu + ']' : ''}</option>`).join('')}</select></label>`);
						break;
					}
					case 'textarea':
						el.insertAdjacentHTML('afterend', `<label title="@${param.id}"><span>${param.label[this.Lang]} ${icons}</span><textarea ${attributes(param)}>${value}</textarea></label>`);
						break;
				}
			}
			el.remove();
		});

		if (mode == 'show')
			this.querySelectorAll('input, textarea, select').forEach(el => el.setAttribute('disabled', ''));

		function attributes(param) {
			const options = param.options;
			let range = '';
			if (param.type == 'number')
				range = `${isNaN(parseFloat(options[0])) ? '' : ` min="${options[0]}"`}${isNaN(parseFloat(options[1])) ? '' : ` max="${options[1]}"`}${isNaN(parseInt(options[2])) ? ' step="any"' : ` step="${Math.pow(10, -parseInt(options[2]))}"`}`;
			return `name="P${param.id}"${(param.flags & (1 << 10)) == 0 ? '' : ' required'}${(param.flags & (1 << 3)) == 0 ? '' : ' disabled'} ${range} form="kvParams"`;
		}
	}
	#range(options) {
		return `${isNaN(parseFloat(options[0])) ? '(-∞,' : `[${parseFloat(options[0]).toFixed(parseInt(options[2]))}, `} ${isNaN(parseFloat(options[1])) ? '+∞)' : `${parseFloat(options[1]).toFixed(parseInt(options[2]))}]`}${isNaN(parseInt(options[2])) ? '' : ` ±${Math.pow(10, -parseInt(options[2]))}`}`;
	}
	save() {
		if (this.querySelector('.schema') != null) {
			// Before rewritting the schema save the max id, this prevents reuse of old ids in case they are deleted
			let max = this.Schema.reduce((maxId, el) => Math.max(maxId, parseInt(el.id)), 0) || 0;

			this.Schema = [];
			this.querySelectorAll('tbody>tr').forEach(tr => {
				const param = {};
				tr.querySelectorAll('input,select').forEach(el => {
					if (el.name == 'label') {
						param[el.name] = JSON.parse(el.dataset.value);
						param[el.name][this.Lang] = el.value;
					} else if (el.name == 'options')
						param.options = JSON.parse(el.value || '[]');
					else if (el.name == 'flags')
						param.flags = parseInt(el.value) || 16;
					else if (el.name == 'id') {
						el.value = el.value == '' ? ++max : el.value;
						el.closest('tr').setAttribute('title', '@' + el.value);
						param.id = parseInt(el.value);
					} else
						param[el.name] = el.value;
				});
				this.Schema.push(param);
			});
			this.children[0].value = JSON.stringify(this.Schema);

			return this.children[0].value;
		} else if (this.Mode != 'show') {
			let tests = this.querySelectorAll('tfoot>tr>th').length - 1;
			tests = this.hasAttribute('template') ? 1 : tests;
			this.querySelectorAll('input, select, textarea').forEach((el, i) => {
				const s = i % tests;
				if (!s) {
					this.Data[el.name] = new Array(tests);
					if (el.type == 'number' || el.type == 'hidden')
						this.Data[el.name.replace('P', 'PR')] = new Array(tests);
				}

				if (el.type == 'checkbox')
					this.Data[el.name][s] = el.checked ? (1 << parseInt(el.value)) : 0;
				else if (el.type == 'number' || el.type == 'hidden') {
					this.Data[el.name][s] = parseFloat(el.value) || null;
					this.Data[el.name.replace('P', 'PR')][s] = kvParams.sizeArray(JSON.parse(el.getAttribute('range')), 4);
				} else if (el.hasAttribute('data-value')) {
					this.Data[el.name][s] = JSON.parse(el.dataset.value || '{"en":null,"it":null}');
					this.Data[el.name][s][this.Lang] = el.value;
				} else
					this.Data[el.name][s] = el.value;
			});

			if (this.closest('form') && this.getAttribute('name') && this.closest('form')[this.getAttribute('name')])
				this.closest('form')[this.getAttribute('name')].value = JSON.stringify(this.Data);

			return JSON.stringify(this.Data);
		}
	}
}
customElements.define('kv-params', kvParams);
function kvJSONForm(jsonField, ith) {
	if (!(jsonField instanceof Element)) {
		document.querySelectorAll('[data-json]').forEach((element, i) => {
			if (!document.querySelector(`form[id="json${i}"]`))
				document.body.insertAdjacentHTML('beforeend', `<form id="json${i}" style="display:none"></form>`);
			kvJSONForm(element, i);
		});
		return;
	}
	const form = jsonField.form;
	if (!form)
		return;

	form.addEventListener('submit', event => {
		let invalid = form.querySelector('[form^=json]:invalid');
		if (!invalid) {
			let data = JSON.parse(form.jsonField.value || '{}');
			form.querySelectorAll('[class*="JSONData"][readonly]').forEach(el => data[el.getAttribute('name')] = form.valueStringify(el));
			form.jsonField.value = JSON.stringify(data);
			return true;
		}

		event.preventDefault();
		invalid.form.reportValidity();
	});
	form.classList.add(jsonField.hasAttribute('data-cssclass') ? jsonField.dataset.cssclass || 'kvJSONForm' : 'kvJSONForm');
	form.jsonField = jsonField;
	form.querySelectorAll('[form=json]').forEach(el => {
		el.setAttribute('form', `json${ith}`);
		el.classList.add('JSONData');
	});

	form.executeFunctionByName = function (functionName, context /*, args */) {
		let args = Array.prototype.slice.call(arguments, 2);
		let namespaces = functionName.split(".");
		let func = namespaces.pop();
		for (let i = 0; i < namespaces.length; i++)
			context = context[namespaces[i]] || window;
		return context[func]?.apply(context, args);
	}

	if (form.hasAttribute('disabled')) {
		form.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]').forEach(el => {
			el.style.display = 'none';
		});

		form.querySelectorAll('.JSONData').forEach(el => {
			if (el.tagName == 'DIV')
				el.removeAttribute('contenteditable');
			else if (el.tagName == 'TABLE')
				return;
			else {
				el.disabled = true;
				if (el.value == 'disabled')
					el.value = '';
			}
		});
	}

	form.newColumn = table => {
		if (!table.querySelector('tbody'))
			table.querySelector('.dataRow').insertAdjacentHTML('beforebegin', '<tbody></tbody>');
		if (!table.querySelector('tbody').childElementCount) {
			table.querySelector('tbody').insertAdjacentHTML('afterbegin', table.querySelector('.dataRow').innerHTML);
		} else {
			let th = table.querySelector('thead>tr>th:nth-child(2)').cloneNode(true);
			table.querySelector('thead>tr>th').insertAdjacentElement('afterend', th);

			let rows = table.querySelectorAll('.dataRow td');
			for (let r = 0; r < rows.length; ++r)
				table.querySelector('tbody').children[r].appendChild(rows[r].cloneNode(true));
		}
	}

	form.JSONStringify = function (event, table) {
		if (event.target && !event.target.classList.contains('JSONData') && !event.target.closest(".deleteRow"))
			return;

		let form = event.currentTarget || jsonField.form;

		let data = JSON.parse(form.jsonField.value || '{}'),
			el = table || event.target;

		table = el.closest('table') && el.closest('table').classList.contains('JSONData') ? el.closest('table') : table;
		if (table) {
			let tableName = table.getAttribute('name');
			data[tableName] = [];
			if (table.classList.contains('columnar')) {
				for (let i = 0; i < table.querySelectorAll('tbody>tr:first-child .JSONData[name]').length; ++i)
					data[tableName].push({});

				table.querySelectorAll('tbody>tr').forEach(function (row, i) {
					row.querySelectorAll('.JSONData[name]').forEach(function (fld, i) {
						data[tableName][i][fld.getAttribute('name')] = form.valueStringify(fld);
					});
				});

			} else {
				table.querySelectorAll('tbody').forEach(row => {
					let rowData = {};
					row.querySelectorAll('.JSONData[name]').forEach(fld => {
						rowData[fld.getAttribute('name')] = form.valueStringify(fld);
					});
					data[tableName].push(rowData);
				});

				// Summary functions
				data[`${tableName}_summary`] = {};
				table.querySelectorAll(`tfoot output[for]`).forEach(output => {
					let sum = 0, count = 0;
					table.querySelectorAll(`tbody input[name=${output.getAttribute('for')}]`).forEach(cell => {
						count += cell.value ? 1 : 0;
						if (cell.value.indexOf(':') == -1)
							sum += parseFloat(cell.value) || 0.0;
						else
							sum += cell.value.split(':').reduce(function (seconds, v) { return + v + seconds * 60; }, 0) / 60;
					});
					switch (output.dataset.action) {
						case 'count': output.value = count; break;
						case 'sum': output.value = output.hasAttribute('step') ? sum.toFixed(-Math.log10(output.getAttribute('step'))) : sum; break;
						case 'avg': output.value = (output.hasAttribute('step') ? (sum / count).toFixed(-Math.log10(output.getAttribute('step'))) : sum / count); break;
					}
					if (isNaN(output.value))
						output.value = '';
					data[`${tableName}_summary`][output.getAttribute('for')] = output.value;
				});
			}

			if (table.querySelector('.dataRow').onchange)
				table.querySelector('.dataRow').onchange(table);

		} else
			data[el.getAttribute('name')] = form.valueStringify(el);

		form.jsonField.value = JSON.stringify(data);
		form.jsonField.dispatchEvent(new Event('input'));
	}
	form.valueStringify = el => {
		let value;

		if (el.type == 'checkbox' && (el.value == undefined || el.value == 'on')) {
			value = 0;
			if (el.closest('fieldset'))
				el.closest('fieldset').querySelectorAll('[type=checkbox]').forEach((checkbox, i) => { value = (value || 0) | checkbox.checked << i });
			else
				value = el.checked;
		} else if (el.type == 'checkbox') {
			value = [];
			el.closest('fieldset').querySelectorAll('[type=checkbox]').forEach(checkbox => {
				if (checkbox.checked) value.push(checkbox.value)
			});
		} else if (el.type == 'select-multiple') {
			value = [];
			el.querySelectorAll('option').forEach(option => {
				if (option.selected) value.push(option.value)
			});
			value = value.join(',');
		} else
			value = typeof el.value != 'undefined' ? el.value : el.innerHTML;

		el.classList.add('modified');

		return value;
	}

	let dragged_tbody;
	function sortableBody(tbody) {
		tbody.setAttribute('draggable', true);
		tbody.addEventListener('dragstart', event => {
			if (!document.elementFromPoint(event.clientX, event.clientY).classList.contains('fa-grip-vertical')) {
				event.stopPropagation();
				event.preventDefault();
				return;
			}
			dragged_tbody = event.target;
			dragged_tbody.style.backgroundColor = '#EEE';
			event.dataTransfer.setDragImage(document.createElement('div'), 0, 0);
		});
		tbody.addEventListener('dragover', event => {
			event.preventDefault();
			if (dragged_tbody.closest('table').getAttribute('name') == event.target.closest('table').getAttribute('name')) {
				event.dataTransfer.dropEffect = 'move';
			} else {
				event.dataTransfer.dropEffect = 'none';
				event.stopPropagation();
				return;
			}
			if (event.currentTarget == dragged_tbody.previousElementSibling || event.currentTarget.previousElementSibling.tagName == 'THEAD')
				event.currentTarget.insertAdjacentElement('beforeBegin', dragged_tbody);
			else
				event.currentTarget.insertAdjacentElement('afterEnd', dragged_tbody);
		});
		tbody.addEventListener('drop', event => {
			dragged_tbody.style.backgroundColor = null;
			form.JSONStringify({ currentTarget: form }, tbody.closest('table'));
		});
	}

	form.JSONParse = event => {
		let form = event.target.closest('form');
		let data;

		document.querySelectorAll(`[form="json${ith}"][name^="*"]`).forEach(el => el.name = el.name.substring(1)); // Rename without starting *

		try {
			data = JSON.parse(form.jsonField.value || '{}');
			form.style.backgroundColor = 'inherit';
			form.title = '';
		} catch (err) {
			form.style.backgroundColor = 'rgba(255,0,0,0.1)';
			form.title = err;
			return;
		}

		Object.keys(data).forEach(datum => {
			let el = form.querySelector('.JSONData[name="' + datum + '"]');
			if (el && el.tagName == 'TABLE' && el.classList.contains('JSONData')) {
				if (!el.querySelector('tfoot'))
					el.insertAdjacentHTML('beforeend', '<tfoot></tfoot>')

				if (!el.hasAttribute('data-key'))
					el.querySelectorAll('tbody').forEach(tbody => { tbody.remove(); });
				if (el.classList.contains('columnar')) {
					el.querySelector('.dataRow').insertAdjacentHTML('beforebegin', '<tbody></tbody>');
					let ths = el.querySelectorAll('.deleteColumn');
					for (let i = ths.length - 1; i > 0; --i)
						ths[i].parentElement.removeChild(ths[i]);

					for (let col = 0; col < data[datum].length; ++col)
						form.newColumn(el);

					data[datum].forEach(function (subdatum, c) {
						Object.keys(subdatum).forEach(key => {
							let subelement = el.querySelector(`tbody td:nth-child(${c + 2}) .JSONData[name="${key}"]`);
							if (subelement)
								form.parseValue(subelement, subdatum[key]);
						});
					});
				} else {
					if (el.hasAttribute('data-key')) {
						el.querySelectorAll('tbody[data-key]').forEach((tbody, row) => {
							let subdatum = data[datum].find(d => d[el.getAttribute('data-key')] == tbody.getAttribute('data-key')) ||
								{ [el.getAttribute('data-key')]: tbody.getAttribute('data-key') };

							let _tbody = document.createElement('tbody');
							_tbody.innerHTML = el.querySelector('.dataRow').innerHTML;
							if (el.classList.contains('sortable'))
								sortableBody(tbody);

							_tbody.querySelectorAll('[form=json]').forEach(el => {
								el.setAttribute('form', `json${ith}`);
								el.classList.add('JSONData');
							});

							const td = tbody.querySelectorAll('td');
							_tbody.querySelectorAll('td').forEach((_td, col) => {
								if (_td.innerHTML != '')
									td[col].innerHTML = (col == 0 ? `${row + 1}.` : '') + _td.innerHTML;
							});

							Object.keys(subdatum).forEach(datum => {
								let subelement = tbody.querySelector(`.JSONData[name="${datum}"]`);
								if (subelement)
									form.parseValue(subelement, subdatum[datum]);
							});

							tbody.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
						});

					} else {
						data[datum].forEach(subdatum => {
							let tbody = document.createElement('tbody');
							tbody.innerHTML = el.querySelector('.dataRow').innerHTML;
							if (el.classList.contains('sortable'))
								sortableBody(tbody);

							tbody.querySelectorAll('[form=json]').forEach(el => {
								el.setAttribute('form', `json${ith}`);
								el.classList.add('JSONData');
							});

							Object.keys(subdatum).forEach(datum => {
								if (datum == 'name' && tbody.querySelector('input[name=""]'))
									tbody.querySelector('input[name=""]').setAttribute('name', datum);

								let subelement = tbody.querySelector(`.JSONData[name="${datum}"]`);
								if (subelement)
									form.parseValue(subelement, subdatum[datum]);
							});

							// Assign name to nameless field
							let fld = tbody.querySelector('input[name=""]');
							if (fld) {
								fld.name = 'name';
								fld.value = Object.keys(subdatum).name || 'U' + Math.floor(performance.now() * 10000000000000); // Assign unique name;
							}

							el.querySelector('tfoot').insertAdjacentElement('beforebegin', tbody);
							tbody.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
						});
					}

					// Summary functions
					el.querySelectorAll(`tfoot output[for]`).forEach(output => {
						let count = 0, sum = 0;
						el.querySelectorAll(`tbody input[name=${output.getAttribute('for')}]`).forEach(cell => {
							count += cell.value ? 1 : 0;
							sum += parseFloat(cell.value) || 0.0;
						});
						switch (output.dataset.action) {
							case 'count': output.value = count; break;
							case 'sum': output.value = sum; break;
							case 'avg': output.value = sum / count; break;
						}
					});
				}
				if (el.querySelector(".dataRow")?.hasAttribute('onload'))
					eval(el.querySelector(".dataRow").getAttribute('onload'));

			} else
				form.parseValue(el, data[datum]);
		});

		form.querySelectorAll('table.JSONData').forEach(table => {
			if (table.querySelector('.dataRow').onchange)
				table.querySelector('.dataRow').onchange(table);
		});

		// Make sure form fields are present and initialized in data object
		form.querySelectorAll('[form*="json"]').forEach(el => {
			form.JSONStringify({
				currentTarget: form,
				target: el
			});
		});
	}
	form.parseValue = function (el, value) {
		if (!el || el.tagName == 'TD' || (el.tagName == 'DIV' && !el.contentEditable == 'true'))
			return;
		if (el.tagName == 'DIV') {
			el.innerHTML = value;

		} else if (el.type == 'checkbox' || el.type == 'radio') {
			if (el.closest('fieldset')) {
				if (Array.isArray(value))
					el.closest('fieldset').querySelectorAll('[type=checkbox]').forEach(checkbox => {
						checkbox.checked = value.find(value => { return value == checkbox.value }) ? true : false;
					});
				else if (el.type == 'radio')
					el.closest('fieldset').querySelectorAll('[type=radio]').forEach(radio => {
						radio.checked = (value == radio.value);
					});
				else
					el.closest('fieldset').querySelectorAll('[type=checkbox]').forEach(function (checkbox, i) {
						checkbox.checked = (value || 0) & (1 << i) ? true : false;
					});
			} else {
				el.checked = value ? true : false;
			}

		} else if (el.type == 'select-multiple') {
			el.querySelectorAll('option').forEach(option => {
				if (value.split(',').find(value => { return value == option.value }))
					option.setAttribute('selected', '');
			});

		} else {
			el.setAttribute('value', value);
			el.value = value; // Needs to be set along with the attribute above
		}
	}

	// Normalize JSON field
	try {
		JSON.parse(jsonField.value);
		if (!jsonField.value)
			jsonField.value = '{}';
	} catch (err) {
		jsonField.value = '{}';
	}
	form.JSONParse({ target: jsonField });

	form.zoom = function (event, contenteditable) {
		contenteditable = contenteditable || event.target;

		if ((event.type == 'mousedown' || event.key == 'F2') && (contenteditable.tagName == 'TEXTAREA' || contenteditable.hasAttribute('contenteditable'))) { // Zoom
			if (contenteditable.closest('label'))
				contenteditable.closest('label').classList.toggle('zoom');
			else
				contenteditable.classList.toggle('zoom');
			contenteditable.blur();
			contenteditable.focus();
			event.stopPropagation();
			event.preventDefault();
		}
	}

	form.addEventListener('keydown', form.zoom);
	form.addEventListener('input', form.JSONStringify);
	form.addEventListener('click', event => {
		if (event.target.hasAttribute('contenteditable')) {
			event.preventDefault();
			return;
		}

		let action = event.target.closest('th') || event.target.closest('td');
		if (!action)
			return;

		let table = event.target.closest('table');
		action = action.classList;
		if (action.contains('newRow')) {
			let fld = table.querySelector('.dataRow input[name=""]');
			if (fld) {
				fld.name = 'name';
				fld.value = 'U' + Math.floor(performance.now() * 10000000000000); // Assign unique name
			}

			let newRow = document.createElement('tbody');
			newRow.innerHTML = table.querySelector('.dataRow').innerHTML;
			newRow.querySelectorAll('[form=json]').forEach(el => {
				el.setAttribute('form', table.getAttribute('form'));
				el.classList.add('JSONData');
			});

			table.querySelector('tfoot').insertAdjacentElement('beforeBegin', newRow);
			if (table.classList.contains('sortable'))
				sortableBody(table.querySelector('tfoot').previousElementSibling);
			event.stopPropagation();

			if (table.querySelector(".dataRow").hasAttribute('onload'))
				eval(table.querySelector(".dataRow").getAttribute('onload'));
		}
		else if (action.contains('deleteRow') && (event.ctrlKey ||
			confirm((window.navigator.userLanguage || window.navigator.language) === 'it' ? 'Sicuri di voler eliminare la riga?' : 'Are you sure you want to delete the row?'))) {
			event.target.closest('tbody').remove();
			if (table.querySelector('.dataRow').onchange)
				table.querySelector('.dataRow').onchange(table);
			form.JSONStringify(event, table);
			event.stopPropagation();
		}
		else if (action.contains('newColumn')) {
			form.newColumn(table);
			event.stopPropagation();
		}
		else if (action.contains('deleteColumn') && (event.ctrlKey ||
			confirm((window.navigator.userLanguage || window.navigator.language) === 'it' ? 'Sicuri di voler eliminare la colonna?' : 'Are you sure you want to delete the column?'))) {
			let rows = table.querySelectorAll('thead>tr, tbody>tr'),
				col = event.target.closest('th').cellIndex;

			if (rows[0].childElementCount == 2)
				table.querySelector('tbody').innerHTML = '';
			else
				for (let r = 0; r < rows.length; ++r)
					rows[r].removeChild(rows[r].children[col]);

			let data = JSON.parse(form.jsonField.value || '{}');
			if (data[table.getAttribute('name')]) {
				data[table.getAttribute('name')].splice(col - 1, 1);
				form.jsonField.value = JSON.stringify(data);
				form.jsonField.dispatchEvent(new Event('input'));
			}
			form.JSONStringify(event);
			event.stopPropagation();
		}
	});
	form.formatText = event => {
		let sel = window.getSelection();
		if (event.target.dataset.format && sel && sel.rangeCount) {
			let range = sel.getRangeAt(0);

			let el = document.createElement(event.target.dataset.format);
			el.innerHTML = range;
			el.setAttribute('title', Date().toLocaleString());

			range.deleteContents();
			range.insertNode(el);
		} else if (event.target.dataset.action == 'expand' && document.activeElement.hasAttribute('contenteditable')) {
			form.zoom(event, document.activeElement);
			return;
		}
		event.preventDefault();
		event.stopPropagation();
	}
}

/*
** Author: Giancarlo Trevisan
** Date: 2025/03/24
** Description: Handle a list of texts in one or two languages 
** Usage: <kv-pair name="options"></kv-pair>
*/
class kvPair extends HTMLElement {
	static observedAttributes = ['src', 'pair', 'labels'];

	constructor() {
		super();

		this.addEventListener('click', this.#sync);
		this.addEventListener('keydown', this.#sync);
		this.addEventListener('focusout', this.#sync);
		this.addEventListener('focusin', this.#sync);

		this.innerHTML =
			'<menu role="list" data-bit="0"><label></label></menu>' +
			'<menu role="list" data-bit="1"><label></label></menu>' +
			`<input type="hidden" name="${this.getAttribute('name') || 'kv-pair'}">`;
		this.removeAttribute('name');
		this.children[0].addEventListener('scroll', this.#sync);
		this.children[0].addEventListener('scrollend', this.#sync);
		this.children[1].addEventListener('scroll', this.#sync);
		this.children[1].addEventListener('scrollend', this.#sync);
	}

	async #fetchData(src) {
		return await fetch(src)
			.then(res => res.json())
			.then(data => data)
			.catch(() => ["", ""]);
	}

	async attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue == newValue)
			return;

		if (name == 'pair') {
			this.setAttribute('pair', newValue == 'true' ? 'true' : 'false');
			this.children[1].style.display = newValue == 'true' ? '' : 'none';
			return;
		}
		if (name == 'labels') {
			this.children[0].querySelector('label').innerText = newValue.split(',')[0];
			this.children[1].querySelector('label').innerText = newValue.split(',')[1];
			return;
		}

		const options = newValue[0] == '[' ? JSON.parse(newValue) : await this.#fetchData(newValue);

		const a = (options[0] || '').split(','), b = (options[1] || '').split(',');
		const maxLength = Math.max(a.length, b.length);
		while (a.length < maxLength)
			a.push('');
		while (b.length < maxLength)
			b.push('');

		const labels = this.getAttribute('labels')?.split(',') || ["", ""];
		this.children[0].innerHTML = `<label>${labels[0] ? labels[0] : ''} ↻</label>` + a.map(value => `<div role="listitem" contenteditable>${value}</div>`).join('');
		this.children[1].innerHTML = `<label>${labels[1] ? labels[1] : ''}</label>` + b.map(value => `<div role="listitem" contenteditable>${value}</div>`).join('');

		if (!options[1])
			this.children[1].style.display = 'none';

		this.#save();
	}

	#sync(event) {
		const sort = event.type === 'click' && !event.target.previousElementSibling;

		if (event.key) {
			if (['Enter', ',', 'Tab', 'ArrowDown', 'ArrowUp'].indexOf(event.key) == -1)
				return;
			event.preventDefault();
		}

		if (event.type == 'focusin' || (event.type == 'focusout' && event.relatedTarget == null)) {
			this.querySelectorAll('.selected').forEach(el => el.className = '');
			return;
		}

		let option = event.relatedTarget || event.target;
		if (!(event.type == 'scroll' || event.type == 'scrollend') && option.tagName == 'MENU') {
			option = option.lastChild;
			option.focus();
		}

		const menu = option.closest('menu') || this.querySelector('menu');
		const pairedMenu = this.closest('kv-pair').querySelector(`menu[data-bit="${menu.dataset.bit == '0' ? '1' : '0'}"]`);
		if (event.type == 'scroll' || event.type == 'scrollend') {
			pairedMenu.scrollTop = menu.scrollTop;
			return;
		}

		this.querySelectorAll('.selected').forEach(el => el.className = '');

		let i = 0;
		for (; option.previousElementSibling; option = option.previousElementSibling, ++i);

		switch (event.key) {
			// deno-lint-ignore no-fallthrough
			case 'ArrowDown':
				i = i < menu.children.length - 1 ? i + 2 : 2;
			case 'ArrowUp':
				i = i > 1 ? i - 1 : menu.children.length - 1;
				this.#select(menu.children[i]);
				pairedMenu.children[i].className = 'selected';
				break;
			case 'Tab':
				this.#select(pairedMenu.children[i]);
				pairedMenu.children[i].className = '';
				menu.children[i].className = 'selected';
				break;
			case 'Enter':
				menu.insertAdjacentHTML('beforeend', '<div role="listitem" contenteditable></div>');
				pairedMenu.insertAdjacentHTML('beforeend', '<div role="listitem" contenteditable></div>');

				i = menu.children.length - 1;
				this.#select(menu.children[i]);
				pairedMenu.children[i].className = 'selected';
				break;
			default:
				if (i && i < pairedMenu.children.length)
					pairedMenu.children[i].className = 'selected';
		}
		this.#save(sort);

		pairedMenu.scrollTop = menu.scrollTop;
	}
	#select(el) {
		el.focus();
		const sel = document.getSelection();
		const range = document.createRange();
		range.selectNodeContents(el);
		sel.removeAllRanges();
		sel.addRange(range);
	}

	#sortPairs(pairArr) {
		const a = pairArr[0].split(',');
		const b = pairArr[1].split(',');
		const seen = new Set();
		const pairs = [];
		for (let i = 0; i < a.length; i++) {
			if (!seen.has(a[i])) {
				pairs.push([a[i], b[i]]);
				seen.add(a[i]);
			}
		}
		const isNumeric = !/[^0-9.,]/.test(pairArr[0]);
		pairs.sort((x, y) =>
			isNumeric
				? Number(x[0]) - Number(y[0])
				: x[0].localeCompare(y[0])
		);
		const sortedA = pairs.map(pair => pair[0]).join(',');
		const sortedB = pairs.map(pair => pair[1]).join(',');
		return [sortedA, sortedB];
	}

	#save(sort = false) {
		const pairs = [
			[...this.children[0].querySelectorAll('[role="listitem"]')].map(div => div.innerText.trim().replaceAll('\n', '')).join(',').replace(/,+$/g, ''),
			[...this.children[1].querySelectorAll('[role="listitem"]')].map(div => div.innerText.trim().replaceAll('\n', '')).join(',').replace(/,+$/g, '')
		];

		if (sort) {
			this.children[2].value = JSON.stringify(this.#sortPairs(pairs));
			this.attributeChangedCallback('', '', this.children[2].value);
		} else
			this.children[2].value = JSON.stringify(pairs);
	}
}
customElements.define('kv-pair', kvPair);

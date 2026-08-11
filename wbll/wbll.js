// deno-lint-ignore prefer-const
export let HTML = '', FldIndex = 0, FormFields = 0, Settings = new Map(), Attributes = new Map(), Index;

class RootSymbol {
	tagName = '';
	params = [];
	attrs = new Map();

	constructor(attrs, tagName = '') {
		this.tagName = tagName;
		if (this instanceof RootSymbol && attrs)
			for (const pair of attrs.matchAll(/([A-Za-z0-9:\-.]+)(?:="([^"]*)")?/g)) {
				const [, key, value] = pair;
				this.attrs.set(key, value ?? true);
			}
	}
	valueOf() {
		return this.toString();
	}
	toString() {
		const htmlAttrs = [...this.attrs.entries()]
			.map(([key, value]) => value === true ? key : `${key}="${value}"`)
			.join(' ');
		return `<${this.tagName} ${htmlAttrs}>`;
	};
	$() {
		HTML += this.toString();
	}
}
class BaseSymbol extends RootSymbol {
	text = '';

	constructor(params, tagName = '') {
		super(params, tagName);
		this.attrs.clear();
		let c, quoted = false, param = '';
		for (c of params) {
			if (c === '"') quoted = !quoted;
			else if (c === ';' && !quoted) this.params.push(param), param = '';
			else param += c;
		}
		this.params.push(param.trim());
	}
	$a(attrs) {
		if (!this.tagName)
			this.tagName = 'span';
		for (const pair of attrs.matchAll(/([A-Za-z0-9:\-.]+)(?:="([^"]*)")?/g)) {
			const [, key, value] = pair;
			this.attrs.set(key, value ?? true);
		}
		return this;
	}
	toString() {
		if (!this.tagName) return this.text;

		const htmlAttrs = [...this.attrs.entries()]
			.map(([key, value]) => value === true ? key : `${key}="${value}"`)
			.join(' ');
		return `<${this.tagName} ${htmlAttrs}>${this.text}</${this.tagName}>`;
	};
}
class TextSymbol extends BaseSymbol {
	constructor(params, tagName = '') {
		super(params);
		this.tagName = tagName;
		this.text = params;
	}
}
class AnchorSymbol extends BaseSymbol {
	url;
	constructor(params, tagName = 'a') {
		super(params, tagName);
		try { this.url = new URL(this.params[0]); } catch { this.url = new URL('about:blank'); }
		this.text = this.params[0];
	}
	p(params) {
		const search = `${params};;`.split(';');
		this.url.searchParams.set(search[0], search[1]);
		this.attrs.set('href', this.url.toString());
		return this;
	}
	t(params) {
		this.text = params;
		return this;
	}
}
class FormSymbol extends BaseSymbol {
	constructor(params, tagName = 'input') {
		super(params, tagName);
		if (!this.attrs.has('type') && this.params[0])
			this.attrs.set('type', this.params[0]);
		if (!this.attrs.has('id'))
			this.attrs.set('id', `Fld${FormFields++}`);
		if (!this.attrs.has('name'))
			this.attrs.set('name', this.params[1] || `Fld${FormFields}`);
		if (!this.attrs.has('value') && this.params[2])
			this.attrs.set('value', this.params[2]);
	}
}
class ButtonSymbol extends FormSymbol {
	constructor(params, tagName = 'button') {
		super(params, tagName);
		try { this.url = new URL(this.params[0]); } catch { this.url = new URL('about:blank'); }
		this.attrs.set('formaction', this.url.toString());
		this.text = this.params[1];
	}
	p(params) {
		const search = `${params};;`.split(';');
		this.url.searchParams.set(search[0], search[1]);
		this.attrs.set('formaction', this.url.toString());
		return this;
	}
}
class ChoiceSymbol extends FormSymbol {
	constructor(params, tagName = 'checkbox') {
		super(params, tagName);
	}
	toString() {
		const mode = [, '1', '2'].indexOf(this.params[3]);

		if (mode != -1) {
			let fragment = `<input type="hidden" id="${this.attrs.get('id')}" name="${this.attrs.get('name')}" value="${this.attrs.get('value')}">`;

			if (this.tagName == 'checkbox') {
				fragment = `<div class="stwChoices">`;
				for (let i = 4; i < this.params.length; i += mode)
					fragment += `<label><input form type="checkbox" name="${this.attrs.get('name')}" value="${mode == 1 ? 1 << (i - 4) : this.params[i]}"> ${this.params[i + mode - 1]}</label>`;
				fragment += '</div>';

			} else if (this.tagName == 'radio') {
				fragment = `<div class="stwChoices">`;
				for (let i = 4; i < this.params.length; i += mode)
					fragment += `<label><input form type="radio"" name="${this.attrs.get('name')}" value="${this.params[i]}"> ${this.params[i + mode - 1]}</label>`;
				fragment += '</div>';

			} else if (this.tagName === 'select') {
				const htmlAttrs = [...this.attrs.entries()]
					.map(([key, value]) => value === true ? key : `${key}="${value}"`)
					.join(' ');
				fragment = `<select ${htmlAttrs}>`;
				if (this.attrs.has('data-blank')) {
					fragment += '<option></option>';
					this.attrs.delete('data-blank');
				}
				for (let i = 4; i < this.params.length; i += mode)
					fragment += `<option value="${this.params[i]}">${this.params[i + mode - 1]}</option>`;
				fragment += '</select>';

			} else
				throw new SyntaxError();

			return fragment;
		}
	}
}
// TODO: fetch(url)
class EmbedSymbol extends BaseSymbol {
	constructor(params) {
		super(params);
		try { this.url = new URL(this.params[0]); } catch { this.url = new URL('about:blank'); }
		this.tagName = 'embed';
		this.attrs.set('src', this.url.toString());
		this.attrs.set('type', 'text/html');
		this.attrs.set('style', 'display:block; width: 100%; height: 100%')
	}
	p(params) {
		const search = `${params};;`.split(';');
		this.url.searchParams.set(search[0], search[1]);
		this.attrs.set('src', this.url.toString());
		return this;
	}
	async $() {
		const response = await fetch(this.url);
		HTML += await response.text();
	}
}

export function a(url, index) {
	Index = index;
	const symbol = new AnchorSymbol(url);
	return symbol;
}
export function A(url, index) {
	Index = index;
	const symbol = new AnchorSymbol(url);
	symbol.attrs.push('target="_blank"');
	return symbol;
}
export function b(params, index) {
	Index = index;
	const symbol = new ButtonSymbol(params);
	return symbol;
}
export function c(params, index) {
	Index = index;
	const symbol = new ChoiceSymbol(`;${params ?? ';;'}`); // Skip format
	symbol.attrs.set('type', 'checkbox');
	return symbol;
}
export function d(params, index) {
	Index = index;
	const symbol = new ChoiceSymbol(`;${params ?? ';;'}`, 'select'); // Skip format
	symbol.attrs.set('data-blank');
	return symbol;
}
export function D(params, index) {
	Index = index;
	const symbol = new ChoiceSymbol(`;${params ?? ';;'}`, 'select'); // Skip format
	return symbol;
}
export function e(params, index) {
	Index = index;
	const symbol = new FormSymbol(params);
	return symbol;
}
export function l(params, index) {
	Index = index;
	const symbol = new TextSymbol(params, 'label');
	symbol.attrs.set('for', `Fld${WBLL.FormFields}`);
	return symbol;
}
export function m(params, index) {
	Index = index;
	const symbol = new FormSymbol(`${params ?? ';'}`, 'textarea');
	symbol.attrs.delete('type');
	if (symbol.params[0])
		symbol.attrs.set('class', symbol.params[0]);
	return symbol;
}
export function o(params, index) {
	Index = index;
	const symbol = new EmbedSymbol(params);
	return symbol;
}
export function s(params, index) {
	Index = index;
	const symbol = new ChoiceSymbol(`;${params ?? ';;'}`, 'select'); // Skip format
	symbol.attrs.set('multiple');
	return symbol;
}
export function t(params, index) {
	Index = index;
	const symbol = new TextSymbol(params);
	return symbol;
}
export function w(params, index) {
	Index = index;
	const symbol = new FormSymbol(`;${params}`); // Skip format
	symbol.attrs.set('type', 'password');
	return symbol;
}
export function $s(params, index) {
	Index = index;
	Settings.set('rows', 25);
	for (const pair of params.matchAll(/([A-Za-z0-9:\-.]+)(?:="([^"]*)")?/g)) {
		const [, key, value] = pair;
		Settings.set(key, value ?? true);
	}
}
export function $A(params, index) {
	Index = index;
	for (const pair of params.matchAll(/([A-Za-z0-9:\-.]+)(?:="([^"]*)")?/g)) {
		const [, key, value] = pair;
		Attributes.set(key, value ?? true);
	}
}
export function $r(params, index) {
	Index = index;
	const symbol = new RootSymbol(params, 'br');
	return symbol;
}
export function $g(steps, index) {
	Index = index;
	FldIndex += steps;
}

export async function render(context = '', data = {}, wbll) {
	if (!globalThis.WBLL)
		globalThis.WBLL = await import('./wbll.js');

	const SYMBOLS = new RegExp(
		[
			/(\\[aAs])(?:\('([^]*?)'\))/,
			/(\\[nrt])(?:\('([^]*?)'\))?/,
			/(?:([aAcefhilLmopqruwxyz]))(?:\('([^]*?)'\))?/,
			/(?:([bdDnjJsStTvVk]))(?:\('([^]*?)'\))/,
			/\/\/.*$/,
			/\/\*[^]*\*\//,
			/(<+|>+)/,
			/(?<error>[\S])/, // Anything else is an error
		].map(r => r.source).join('|'),
		'gmu',
	);

	const code = [];
	for (const expression of wbll.matchAll(SYMBOLS)) {
		if (expression.groups?.error !== undefined)
			throw new SyntaxError(`<pre class="stwError">Syntax error:<br>${expression.input.slice(0, expression.index)}<i>⋙${expression.input.slice(expression.index)}</i></pre>`);

		const pattern = expression.filter((value, i) => (value !== undefined && i));
		if (pattern[0]) {
			if (['<', '>'].includes(pattern[0].at(0)))
				code.push(`$g(WBLL.${(pattern[0].at(0) === '<' ? -1 : 1) * pattern[0].length}, ${expression.index})`);
			else {
				const fragment = `${pattern[0].replace('\\', '$')}(${pattern[1] ? '"' + pattern[1].replace(/"/g, '\\"') + '"' : 'null'}, ${expression.index})`
				if (pattern[0].match(/(p|q|\\a)/) || (code.length && code[code.length - 1].match(/^[aA]/) && pattern[0].match(/^[defintxyz]/)))
					code[code.length - 1] = code[code.length - 1] + `.${fragment}`;
				else
					code.push('WBLL.' + fragment);
			}
		}
	}
	// TODO: WBPL based on the passed data
	for (let i = 0; i < code.length; ++i)
		code[i] = code[i].match(/\$(A|s|g)/) ? `${code[i]};` : `${code[i]}.$();`

	console.clear();
	console.debug(code.join(''));

	code.push('return context ? `<${context}>${WBLL.HTML}</${context}>` : WBLL.HTML;');

	HTML = '';
	const render = new Function('context', 'data', 'WBLL', code.join(''));
	try {
		return render(context, data, WBLL);
	} catch (_err) {
		const index = WBLL.Index ?? 0;
		throw new SyntaxError(`<pre class="stwError">Syntax error:<br>${wbll.slice(0, index)}<i>⋙${wbll.slice(index)}</i></pre>`);
	}
}
/*
// Choice auto-update listener
document.addEventListener("change", function (ev) {
  const input = ev.target;

  if (
	 input.type !== "checkbox" &&
	 !(input.tagName === "SELECT" && input.multiple)
  ) {
	 return;
  }

  const name = input.name;
  const hidden = document.getElementById("hidden_" + name);
  if (!hidden) return;

  const container =
	 document.getElementById("c_" + name) ||
	 document.getElementById("s_" + name) ||
	 document.getElementById("r_" + name);

  if (!container) return;

  const mode = container.dataset.mode;
  const values = [];

  const inputs = container.querySelectorAll(`[name="${name}"]`);

  inputs.forEach(i => {
	 const el = i;
	 if (el.checked) values.push(el.value);
  });

  if (mode === "1") {
	 let sum = 0;
	 values.forEach(v => sum += parseInt(v, 10));
	 hidden.value = String(sum);
  } else {
	 hidden.value = JSON.stringify(values);
  }
});
*/
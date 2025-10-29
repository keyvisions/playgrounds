// deno-lint-ignore-file
window.addEventListener('load', () => {
	document.querySelectorAll('input[type=selections]').forEach((input, i) => {
		input.setAttribute('type', 'text');

		const div = document.createElement('div');
		div.style.position = 'relative';
		div.style.display = 'inline-block';
		input.insertAdjacentElement('afterend', div);
		div.insertAdjacentElement('afterbegin', input);

		let options = '';
		input.values = [];
		input.getAttribute('list').split(';').forEach(opt => {
			if (opt)
				options += `<option>${opt}</option>`;
		});
		input.setAttribute('list', `kvSelections${i}`);
		input.insertAdjacentHTML('afterend', `
			<div style="position:absolute;top:2px;left:0.25rem;padding:${window.getComputedStyle(input).getPropertyValue('padding')};white-space:nowrap;font:${window.getComputedStyle(input).getPropertyValue('font')}"></div>
			<datalist id="kvSelections${i}">${options}</datalist>
		`);

		input.value.split(';').forEach(value => {
			if (!input.values.includes(input.value))
				input.values.push(value.trim());
		});
		input.value = input.values.join('; ');
		input.style.paddingLeft = input.nextElementSibling.clientWidth + 'px';

		input.addEventListener('focus', event => {
			event.target.value = '';
			event.target.nextElementSibling.innerText = input.values.join('; ');
		});
		input.addEventListener('keydown', event => {
			const input = event.target;
			if (event.key === ';') {
				event.preventDefault();
				input.dispatchEvent(new Event('change'));
			} else if (event.key === 'Backspace' && !input.value) {
				event.preventDefault();
				input.value = (input.values.pop() || ' ');
				input.nextElementSibling.innerText = input.values.join('; ') + (input.value.length > 0 ? '; ' : ' ');
				input.style.paddingLeft = input.nextElementSibling.clientWidth + 'px';
			}
		});
		input.addEventListener('change', event => {
			const input = event.target;
			const values = input.values;
			if (!values.includes(input.value))
				values.push(input.value.trim());
			input.values = values;
			input.value = '';

			input.nextElementSibling.innerText = input.values.join('; ') + '; ';
			input.style.paddingLeft = input.nextElementSibling.clientWidth + 'px';
		});
		input.addEventListener('blur', event => {
			event.target.style.padding = null;
			event.target.value = input.values.join('; ');
			event.target.nextElementSibling.innerText = '';
		});
	});
});

class WmsLocation extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	async connectedCallback() {
		const srcAttr = this.getAttribute('src');
		let structure = null;
		if (srcAttr && srcAttr.endsWith('.json')) {
			try {
				const resp = await fetch(srcAttr);
				structure = await resp.json();
			} catch (e) {
				structure = null;
			}
		}
		this.render(structure);
	}

	render(structure) {
		let html = `<style>
			.locations { display: flex; flex-wrap: wrap; gap: 2em; }
			.unit { border: 1px solid #aaa; padding: 0.5em; border-radius: 0.5em; }
			.unit-title { font-weight: bold; margin-bottom: 0.5em; }
			table { border-collapse: collapse; }
			td { border: 1px solid #ccc; padding: 0.3em 0.6em; text-align: center; font-family: monospace; }
		</style>`;
		html += '<div class="locations">';
		if (structure && Array.isArray(structure)) {
			// Cumulative index for units with same prefix
			const prefixIndex = {};
			for (const unit of structure) {
				const { layout, prefix, count, grid } = unit;
				const [rows, cols] = grid.split('x').map(Number);

				const startIdx = (prefixIndex[prefix] || 0) + 1;
				const endIdx = startIdx + count - 1;
				prefixIndex[prefix] = endIdx;

				for (let i = startIdx; i <= endIdx; ++i) {
					// For vertical: prefix, next 3 digits are column (offset by rack), last 2 are row
					if (layout === 'vertical') {
						const colOffset = (i - startIdx) * cols;
						const firstColNum = colOffset + 1;
						const unitLabel = `Vertical ${prefix}${String(firstColNum).padStart(3, '0')}`;
						html += `<div class=\"unit\"><div class=\"unit-title\">${unitLabel}</div><table>`;
						for (let r = rows; r >= 1; --r) {
							html += '<tr>';
							for (let c = 1; c <= cols; ++c) {
								const colNum = colOffset + c;
								const loc = `${prefix}${String(colNum).padStart(3, '0')}${String(r).padStart(2, '0')}`;
								html += `<td>${loc}</td>`;
							}
							html += '</tr>';
						}
						html += '</table></div>';

					}
					// prefix + drawer (2 digits) + column (3 digits) + row (2 digits)
					else if (layout === 'horizontal') {
						const unitLabel = `Horizontal ${prefix}${String(i).padStart(2, '0')}`;
						html += `<div class="unit"><div class="unit-title">${unitLabel}</div><table>`;
						for (let r = rows; r >= 1; --r) {
							html += '<tr>';
							for (let c = 1; c <= cols; ++c) {
								const loc = `${prefix}${String(i).padStart(2, '0')}${String(c).padStart(3, '0')}${String(r).padStart(2, '0')}`;
								html += `<td>${loc}</td>`;
							}
							html += '</tr>';
						}
						html += '</table></div>';
					}
				}
			}
		} else {
			html += '<div>No structure data provided.</div>';
		}
		html += '</div>';
		this.shadowRoot.innerHTML = html;
	}
}

customElements.define('wms-location', WmsLocation);

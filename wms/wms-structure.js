class WmsStructure extends HTMLElement {
	constructor() {
		super();
		this.classList.add("wms");
		this.storageUnits = [];
	}

	async connectedCallback() {
		const src = this.getAttribute('src');
		this.loadError = null;
		if (src) {
			try {
				const resp = await fetch(src);
				if (!resp.ok) throw new Error('Fetch failed');
				this.storageUnits = await resp.json();
				if (!Array.isArray(this.storageUnits)) {
					this.storageUnits = [this.storageUnits];
				}
			} catch (_e) {
				this.loadError = `Could not load ${src}`;
				this.storageUnits = [];
			}
		}
		this.render();
	}

	render() {
		this.innerHTML = `
		${this.loadError ? `<div class="warning">${this.loadError}</div>` : ''}
		<div class="editor">
			<h3><i class="fa-solid fa-warehouse"></i> Unità di Deposito [N. <span id="totalLU">${this.countLU()}</span>]</h3>
			<table id="storage-table">
			<thead>
				<tr><th></th><th>Disposizione</th><th>Prefisso</th><th>Elementi</th><th>Griglia</th><th><i class="fa-solid fa-plus add-btn" id="add-unit"></i></th></tr>
			</thead>
			<tbody>
				${(() => {
				// Show cumulative index for units with same prefix
				const prefixCounts = {};
				return this.storageUnits.map((u, idx) => {
					const prevCount = prefixCounts[u.prefix] || 0;
					prefixCounts[u.prefix] = prevCount + u.count;
					return `
						<tr>
							<td><i class="fa-solid fa-barcode unitlabels"></i></td>
						  <td>
							 <select data-idx="${idx}" class="unit-layout">
								<option value="vertical" ${u.layout === 'vertical' ? 'selected' : ''}>Vertical</option>
								<option value="horizontal" ${u.layout === 'horizontal' ? 'selected' : ''}>Horizontal</option>
							 </select>
						  </td>
						  <td contenteditable="true" data-idx="${idx}" class="unit-prefix">${u.prefix}</td>
						  <td contenteditable="true" data-idx="${idx}" class="unit-count">${u.count}</td>
							<td contenteditable="true" data-idx="${idx}" class="unit-grid">${u.grid || '1x1'}</td>
						  <td><i class="fa-solid fa-fw fa-trash remove-btn unit-remove" data-idx="${idx}"></i></td>
						</tr>
					 `;
				}).join('');
			})()}
			</tbody>
			</table>
			<div class="actions">
				<button type="button" id="save-json">Download JSON</button>
				<button type="button" id="generate-locations">Generate Locations</button>
			</div>
		</div>
	 `;
		this.setupEvents();
	}

	setupEvents() {
		// Storage Units table events
		this.querySelectorAll('.unit-layout').forEach(select => {
			select.onchange = () => {
				const idx = Number(select.getAttribute('data-idx'));
				this.storageUnits[idx].layout = select.value;
				this.render();
			};
		});
		this.querySelectorAll('.unit-prefix').forEach(cell => {
			cell.onblur = () => {
				const idx = Number(cell.getAttribute('data-idx'));
				this.storageUnits[idx].prefix = cell.textContent.trim();
			};
		});
		this.querySelectorAll('.unit-count').forEach(cell => {
			cell.onblur = () => {
				const idx = Number(cell.getAttribute('data-idx'));
				this.storageUnits[idx].count = parseInt(cell.textContent.trim(), 10);
				this.render();
			};
		});
		this.querySelectorAll('.unit-grid').forEach(cell => {
			cell.onblur = () => {
				const idx = Number(cell.getAttribute('data-idx'));
				this.storageUnits[idx].grid = cell.textContent.trim();
				this.render();
			};
		});
		this.querySelectorAll('.unit-remove').forEach(btn => {
			btn.onclick = () => {
				if (confirm(`Sicuri di voler eliminare l'unità di deposito?`)) {
					const idx = Number(btn.getAttribute('data-idx'));
					this.storageUnits.splice(idx, 1);
					this.render();
				}
			};
		});
		this.querySelector('#add-unit').onclick = () => {
			this.storageUnits.push({ layout: 'vertical', prefix: 'A01', count: 1, grid: '1x1' });
			this.render();
		};
		// Save storageUnits
		this.querySelector('#save-json').onclick = () => {
			const json = JSON.stringify(this.storageUnits, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'wms-structure.json';
			a.click();
			URL.revokeObjectURL(url);
		};
		// Generate Locations
		this.querySelector('#generate-locations').onclick = () => {
			const locations = this.generateLocations();
			const json = JSON.stringify(locations, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'locations.json';
			a.click();
			URL.revokeObjectURL(url);
		};
	}

	countLU() {
		let total = 0;
		(this.storageUnits || []).forEach(unit => {
			const { count, grid } = unit;
			const [rows, cols] = (grid || '').split('x').map(Number);
			total += count * rows * cols;
		});
		return total;
	}

	// Generate exhaustive locations from structure
	generateLocations() {
		const locations = {};
		// Cumulative index for units with same prefix
		const prefixIndex = {};
		(this.storageUnits || []).forEach(unit => {
			const { layout, prefix, count, grid } = unit;
			const [rows, cols] = (grid || '').split('x').map(Number);

			const startIdx = (prefixIndex[prefix] || 0) + 1;
			const endIdx = startIdx + count - 1;
			prefixIndex[prefix] = endIdx;

			for (let i = startIdx; i <= endIdx; ++i) {
				if (layout === 'vertical') {
					const colOffset = (i - startIdx) * cols;
					for (let r = rows; r >= 1; --r) {
						for (let c = 1; c <= cols; ++c) {
							// prefix + column (3 digits offset by rack) + row (2 digits)
							const colNum = colOffset + c;
							const loc = `${prefix}${String(colNum).padStart(3, '0')}${String(r).padStart(2, '0')}`;
							locations[loc] = 0;
						}
					}
				}
				else if (layout === 'horizontal') {
					for (let r = rows; r >= 1; --r) {
						for (let c = 1; c <= cols; ++c) {
							// prefix + drawer (2 digits) + column (3 digits) + row (2 digits)
							const loc = `${prefix}${String(i).padStart(2, '0')}${String(c).padStart(3, '0')}${String(r).padStart(2, '0')}`;
							locations[loc] = 0;
						}
					}
				}
			}
		});
		return locations;
	}
}

customElements.define('wms-structure', WmsStructure);

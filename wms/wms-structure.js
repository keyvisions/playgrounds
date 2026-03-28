// deno-lint-ignore-file no-window
class WMSStructure extends HTMLElement {
	constructor() {
		super();
		this.classList.add("wms");
		this.storageUnits = [];
	}

	async connectedCallback() {
		if (this.hasAttribute("onprint")) {
			const fnName = this.getAttribute("onprint").replace(/\(.*\)/, "").trim();
			if (typeof window[fnName] === "function") {
				this.onprint = window[fnName];
			}
		}

		const value = this.textContent;
		this.loadError = null;
		if (value) {
			try {
				let parsed;
				try {
					parsed = JSON.parse(value);
					this.storageUnits = Array.isArray(parsed) ? parsed : [parsed];
				} catch (_err) {
					const resp = await fetch(value);
					if (!resp.ok) throw new Error('Fetch failed');
					this.storageUnits = await resp.json();
					if (!Array.isArray(this.storageUnits)) {
						this.storageUnits = [this.storageUnits];
					}
				}
			} catch (_e) {
				this.loadError = `Could not load ${value}`;
			}
		} else
			throw new Error(`Error loading wms-structure.`);

		this.#render();

		if (this.hasAttribute("name"))
			this.querySelector('input[type="hidden"]').value = JSON.stringify(this.storageUnits);
	}

	#render() {
		const edit = this.hasAttribute("name");

		this.innerHTML = `
		${this.loadError ? `<div class="warning">${this.loadError}</div>` : ''}
		${this.hasAttribute("name") ? `<input type="hidden" name="${this.getAttribute("name")}">` : ""}
		<table class="editor" id="storage-table">
		<thead>
			<tr><th></th><th>Prefisso</th><th>Unità</th><th>Griglia</th><th>Rif.</th><th>${edit ? '<i class="fa-solid fa-plus add-btn" id="add-unit"></i>' : ''}</th></tr>
		</thead>
		<tbody>
			${(() => {
				const prefixCounts = {};
				return this.storageUnits.map((u, idx) => {
					const prevCount = prefixCounts[u.prefix] || 0;
					prefixCounts[u.prefix] = prevCount + u.count;

					u.offset = prevCount;
					return `
					<tr data-offset="${u.offset}" style="text-align:center">
						<td data-idx="${idx}" class="unit-labels"><i class="fa-solid fa-barcode"></i></td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-prefix">${u.prefix}</td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-count">${u.count}</td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-grid">${u.grid || '1x1'}</td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-ref">${u.ref || ''}</td>
						<td>${edit ? `<i class="fa-solid fa-fw fa-trash remove-btn unit-remove" data-idx="${idx}"></i>` : ''}</td>
					</tr>
					`;
				}).join('');
			})()}
		</tbody>
		</table>
		<footer style="font-size:smaller; padding:0.5rem 0" title="Unità di deposito"></footer>`;
		this.#setupEvents(edit);

		this.countBins();
	}

	#setupEvents(edit) {
		this.querySelectorAll('.unit-labels').forEach(barcode => {
			if (this.onprint)
				barcode.onclick = () => {
					const idx = Number(barcode.getAttribute('data-idx'));
					this.onprint(this.storageUnits[idx]);
				}
		});

		this.addEventListener('click', (event) => {
			const map = document.querySelector(`#${this.getAttribute("refmap")}`);
			if (map) {
				const tr = event.target.closest('tr');
				this.querySelector('.selected')?.classList.remove('selected');
				tr.classList.add('selected');
				map.setAttribute('highlight', `location=${tr.querySelector('.unit-prefix').textContent + tr.querySelector('.unit-ref').textContent}`);
			}
		});

		if (edit) {
			this.querySelectorAll('.unit-prefix').forEach(cell => {
				cell.addEventListener('input', () => {
					const idx = Number(cell.getAttribute('data-idx'));
					cell.textContent = cell.textContent.replace(/\W/g, "");
					this.storageUnits[idx].prefix = cell.textContent;
					this.countBins();
				});
			});
			this.querySelectorAll('.unit-count').forEach(cell => {
				cell.addEventListener('input', () => {
					const idx = Number(cell.getAttribute('data-idx'));
					cell.textContent = cell.textContent.replace(/\W/g, "");
					this.storageUnits[idx].count = parseInt(cell.textContent, 10);
					this.countBins();
				});
			});
			this.querySelectorAll('.unit-grid').forEach(cell => {
				cell.addEventListener('input', () => {
					const idx = Number(cell.getAttribute('data-idx'));
					cell.textContent = cell.textContent.replace(/\W/g, "");
					this.storageUnits[idx].grid = cell.textContent;
					this.countBins();
				});
			});
			this.querySelectorAll('.unit-ref').forEach(cell => {
				cell.addEventListener('input', () => {
					const idx = Number(cell.getAttribute('data-idx'));
					cell.textContent = cell.textContent.replace(/\W/g, "");
					this.storageUnits[idx].ref = parseInt(cell.textContent, 10);
					this.countBins();
				});
			});
			this.querySelectorAll('.unit-remove').forEach(btn => {
				btn.onclick = () => {
					if (confirm(`Sicuri di voler eliminare l'unità di deposito?`)) {
						const idx = Number(btn.getAttribute('data-idx'));
						this.storageUnits.splice(idx, 1);
						this.#render();
					}
				};
			});
			this.querySelector('#add-unit').onclick = () => {
				this.storageUnits.push({ prefix: '', count: 1, grid: '1x1' });
				this.#render();
			};
		}
	}

	countBins() {
		let total = 0;
		(this.storageUnits || []).forEach(unit => {
			const { count, grid } = unit;
			const [rows, cols] = (grid || '').split('x').map(Number);
			total += count * rows * cols;
		});

		this.querySelector('footer').textContent = `Ubicazioni totali: ${total}`;

		if (this.getAttribute("name"))
			this.querySelector('input[type="hidden"]').value = JSON.stringify(this.storageUnits);

		return total;
	}
}

customElements.define('wms-structure', WMSStructure);

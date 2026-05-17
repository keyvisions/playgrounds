// deno-lint-ignore-file no-window
class WMSStructure extends HTMLElement {
	#lang = "en";
	#translations = {
		load_error: { it: "Impossibile caricare {value}", en: "Could not load {value}", fr: "Impossible de charger {value}" },
		empty_error: { it: "Errore caricamento wms-structure.", en: "Error loading wms-structure.", fr: "Erreur de chargement wms-structure." },
		head_prefix: { it: "Prefisso", en: "Prefix", fr: "Prefixe" },
		head_units: { it: "Unita", en: "Units", fr: "Unites" },
		head_grid: { it: "Griglia", en: "Grid", fr: "Grille" },
		head_ref: { it: "Rif.", en: "Ref.", fr: "Ref." },
		title_print_labels: { it: "Stampa etichette", en: "Print labels", fr: "Imprimer etiquettes" },
		title_delete_bin: { it: "Elimina UdD", en: "Delete location", fr: "Supprimer emplacement" },
		title_storage_units: { it: "Unita di deposito", en: "Storage units", fr: "Unites de stockage" },
		confirm_delete_bin: {
			it: "Sicuri di voler eliminare l'unita di deposito?",
			en: "Are you sure you want to delete this storage unit?",
			fr: "Voulez-vous vraiment supprimer cette unite de stockage ?"
		},
		footer_total_locations: { it: "Ubicazioni totali: {total}", en: "Total locations: {total}", fr: "Total emplacements : {total}" }
	};

	constructor() {
		super();
		this.classList.add("wms");
		this.storageUnits = [];
	}

	#normalizeLang(rawLang, fallback = "en") {
		const normalized = String(rawLang || "").trim().toLowerCase();
		if (!normalized) return fallback;
		if (normalized.startsWith("it")) return "it";
		if (normalized.startsWith("en")) return "en";
		if (normalized.startsWith("fr")) return "fr";
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

	#t(key, params = null) {
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
				this.loadError = this.#t("load_error", { value });
			}
		} else
			throw new Error(this.#t("empty_error"));

		this.#render();

		if (this.hasAttribute("name"))
			this.querySelector('input[type="hidden"]').value = JSON.stringify(this.storageUnits);
	}

	#render() {
		const edit = this.hasAttribute("name");

		this.innerHTML = `
		${this.loadError ? `<div class="warning">${this.loadError}</div>` : ''}
		${this.hasAttribute("name") ? `<input type="hidden" name="${this.getAttribute("name")}">` : ""}
		<table class="editor" id="storage-table" style="width:100%">
		<thead>
			<tr><th></th><th>${this.#t("head_prefix")}</th><th>${this.#t("head_units")}</th><th>${this.#t("head_grid")}</th><th>${this.#t("head_ref")}</th><th>${edit ? '<i class="fa-solid fa-plus add-btn" id="add-unit"></i>' : ''}</th></tr>
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
						<td data-idx="${idx}" class="unit-labels" title="${this.#t("title_print_labels")}"><i class="fa-solid fa-barcode"></i></td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-prefix">${u.prefix}</td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-count">${u.count}</td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-grid">${u.grid || '1x1'}</td>
						<td contenteditable="${edit}" data-idx="${idx}" class="unit-ref">${u.ref || ''}</td>
						<td title="${this.#t("title_delete_bin")}">${edit ? `<i class="fa-solid fa-fw fa-trash remove-btn unit-remove" data-idx="${idx}"></i>` : ''}</td>
					</tr>
					`;
				}).join('');
			})()}
		</tbody>
		</table>
		<footer style="font-size:smaller; padding:0.5rem 0" title="${this.#t("title_storage_units")}"></footer>`;
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
			if (map && event.target.closest('tr')) {
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
					if (confirm(this.#t("confirm_delete_bin"))) {
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

		this.querySelector('footer').textContent = this.#t("footer_total_locations", { total });

		if (this.getAttribute("name"))
			this.querySelector('input[type="hidden"]').value = JSON.stringify(this.storageUnits);

		return total;
	}
}

customElements.define('wms-structure', WMSStructure);

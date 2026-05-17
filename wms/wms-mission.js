// deno-lint-ignore-file no-window
class WMSMission extends HTMLElement {
	#missionData = { state: "working", notes: "", items: [] };
	#translations = {
		state_working: { it: "in lavorazione", en: "working", fr: "en cours" },
		state_confirmed: { it: "confermata", en: "confirmed", fr: "confirmee" },
		state_picking: { it: "in prelievo", en: "picking", fr: "en prelevement" },
		state_closed: { it: "chiusa", en: "closed", fr: "cloturee" },
		mission_title: { it: "Missione", en: "Mission", fr: "Mission" },
		notes_label: { it: "Note", en: "Notes", fr: "Notes" },
		notes_placeholder: { it: "Istruzioni per magazzino...", en: "Warehouse instructions...", fr: "Instructions entrepot..." },
		scan_initial: { it: "Scansiona UdC", en: "Scan LU", fr: "Scannez UL" },
		head_partnumber: { it: "Part Number", en: "Part Number", fr: "Reference" },
		head_docinfo: { it: "Num. Doc<br>Data Doc", en: "Doc No.<br>Doc Date", fr: "Num. Doc<br>Date Doc" },
		head_requested: { it: "Richiesti", en: "Requested", fr: "Demandes" },
		head_available: { it: "Disponibili", en: "Available", fr: "Disponibles" },
		head_pick: { it: "Preleva", en: "Pick", fr: "Prelever" },
		head_picked: { it: "Prelevati", en: "Picked", fr: "Preleves" },
		head_delivery_date: { it: "Data<br>consegna", en: "Delivery<br>date", fr: "Date<br>livraison" },
		btn_reopen: { it: "Riapri missione", en: "Reopen mission", fr: "Rouvrir mission" },
		rows_empty: { it: "Nessuna riga missione", en: "No mission rows", fr: "Aucune ligne de mission" },
		lu_none: { it: "Nessun prelievo", en: "No picks", fr: "Aucun prelevement" },
		lu_tooltip_item: { it: "{lu}: prelevato {qty}{left}", en: "{lu}: picked {qty}{left}", fr: "{lu}: preleve {qty}{left}" },
		lu_left_suffix: { it: ", residuo {leftQty}", en: ", left {leftQty}", fr: ", reste {leftQty}" },
		lu_tag: { it: "{lu} (prel {qty}{left})", en: "{lu} (pick {qty}{left})", fr: "{lu} (prel {qty}{left})" },
		stock_none: { it: "Nessuna quantita", en: "No quantity", fr: "Aucune quantite" },
		stock_sufficient: { it: "Quantita sufficiente", en: "Sufficient quantity", fr: "Quantite suffisante" },
		stock_some: { it: "Quantita parziale", en: "Some quantity", fr: "Quantite partielle" },
		next_confirm: { it: "Conferma missione", en: "Confirm mission", fr: "Confirmer mission" },
		next_picking: { it: "Inizia picking", en: "Start picking", fr: "Commencer prelevement" },
		next_close: { it: "Chiudi missione", en: "Close mission", fr: "Fermer mission" },
		scan_move_to_picking: { it: "Porta la missione in stato prelievo per scansionare UdC", en: "Move mission to picking state to scan LU", fr: "Passez la mission en prelevement pour scanner UL" },
		scan_picker_hint: { it: "Scansiona UdC usando il picker sotto", en: "Scan LU using the picker below", fr: "Scannez UL avec le picker ci-dessous" },
		scan_ready: { it: "Pronto per scansione UdC", en: "Ready to scan LU", fr: "Pret a scanner UL" },
		row_not_found: { it: "Nessuna riga missione per partnumber {partnumber}", en: "No mission row for partnumber {partnumber}", fr: "Aucune ligne mission pour partnumber {partnumber}" },
		scan_match_ok: { it: "UdC associata a {partnumber}. Conferma prelevato e residuo reale.", en: "LU matched to {partnumber}. Confirm picked and actual left quantity.", fr: "UL associee a {partnumber}. Confirmez preleve et reste reel." },
		picked_qty_gt_zero: { it: "La quantita prelevata deve essere maggiore di zero", en: "Picked quantity must be greater than zero", fr: "La quantite prelevee doit etre superieure a zero" },
		scan_saved: { it: "Prelievo salvato per UdC {lu}", en: "Saved pick for LU {lu}", fr: "Prelevement enregistre pour UL {lu}" }
	};
	#lang = "en";
	#baseAvailableByPart = new Map();
	#tbody;
	#stateBadge;
	#nextBtn;
	#reopenBtn;
	#notesInput;
	#missionPick;
	#scanStatus;
	#onchange;
	#onconfirm;
	#outputInput;
	#isApplyingExternalUpdate = false;
	#activeRowIndex = -1;
	#pendingScan = null;

	constructor() {
		super();
		this.classList.add("wms", "wms-mission");
	}

	static get observedAttributes() {
		return ["state", "refmap", "lang"];
	}

	async connectedCallback() {
		this.#onchange = this.#resolveHandler("onchange");
		this.#onconfirm = this.#resolveHandler("onconfirm");
		this.#ensureOutputInput();
		this.#loadTranslations();

		this.#missionData = this.#normalizeMission(await this.#loadInitialMission());
		this.#initializeBaseAvailability();
		this.#recomputeAvailability();
		if (this.hasAttribute("state")) {
			this.#missionData.state = this.#normalizeState(this.getAttribute("state"));
		} else {
			this.setAttribute("state", this.#missionData.state);
		}

		this.#render();
		this.#bindEvents();
		this.#bindOutputInput();
		this.#syncOutput(true);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		if (name === "lang") {
			if (!this.isConnected) return;
			this.#loadTranslations();
			this.#render();
			this.#bindEvents();
			this.#syncOutput();
			return;
		}

		if (name === "state") {
			if (!this.#stateBadge) return;
			this.#missionData.state = this.#normalizeState(newValue);
			this.#updateStateUI();
			this.#syncOutput();
			return;
		}

		if (name === "refmap") {
			this.#applyRefmap();
		}
	}

	get value() {
		return JSON.stringify(this.#missionData);
	}

	get data() {
		return JSON.parse(JSON.stringify(this.#missionData));
	}

	set data(value) {
		this.#missionData = this.#normalizeMission(value);
		this.#initializeBaseAvailability();
		this.#recomputeAvailability();
		this.setAttribute("state", this.#missionData.state);
		this.#renderRows();
		this.#updateStateUI();
		this.#syncOutput();
	}

	#resolveHandler(attr) {
		if (!this.hasAttribute(attr)) return null;
		const fnName = this.getAttribute(attr).replace(/\(.*\)/, "").trim();
		if (typeof window[fnName] === "function") return window[fnName];
		return null;
	}

	#ensureOutputInput() {
		let inputId = this.getAttribute("for") || "";
		if (!inputId) {
			inputId = this.id ? `${this.id}-data` : "wms-mission-data";
			this.setAttribute("for", inputId);
		}

		let output = document.getElementById(inputId);
		if (!output) {
			output = document.createElement("input");
			output.id = inputId;
			output.type = "hidden";
			document.body.appendChild(output);
		}

		if (!output.name) {
			output.name = inputId;
		}

		this.#outputInput = output;
	}

	#bindOutputInput() {
		if (!this.#outputInput || this.#outputInput.dataset.wmsMissionBound === "1") return;
		const onInputUpdate = () => this.#applyInputValue(this.#outputInput.value);
		this.#outputInput.addEventListener("input", onInputUpdate);
		this.#outputInput.addEventListener("change", onInputUpdate);
		this.#outputInput.dataset.wmsMissionBound = "1";
	}

	#applyInputValue(rawValue) {
		if (this.#isApplyingExternalUpdate) return;
		if (!rawValue) return;

		let parsed;
		try {
			parsed = JSON.parse(rawValue);
		} catch (_err) {
			return;
		}

		const normalized = this.#normalizeMission(parsed);
		if (JSON.stringify(normalized) === JSON.stringify(this.#missionData)) return;

		this.#isApplyingExternalUpdate = true;
		try {
			this.#missionData = normalized;
			this.#initializeBaseAvailability();
			this.#recomputeAvailability();
			this.setAttribute("state", this.#missionData.state);
			if (this.#notesInput) this.#notesInput.value = this.#missionData.notes || "";
			this.#renderRows();
			this.#updateStateUI();
			this.#syncOutput();
		} finally {
			this.#isApplyingExternalUpdate = false;
		}
	}

	#normalizeState(state) {
		const normalized = String(state || "").toLowerCase();
		return ["working", "confirmed", "picking", "closed"].includes(normalized)
			? normalized
			: "working";
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
		const hasComponentLang = this.hasAttribute("lang");
		const componentLang = hasComponentLang ? this.getAttribute("lang") : "";
		const domLang = this.#findNearestLangInDom();
		this.#lang = hasComponentLang
			? this.#normalizeLang(componentLang, "en")
			: this.#normalizeLang(domLang, "en");
	}

	#t(key, params = null) {
		const value = this.#translations[key];
		let text = "";
		if (value && typeof value === "object" && !Array.isArray(value)) {
			text = value[this.#lang] || value.it || value.en || Object.values(value)[0] || key;
		} else if (typeof value === "string") {
			text = value;
		} else {
			text = key;
		}

		if (!params) return text;
		return text.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? ""));
	}

	#escapeHtml(value) {
		return String(value)
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#39;");
	}

	#normalizeLUPicks(raw) {
		const parseEntry = entry => {
			if (!entry) return null;
			if (typeof entry === "string") {
				const [rawLU, rawQty] = entry.split(/[:=]/, 2);
				const lu = String(rawLU || "").trim();
				const qty = Math.max(0, this.#toInt(rawQty, 0));
				if (!lu || qty <= 0) return null;
				return { lu, qty, leftQty: 0 };
			}

			if (typeof entry !== "object") return null;
			const lu = String(entry.lu || entry.luId || entry.code || entry.id || "").trim();
			const qty = Math.max(0, this.#toInt(entry.qty ?? entry.quantity ?? entry.pickedQty, 0));
			const leftQty = Math.max(0, this.#toInt(entry.leftQty ?? entry.remainingQty ?? entry.luLeftQty, 0));
			if (!lu || qty <= 0) return null;
			return { lu, qty, leftQty };
		};

		if (Array.isArray(raw)) {
			return raw.map(parseEntry).filter(Boolean);
		}

		if (typeof raw === "string") {
			return raw
				.split(",")
				.map(value => value.trim())
				.filter(Boolean)
				.map(parseEntry)
				.filter(Boolean);
		}

		return [];
	}

	#formatLUPicks(luPicks) {
		if (!Array.isArray(luPicks) || !luPicks.length) return "";
		return luPicks.map(entry => `${entry.lu}:${entry.qty}`).join(", ");
	}

	#renderLUPicksIndicator(luPicks) {
		if (!Array.isArray(luPicks) || !luPicks.length) {
			return `<span class="mission-lu-empty">${this.#escapeHtml(this.#t("lu_none"))}</span>`;
		}

		const tooltip = luPicks
			.map(entry => {
				const left = entry.leftQty > 0 ? this.#t("lu_left_suffix", { leftQty: entry.leftQty }) : "";
				return this.#t("lu_tooltip_item", { lu: this.#escapeHtml(entry.lu), qty: entry.qty, left });
			})
			.join(" | ");

		return luPicks
			.map(entry => {
				const left = Math.max(0, this.#toInt(entry.leftQty, 0));
				const suffix = left > 0 ? this.#t("lu_left_suffix", { leftQty: left }) : "";
				const text = this.#t("lu_tag", { lu: this.#escapeHtml(entry.lu), qty: entry.qty, left: suffix });
				return `<span class="mission-lu-tag" title="${tooltip}">${text}</span>`;
			})
			.join("");
	}

	#limitLUPicks(luPicks, maxTotal) {
		let remaining = Math.max(0, this.#toInt(maxTotal, 0));
		return this.#normalizeLUPicks(luPicks)
			.map(entry => {
				const qty = Math.min(entry.qty, remaining);
				remaining -= qty;
				return { lu: entry.lu, qty, leftQty: Math.max(0, this.#toInt(entry.leftQty, 0)) };
			})
			.filter(entry => entry.qty > 0);
	}

	#setScanStatus(message, type = "info") {
		if (!this.#scanStatus) return;
		this.#scanStatus.textContent = message || "";
		this.#scanStatus.className = `mission-scan-status ${type}`;
	}

	#findRowIndexByPartnumber(partnumber) {
		const normalized = String(partnumber || "").trim().toUpperCase();
		if (!normalized) return -1;

		const exact = this.#missionData.items.findIndex(item => String(item.partnumber || "").toUpperCase() === normalized && item.pickQty > item.pickedQty);
		if (exact >= 0) return exact;

		return this.#missionData.items.findIndex(item => String(item.partnumber || "").toUpperCase() === normalized);
	}

	#setActiveRow(index) {
		this.#activeRowIndex = index;
		if (!this.#tbody) return;
		Array.from(this.#tbody.children).forEach((row, i) => {
			row.classList.toggle("mission-row-active", i === index);
		});
	}

	#updateRowVisibility() {
		if (!this.#tbody) return;
		const shouldFilterRows = ["confirmed", "picking", "closed"].includes(this.#missionData.state);
		this.#missionData.items.forEach((item, index) => {
			const row = this.#tbody.children[index];
			if (!row) return;
			row.style.display = shouldFilterRows && item.pickQty <= 0 ? "none" : "";
		});
	}

	#toInt(value, fallback = 0) {
		const number = Number.parseInt(value, 10);
		return Number.isFinite(number) ? number : fallback;
	}

	#normalizeItem(item = {}) {
		const partnumber = item.partnumber || item.partNumber || item.code || "";
		const description = item.description || "";
		const docId = item.docId || "";
		const docNum = item.docNum || docId;
		const docRow = this.#toInt(item.docRow, 0);
		const docDate = item.docDate || "";
		const deliveryDate = item.deliveryDate || "";
		const requestedQty = Math.max(0, this.#toInt(item.requestedQty ?? item.requestedQuantity ?? item.requested ?? item.qtyRequested, 0));
		const availableQty = Math.max(0, this.#toInt(item.availableQty ?? item.availableQuantity ?? item.available ?? item.qtyAvailable, 0));
		const pickQty = Math.max(0, Math.min(availableQty, this.#toInt(item.pickQty ?? item.quantityToPick ?? item.quantity, 0)));
		const luPicks = this.#normalizeLUPicks(item.luPicks ?? item.pickedLUs ?? item.pickLUs);
		const pickedQty = luPicks.reduce((sum, entry) => sum + entry.qty, 0);

		return { ...item, partnumber, description, docId, docNum, docRow, docDate, deliveryDate, requestedQty, availableQty, pickQty, pickedQty, luPicks };
	}

	#sumPickedByPart() {
		const pickedByPart = new Map();
		this.#missionData.items.forEach(item => {
			const key = item.partnumber || "";
			pickedByPart.set(key, (pickedByPart.get(key) || 0) + item.pickedQty);
		});
		return pickedByPart;
	}

	#initializeBaseAvailability() {
		const pickedByPart = this.#sumPickedByPart();

		this.#baseAvailableByPart.clear();
		this.#missionData.items.forEach(item => {
			const key = item.partnumber || "";
			const candidateBase = item.availableQty + (pickedByPart.get(key) || 0);
			const current = this.#baseAvailableByPart.get(key) || 0;
			if (candidateBase > current)
				this.#baseAvailableByPart.set(key, candidateBase);
		});
	}

	#recomputeAvailability() {
		const pickedByPart = this.#sumPickedByPart();

		this.#missionData.items.forEach(item => {
			const key = item.partnumber || "";
			const base = this.#baseAvailableByPart.get(key) || 0;
			const remaining = Math.max(0, base - (pickedByPart.get(key) || 0));
			item.availableQty = remaining;
		});
	}

	#getMaxPickForRow(rowIndex) {
		const row = this.#missionData.items[rowIndex];
		if (!row) return 0;

		const key = row.partnumber || "";
		const base = this.#baseAvailableByPart.get(key) || 0;
		const pickedByPart = this.#sumPickedByPart();
		const othersPicked = (pickedByPart.get(key) || 0) - row.pickedQty;
		return Math.max(0, base - othersPicked);
	}

	#stockStatus(item) {
		if (item.availableQty <= 0)
			return { className: "none", title: this.#t("stock_none") };
		if (item.availableQty >= item.requestedQty)
			return { className: "sufficient", title: this.#t("stock_sufficient") };
		return { className: "some", title: this.#t("stock_some") };
	}

	#normalizeMission(rawMission) {
		const fallback = { state: "working", notes: "", items: [] };
		if (!rawMission) return fallback;

		if (Array.isArray(rawMission)) {
			return {
				state: this.#normalizeState(this.getAttribute("state") || "working"),
				notes: "",
				items: rawMission.map(item => this.#normalizeItem(item))
			};
		}

		if (typeof rawMission !== "object") return fallback;

		const items = rawMission.items || rawMission.lines || rawMission.mission || rawMission.data || [];
		return {
			state: this.#normalizeState(rawMission.state || this.getAttribute("state") || "working"),
			notes: String(rawMission.notes || rawMission.note || ""),
			items: Array.isArray(items) ? items.map(item => this.#normalizeItem(item)) : []
		};
	}

	async #loadInitialMission() {
		this.#ensureOutputInput();
		const fromInput = this.#outputInput?.value || "";
		const fromBody = this.textContent.trim();
		const source = fromInput || fromBody;

		if (!source)
			return { state: this.getAttribute("state") || "working", items: [] };

		try {
			return JSON.parse(source);
		} catch (_err) {
			if (/^\.?\/?[^\n]+\.json(?:\?.*)?$/i.test(source)) {
				try {
					const response = await fetch(source);
					if (response.ok)
						return await response.json();
				} catch (_fetchErr) {
					// Keep fallback behavior when source path cannot be loaded.
				}
			}

			return { state: this.getAttribute("state") || "working", items: [] };
		}
	}

	#setState(state) {
		const normalized = this.#normalizeState(state);
		if (this.getAttribute("state") === normalized) return;
		this.setAttribute("state", normalized);
	}

	#hasPickableRows() {
		return this.#missionData.items && this.#missionData.items.some(item => item.pickQty > 0);
	}

	#getPickablePartnumbers() {
		if (!this.#missionData.items) return [];
		return this.#missionData.items
			.filter(item => item.pickQty > 0)
			.map(item => item.partnumber)
			.filter((v, i, a) => a.indexOf(v) === i);
	}

	#highlightPickLocations() {
		const partnumbers = this.#getPickablePartnumbers();
		const refmap = (this.getAttribute("refmap") || "").trim();
		let mapElement = refmap ? document.getElementById(refmap) : null;
		if (!refmap) {
			mapElement = document.querySelector("wms-map");
		}

		if (!mapElement) return;

		if (partnumbers.length === 0) {
			mapElement.removeAttribute("highlight");
			return;
		}

		const query = partnumbers.map(p => `partnumber=${encodeURIComponent(p)}`).join("&");
		mapElement.setAttribute("highlight", query);
	}

	#applyRefmap() {
		if (!this.#missionPick) return;

		let refmap = (this.getAttribute("refmap") || "").trim();
		let mapElement = refmap ? document.getElementById(refmap) : null;

		if (!refmap) {
			mapElement = document.querySelector("wms-map");
			if (mapElement) {
				if (!mapElement.id) {
					let fallbackId = "wms-mission-map";
					let index = 1;
					while (document.getElementById(fallbackId)) {
						fallbackId = `wms-mission-map-${index++}`;
					}
					mapElement.id = fallbackId;
				}
				refmap = mapElement.id;
			}
		}

		if (refmap) {
			this.#missionPick.setAttribute("refmap", refmap);
			(mapElement || document.getElementById(refmap))?.setAttribute("mode", "pick");
			return;
		}

		this.#missionPick.removeAttribute("refmap");
	}

	#render() {
		this.innerHTML = `
			<div class="mission-head">
				<strong>${this.#t("mission_title")}</strong>
				<span class="mission-state" data-role="state"></span>
			</div>
			<label class="mission-notes">
				<span>${this.#t("notes_label")}</span>
				<textarea data-role="missionNotes" rows="3" placeholder="${this.#t("notes_placeholder")}"></textarea>
			</label>
			<div class="mission-scan">
				<span class="mission-scan-status info" data-role="scanStatus">${this.#t("scan_initial")}</span>
				<wms-pick data-role="missionPick" oncheck="verifyCode()"></wms-pick>
			</div>
			<table>
				<thead>
					<tr>
						<th style="width:1em"></th>
						<th class="col-partnumber">${this.#t("head_partnumber")}</th>
						<th data-role="col-docinfo">${this.#t("head_docinfo")}</th>
						<th data-role="col-requested">${this.#t("head_requested")}</th>
						<th>${this.#t("head_available")}</th>
						<th>${this.#t("head_pick")}</th>
						<th class="col-lu-picks">${this.#t("head_picked")}</th>
						<th data-role="col-deliverydate">${this.#t("head_delivery_date")}</th>
					</tr>
				</thead>
				<tbody></tbody>
			</table>
			<div class="mission-actions">
				<button type="button" data-role="next"></button>
				<button type="button" data-role="reopen">${this.#t("btn_reopen")}</button>
			</div>
		`;

		this.#tbody = this.querySelector("tbody");
		this.#stateBadge = this.querySelector('[data-role="state"]');
		this.#nextBtn = this.querySelector('[data-role="next"]');
		this.#reopenBtn = this.querySelector('[data-role="reopen"]');
		this.#notesInput = this.querySelector('[data-role="missionNotes"]');
		this.#missionPick = this.querySelector('[data-role="missionPick"]');
		this.#scanStatus = this.querySelector('[data-role="scanStatus"]');
		this.#applyRefmap();
		if (this.#notesInput) this.#notesInput.value = this.#missionData.notes || "";

		this.#renderRows();
		this.#updateStateUI();
		this.#setScanStatus(this.#t("scan_ready"), "info");
	}

	#renderRows() {
		if (!this.#tbody) return;

		if (!this.#missionData.items.length) {
			this.#tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; font-style:italic">${this.#t("rows_empty")}</td></tr>`;
			return;
		}

		this.#tbody.innerHTML = this.#missionData.items.map((item, index) => `
			<tr data-docid="${item.docId}" data-docrow="${item.docRow}" data-partnumber="${item.partnumber}" data-index="${index}">
				<td data-role="status"></td>
				<td class="col-partnumber">${item.partnumber}<br><small>${item.description || ""}</small></td>
				<td data-role="col-docinfo">${item.docNum}<br><small>${item.docDate}</small></td>
				<td data-role="col-requested">${item.requestedQty.toLocaleString()}</td>
				<td data-role="available">${item.availableQty.toLocaleString()}</td>
				<td>
					<input type="number" name="pickQty" data-index="${index}" min="0" max="${this.#getMaxPickForRow(index)}" value="${item.pickQty}">
				</td>
				<td class="col-lu-picks">
					<div data-role="luPicksIndicator">${this.#renderLUPicksIndicator(item.luPicks)}</div>
				</td>
				<td data-role="col-deliverydate"><small>${item.deliveryDate}</small></td>
			</tr>
		`).join("");

		this.#refreshRowsUI();
		this.#bindRowEvents();
		this.#setActiveRow(this.#activeRowIndex);
	}

	#refreshRowsUI() {
		this.#missionData.items.forEach((item, index) => {
			const row = this.#tbody.children[index];
			if (!row) return;

			const availableCell = row.querySelector('[data-role="available"]');
			const input = row.querySelector('input[name="pickQty"]');
			const luInput = row.querySelector('input[name="luPicks"]');
			const luIndicator = row.querySelector('[data-role="luPicksIndicator"]');
			const statusCell = row.querySelector('[data-role="status"]');
			const status = this.#stockStatus(item);

			if (availableCell)
				availableCell.textContent = item.availableQty.toLocaleString();

			if (input) {
				input.max = this.#getMaxPickForRow(index);
				input.value = item.pickQty;
			}

			if (luInput)
				luInput.value = this.#formatLUPicks(item.luPicks);

			if (luIndicator)
				luIndicator.innerHTML = this.#renderLUPicksIndicator(item.luPicks);

			if (statusCell) {
				statusCell.innerHTML = `<i class="fa-solid fa-square mission-stock ${status.className}" title="${status.title}"></i>`;
			}
		});
		this.#updateRowVisibility();
	}

	#updateStateUI() {
		const state = this.#missionData.state;
		const stateLabelByState = {
			working: this.#t("state_working"),
			confirmed: this.#t("state_confirmed"),
			picking: this.#t("state_picking"),
			closed: this.#t("state_closed")
		};
		this.#stateBadge.textContent = stateLabelByState[state] || state;
		this.#stateBadge.className = `mission-state ${state}`;

		const nextByState = {
			working: { label: this.#t("next_confirm"), next: "confirmed" },
			confirmed: { label: this.#t("next_picking"), next: "picking" },
			picking: { label: this.#t("next_close"), next: "closed" },
			closed: null
		};
		const nextAction = nextByState[state];
		if (nextAction) {
			this.#nextBtn.style.display = "";
			this.#nextBtn.textContent = nextAction.label;
			this.#nextBtn.dataset.nextState = nextAction.next;
			const isNoRowsInConfirm = state === "working" && !this.#hasPickableRows();
			this.#nextBtn.disabled = isNoRowsInConfirm;
		} else {
			this.#nextBtn.style.display = "none";
			this.#nextBtn.removeAttribute("data-next-state");
		}

		this.#reopenBtn.style.display = state === "working" ? "none" : "";

		const canEditPick = state === "working" || state === "confirmed";
		const canEditLUPicks = false;
		const canScan = state === "picking";
		const showLUPicks = state === "picking";
		const scanPanel = this.querySelector('.mission-scan');
		if (scanPanel) scanPanel.style.display = canScan ? "grid" : "none";
		if (this.#missionPick) this.#missionPick.hidden = !canScan;
		this.querySelectorAll('.col-lu-picks').forEach(cell => {
			cell.style.display = showLUPicks ? "" : "none";
		});
		this.querySelectorAll('[data-role="col-docinfo"]').forEach(cell => {
			cell.style.display = canScan ? "none" : "";
		});
		this.querySelectorAll('[data-role="col-requested"]').forEach(cell => {
			cell.style.display = canScan ? "none" : "";
		});
		this.querySelectorAll('[data-role="col-deliverydate"]').forEach(cell => {
			cell.style.display = canScan ? "none" : "";
		});
		const notesInput = this.querySelector('[data-role="missionNotes"]');
		if (notesInput) notesInput.disabled = canScan;
		this.querySelectorAll('input[name="pickQty"]').forEach(input => input.disabled = !canEditPick);
		this.querySelectorAll('input[name="luPicks"]').forEach(input => input.disabled = !canEditLUPicks);
		this.#updateRowVisibility();
		this.#bindRowEvents();
		if (!canScan) {
			this.#setActiveRow(-1);
			this.#setScanStatus(this.#t("scan_move_to_picking"), "warning");
		} else if (this.#missionPick) {
			this.#setScanStatus(this.#t("scan_picker_hint"), "info");
			this.#highlightPickLocations();
		}
	}

	#bindRowEvents() {
		if (!this.#tbody) return;
		const canSelectForMap = this.#missionData.state === "picking";
		Array.from(this.#tbody.querySelectorAll('tr')).forEach(row => {
			row.style.cursor = canSelectForMap ? "pointer" : "default";
			if (canSelectForMap) {
				row.addEventListener("click", event => {
					if (event.target.tagName === "INPUT") return;
					const partnumber = row.dataset.partnumber;
					const index = this.#toInt(row.dataset.index, -1);
					if (partnumber && index >= 0) {
						const isCurrentlyActive = this.#activeRowIndex === index;
						if (isCurrentlyActive) {
							this.#setActiveRow(-1);
							this.#highlightPickLocations();
						} else {
							this.#setActiveRow(index);
							const refmap = (this.getAttribute("refmap") || "").trim();
							let mapElement = refmap ? document.getElementById(refmap) : null;
							if (!refmap) {
								mapElement = document.querySelector("wms-map");
							}
							if (mapElement) {
								mapElement.setAttribute("highlight", `partnumber=${encodeURIComponent(partnumber)}`);
							}
						}
						this.dispatchEvent(new CustomEvent("warehousemap-highlight", {
							detail: { partnumber, rowIndex: index },
							bubbles: true
						}));
					}
				});
			}
		});
	}

	#bindEvents() {
		this.#notesInput?.addEventListener("input", event => {
			this.#missionData.notes = event.target.value;
			this.#syncOutput();
		});

		this.#tbody.addEventListener("input", event => {
			if (event.target.name === "pickQty") {
				this.#updatePickQty(event.target);
			}
		});

		this.#missionPick?.addEventListener("wms-pick-check", event => {
			this.#handleMissionPickCheck(event.detail);
		});

		this.#missionPick?.addEventListener("wms-pick-submit", event => {
			this.#handleMissionPickSubmit(event.detail);
		});

		this.#nextBtn.addEventListener("click", () => {
			const nextState = this.#nextBtn.dataset.nextState;
			if (!nextState) return;

			if (nextState === "confirmed" && !this.#hasPickableRows()) {
				return;
			}

			this.#setState(nextState);

			if (nextState === "confirmed" && typeof this.#onconfirm === "function") {
				this.#onconfirm.call(this, this.data);
			}
		});

		this.#reopenBtn.addEventListener("click", () => {
			this.#setState("working");
		});
	}

	#handleMissionPickCheck(detail = {}) {
		if (this.#missionData.state !== "picking") return;
		const response = detail.response || {};
		const partnumber = response.partnumber || detail.partnumber || "";
		const rowIndex = this.#findRowIndexByPartnumber(partnumber);
		if (rowIndex < 0) {
			this.#setScanStatus(this.#t("row_not_found", { partnumber: partnumber || "(unknown)" }), "error");
			this.#setActiveRow(-1);
			return;
		}

		this.#pendingScan = {
			rowIndex,
			partnumber,
			lu: String(detail.lu || response.lu || detail.code || "").replace(/^0+/, ""),
			luQty: this.#toInt(response.quantity ?? response.qty ?? 0, 0)
		};
		this.#setActiveRow(rowIndex);
		this.#setScanStatus(this.#t("scan_match_ok", { partnumber }), "success");
	}

	#handleMissionPickSubmit(detail = {}) {
		if (this.#missionData.state !== "picking") return;
		const response = detail.response || {};
		const partnumber = response.partnumber || detail.partnumber || "";
		const rowIndex = this.#findRowIndexByPartnumber(partnumber);
		if (rowIndex < 0) {
			this.#setScanStatus(this.#t("row_not_found", { partnumber: partnumber || "(unknown)" }), "error");
			return;
		}

		const item = this.#missionData.items[rowIndex];
		if (!item) return;

		const lu = String(detail.lu || response.lu || "").replace(/^0+/, "");
		const pickedQty = Math.max(0, this.#toInt(detail.quantity, 0));
		const totalQty = Math.max(0, this.#toInt(response.quantity ?? detail.response?.quantity, 0));
		const leftQty = detail.leftQty !== undefined && detail.leftQty !== ""
			? Math.max(0, this.#toInt(detail.leftQty, 0))
			: Math.max(0, totalQty - pickedQty);

		if (!lu || pickedQty <= 0) {
			this.#setScanStatus(this.#t("picked_qty_gt_zero"), "warning");
			return;
		}

		const existing = item.luPicks.find(entry => entry.lu === lu);
		if (existing) {
			existing.qty = pickedQty;
			existing.leftQty = leftQty;
		} else {
			item.luPicks.push({ lu, qty: pickedQty, leftQty });
		}

		item.luPicks = this.#limitLUPicks(item.luPicks, this.#getMaxPickForRow(rowIndex));
		item.pickedQty = item.luPicks.reduce((sum, entry) => sum + entry.qty, 0);
		this.#pendingScan = null;
		this.#recomputeAvailability();
		this.#refreshRowsUI();
		this.#setActiveRow(rowIndex);
		this.#setScanStatus(this.#t("scan_saved", { lu }), "success");
		this.#syncOutput();

		const codeInput = this.#missionPick?.querySelector('input[name="code"]');
		const quantityInput = this.#missionPick?.querySelector('input[name="quantity"]');
		const leftInput = this.#missionPick?.querySelector('input[name="leftQuantity"]');
		if (codeInput) {
			codeInput.value = "";
			codeInput.classList.remove("successBox", "warningBox");
		}
		if (quantityInput) {
			quantityInput.value = "";
			quantityInput.classList.remove("successBox", "warningBox");
		}
		if (leftInput) leftInput.value = "";
		this.#missionPick?.querySelector('#sentiments')?.setAttribute('aria-disabled', 'true');
	}

	#updateLUPicks(input) {
		const rowIndex = this.#toInt(input.dataset.index, -1);
		if (rowIndex < 0 || rowIndex >= this.#missionData.items.length)
			return;

		const item = this.#missionData.items[rowIndex];
		const max = this.#getMaxPickForRow(rowIndex);
		item.luPicks = this.#limitLUPicks(input.value, max);
		item.pickedQty = item.luPicks.reduce((sum, entry) => sum + entry.qty, 0);

		this.#recomputeAvailability();
		this.#refreshRowsUI();
		this.#syncOutput();
	}

	#updatePickQty(input) {
		const rowIndex = this.#toInt(input.dataset.index, -1);
		if (rowIndex < 0 || rowIndex >= this.#missionData.items.length)
			return;

		const item = this.#missionData.items[rowIndex];
		const max = this.#getMaxPickForRow(rowIndex);
		const value = Math.max(0, Math.min(max, this.#toInt(input.value, 0)));

		item.pickQty = value;
		this.#refreshRowsUI();
		this.#updateStateUI();
		if (this.#missionData.state === "picking") {
			this.#highlightPickLocations();
		}
		this.#syncOutput();
	}

	#syncOutput(isInitial = false) {
		const payload = JSON.stringify(this.#missionData);
		this.#ensureOutputInput();
		if (this.#outputInput && !this.#isApplyingExternalUpdate)
			this.#outputInput.value = payload;

		const eventName = isInitial ? "missioninit" : "missionchange";
		this.dispatchEvent(new CustomEvent(eventName, {
			detail: this.data,
			bubbles: true
		}));

		if (!isInitial && typeof this.#onchange === "function") {
			this.#onchange.call(this, this.data);
		}
	}
}

customElements.define("wms-mission", WMSMission);

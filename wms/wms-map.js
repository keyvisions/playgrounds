// deno-lint-ignore-file
const StorageUnits = [
	{ name: "small", alias: "A", layout: "V", w: 3, h: 7, row: 5, cols: 6 },
	{ name: "small", alias: "A", layout: "V", w: 4, h: 7, row: 5, cols: 6 },
	{ name: "medium", alias: "B", layout: "V", w: 7, h: 17, row: 3, cols: 3 },
	{ name: "medium", alias: "B", layout: "V", w: 7, h: 18, row: 3, cols: 3 },
	{ name: "large", alias: "D", layout: "H", w: 19, h: 26 }
];

class WMSMap extends HTMLElement {
	#map
	#lang = "en";
	#translations = {
		map_sentiment_title: { it: "Ingombro UdC", en: "LU occupancy", fr: "Occupation UL" },
		su_dialog_title: { it: "Prima ubicazione", en: "First location", fr: "Premier emplacement" },
		su_position_label: { it: "Posizione", en: "Position", fr: "Position" },
		su_position_ltr: { it: "In basso a sinistra", en: "Bottom-left", fr: "En bas a gauche" },
		su_position_rtl: { it: "In basso a destra", en: "Bottom-right", fr: "En bas a droite" },
		su_label_label: { it: "Etichetta", en: "Label", fr: "Etiquette" },
		su_cancel: { it: "Annulla", en: "Cancel", fr: "Annuler" },
		su_ok: { it: "OK", en: "OK", fr: "OK" }
	};

	// viewBox state
	#Vx = 0; #Vy = 0; #Vw = 0; #Vh = 0;
	#vx = 0; #vy = 0; #vw = 0; #vh = 0;

	static get observedAttributes() {
		return ["map", "mode", "inventory", "highlight"];
	}

	constructor() {
		super();
		this.classList.add("wms");

		// pan state
		this._isPanning = false;
		this._didPan = false;
		this._startX = this._startY = this._startVx = this._startVy = 0;

		// pointer/touch gesture state
		this._pointers = new Map();
		this._pinch = null; // { dist, vw, vh }

		this._svgLoaded = false;
		this._sentiment = 1;

		if (this.innerHTML.trim().startsWith("<svg")) {
			const blob = new Blob([this.innerHTML.trim()], { type: "image/svg+xml" });
			this.#map = URL.createObjectURL(blob);
		} else
			this.#map = this.textContent.trim();

		// Extract lu, location, and partnumber from the URL query string and set highlight attribute as a query string
		try {
			const params = new URLSearchParams(window.location.search);
			const highlightParams = new URLSearchParams();
			["lu", "location", "partnumber"].forEach(key => {
				if (params.has(key)) highlightParams.set(key, params.get(key));
			});
			const highlightStr = highlightParams.toString();
			if (highlightStr) {
				this.setAttribute("highlight", highlightStr);
			}
		} catch (_err) {
			// Fail silently if URL parsing fails
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (!this._svgLoaded || oldValue === newValue) return;

		if (name === "map") {
			this.querySelector("object").data = newValue ?? "";
		}

		if (name === "mode") {
			if (this.querySelector("#sentiments"))
				this.querySelector("#sentiments").style.display = this.getAttribute("mode") === "pick" ? "none" : "flex";

			switch (newValue) {
				case "normalize":
					this.#setup();
				case "put":
					break;
				case "edit":
					break;
				default:
					this.setAttribute("mode", "pick");
			}
			this.#syncViewBox();
		}

		this.#highlight();
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

		if (!["pick", "put", "normalize"].includes(this.getAttribute("mode")))
			this.setAttribute("mode", "pick");

		this.innerHTML = `
			<div id="sentiments" style="display: flex; gap: 1em; padding: 0.5em; justify-content: center;">
				<div style="line-height:2em">${this.#t("map_sentiment_title")}</div> 
				<div id="S1" class="sentiment selected">1</div>
				<div id="S2" class="sentiment">2</div>
				<div id="S3" class="sentiment">3</div>
				<div id="S4" class="sentiment">4</div>
				<div id="S5" class="sentiment">5</div>
			</div>
			${this.getAttribute("name") ? `<input type="hidden" name="${this.getAttribute("name")}">` : ""}
			<object type="image/svg+xml" style="display: block; width: 100%; height: 100%; border: thin solid gray; box-sizing: border-box;" data="${this.getAttribute("map") || this.#map}"></object>
		`;

		this.querySelector("#sentiments").addEventListener("click", (event) => {
			const target = event.target;
			if (target.className === "sentiment") {
				this.querySelector("#sentiments .selected").classList.remove("selected");
				target.classList.add("selected");
				this._sentiment = parseInt(target.textContent);
				this.#highlight(true);
			}
		});

		this.querySelector("object").addEventListener("load", () => {
			if (this.#map.startsWith("blob:file"))
				URL.revokeObjectURL(this.#map);
			const hiddenInput = this.querySelector('input[type="hidden"]');
			if (hiddenInput) hiddenInput.value = this.#svg.outerHTML;

			if (this.getAttribute("mode") === "normalize")
				this.#setup();
			else if (this.getAttribute("mode") !== "put")
				this.firstElementChild.remove();

			this.#init();
			this._svgLoaded = true;
			this.#highlight();
		}, { once: true });

		this.onResize = () => this.#alignSVG();
		window.addEventListener("resize", this.onResize);
	}

	disconnectedCallback() {
		window.removeEventListener("resize", this.onResize);
	}

	get #svgDoc() {
		return this.querySelector("object")?.contentDocument ?? null;
	}

	get #svg() {
		return this.#svgDoc?.querySelector("svg") ?? null;
	}

	get SVG() {
		return this.querySelector(`#${this.constructor.name}`).value;
	}
	get SVGDocument() {
		return this.#svgDoc ?? null;
	}

	// The #setup method transforms a raw SVG into a structured format with <rect> elements for SUs and a clean viewBox.
	// In this case a DWG→SVG conversion with consistent path formats is assumed, but this can be adapted as needed.
	// https://anyconv.com/dwg-to-svg-converter/
	#setup() {
		const svgDoc = this.#svgDoc;
		if (!svgDoc) return;

		// Inject SVG styles
		svgDoc.querySelectorAll("style").forEach(s => s.remove());
		const style = svgDoc.createElement("style");
		style.textContent = `
			:host { color-scheme: inherit; }
			svg { background: Canvas; color: CanvasText; stroke: gray; }
			path { stroke-width: 0.25; stroke: gray; fill: Canvas; }
			.SU { stroke: CanvasText; fill: Canvas; stroke-width: 0.25; }
			.SU.selected { fill: Mark; }
			.SU.available { stroke: var(--special-backcolor, Highlight); stroke-width: 0.5; }
			.SU.unavailable { stroke: red; stroke-width: 0.5; }
		`;

		// Wrap SVG content in a <g> if needed (required for rotate transform)
		if (svgDoc.documentElement.firstElementChild?.tagName !== "g") {
			let inner = svgDoc.documentElement.innerHTML;
			inner = inner.replaceAll(/ xmlns="http:\/\/www.w3.org\/2000\/svg"/g, "");
			inner = inner.replaceAll(/<svg/g, `<svg xmlns="http://www.w3.org/2000/svg`);
			svgDoc.documentElement.innerHTML = `<g>${inner}</g>`;
		}
		svgDoc.documentElement.firstElementChild.insertAdjacentElement("afterbegin", style);

		const svg = this.#svg;

		// Convert matching paths → SU <rect> elements and compute bounding box
		let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
		let counts = new Map();
		svg.querySelectorAll("path").forEach(path => {
			const pts = path.getAttribute("d").split(/[ML ]/).map(parseFloat).filter(n => !isNaN(n));

			if (pts.length === 16) {
				const w = Math.abs(Math.round(pts[2] - pts[0]) || Math.abs(Math.round(pts[6] - pts[4])));
				const h = Math.abs(parseInt(pts[3] - pts[1]) || Math.abs(parseInt(pts[7] - pts[5])));

				counts.set(`${w}x${h}`, (counts.get(`${w}x${h}`) || 0) + 1);

				for (const unit of StorageUnits) {
					if (w * h === unit.w * unit.h) {
						path.insertAdjacentHTML("afterend",
							`<rect class="SU ${unit.name}" x="${pts[0]}" y="${pts[1]}" width="${w}" height="${h}"><title></title></rect>`);
						path.remove();
						break;
					}
				}
			} else if (pts.length > 16 || pts.some((v, i) => i % 2 === 0 && v > 234)) { // pts.length > 16
				path.remove();
			} else {
				for (let i = 0; i < pts.length; i += 2) {
					if (pts[i] < xmin) xmin = pts[i];
					if (pts[i] > xmax) xmax = pts[i];
					if (pts[i + 1] < ymin) ymin = pts[i + 1];
					if (pts[i + 1] > ymax) ymax = pts[i + 1];
				}
			}
		});
		console.log('rect sizes and frequency:\n', counts);

		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		svg.setAttribute("viewBox",
			`${Math.floor(xmin) - 5} ${Math.floor(ymin) - 5} ${Math.ceil(xmax - xmin) + 10} ${Math.ceil(ymax - ymin) + 10}`);

		svg.querySelector('g>title')?.remove();
		svg.querySelector('g>desc')?.remove();

		// Clean up
		svg.querySelectorAll("*:not(rect)[id]").forEach(element => element.removeAttribute("id"));

		svg.querySelectorAll("rect.SU").forEach(SU => {
			if (!SU.getAttribute("dir"))
				SU.setAttribute("dir", "ltr");
			if (!SU.querySelector("title"))
				SU.insertAdjacentHTML("afterbegin", `<title></title>`);
			const type = StorageUnits.find(unit => SU.classList.contains(unit.name));
			if (type?.layout === "vertical")
				SU.querySelector("title").textContent = SU.id;
		});

		this.#emitSVGChange();

		this.setAttribute("mode", "edit");
	}

	#lastSU(selectedSU) {
		let SU = this.#svg.querySelector(".lastEdit");

		let SUId = SU?.id.match(/^([A-Z]\d{2}) (\d{3}) (\d{2})$/) || selectedSU?.id.match(/^([A-Z]\d{2}) (\d{3}) (\d{2})$/) || [null, null, null];
		if (SU) {
			SU.classList.remove("lastEdit");
		} else {
			if (!selectedSU.id) {
				for (SU of this.#svg.querySelectorAll(".SU[id]")) {
					SU = SU.id.match(/^([A-Z]\d{2}) (\d{3}) (\d{2})$/) || [null, null, null];
					if (!SUId[0] || SU[1] > SUId[1] || (SU[1] === SUId[1] && Number(SU[2]) > Number(SUId[2])))
						SUId = SU;
				}
			}

			if (SUId[1] == null) return "B01 001 01";
		}
		selectedSU.classList.add("lastEdit");

		let cols = StorageUnits.find(unit => selectedSU.classList.contains(unit.name)).cols;
		return `${SUId[1]} ${String(Number(SUId[2]) + cols).padStart(3, "0")} 01`;
	}

	#init() {
		const svg = this.#svg;
		if (!svg) return;

		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");

		this.#syncViewBox();

		if (!this._eventsAttached) {
			this.#attachSVGEvents(svg);
			this._eventsAttached = true;
		}

		this.#alignSVG(true);
	}

	#syncViewBox() {
		const svg = this.#svg;
		if (!svg) return;
		[this.#Vx, this.#Vy, this.#Vw, this.#Vh] = [
			svg.viewBox.baseVal.x, svg.viewBox.baseVal.y,
			svg.viewBox.baseVal.width, svg.viewBox.baseVal.height
		];
		[this.#vx, this.#vy, this.#vw, this.#vh] = [this.#Vx, this.#Vy, this.#Vw, this.#Vh];
	}

	#emitSVGChange() {
		const svg = this.#svg;
		if (!svg) return;
		const map = svg.outerHTML.replace(` xmlns=""`, "").replaceAll(/\s+/g, " ").trim();
		this.dispatchEvent(new CustomEvent("svgchange", { detail: map, bubbles: true }));

		const hiddenInput = this.querySelector('input[type="hidden"]');
		if (hiddenInput) hiddenInput.value = map;
	}

	#attachSVGEvents(svg) {
		// Prevent browser-native touch scrolling/zooming inside SVG area
		svg.style.touchAction = "none";

		svg.addEventListener("dblclick", async (event) => {
			this.#alignSVG(true);
		});

		svg.addEventListener("click", async event => {
			if (this._didPan || this._isPanning) {
				this._didPan = false;
				this._isPanning = false;
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			event.stopPropagation();
			let target = event.target;
			if (target?.tagName === "svg") {
				const hit = this.#svgDoc?.elementFromPoint?.(event.clientX, event.clientY);
				target = hit?.closest?.("rect.SU") ?? target;
			}
			if (target?.tagName === "rect" && target.classList.contains("SU")) {
				if (this.hasAttribute("name") && (event.ctrlKey && event.shiftKey)) {
					this.#editSU(target, true);
				} else if (this.hasAttribute("name") && event.ctrlKey) {
					this.#editSU(target);
				} else if (target.id) {
					const querystring = new URLSearchParams(this.getAttribute("highlight"));

					const url = new URL(this.getAttribute("inventory"));
					url.searchParams.set("details", 1);
					url.searchParams.set("location", target.id.replaceAll(' ', ''));
					url.searchParams.set("lu", querystring.get("lu") || "");
					url.searchParams.set("partnumber", querystring.get("partnumber") || "");

					const response = await fetch(url);
					const storageUnit = await response.json() || [];

					let storageUnitComponent = document.body.querySelector("wms-storage-unit");
					if (!storageUnitComponent) {
						storageUnitComponent = document.createElement("wms-storage-unit");
						document.body.appendChild(storageUnitComponent);
					}
					storageUnitComponent.showDialog(storageUnit, this._sentiment, target.getAttribute("dir") ?? "ltr");
				}
			} else if (event.target.tagName === "DIALOG" && event.target.open) {
				event.target.close();
			}
		});

		svg.addEventListener("wheel", event => {
			//			if (this.hasAttribute("name")) return;
			this._isPanning = false;
			event.preventDefault();

			const scaleFactor = 1.1;
			const rect = svg.getBoundingClientRect();
			const mx = ((event.clientX - rect.left) / rect.width) * this.#vw + this.#vx;
			const my = ((event.clientY - rect.top) / rect.height) * this.#vh + this.#vy;
			const k = event.deltaY < 0 ? 1 / scaleFactor : scaleFactor;
			const newW = this.#vw * k;
			const newH = this.#vh * k;
			this.#vx = mx - (mx - this.#vx) * (newW / this.#vw);
			this.#vy = my - (my - this.#vy) * (newH / this.#vh);
			this.#vw = newW;
			this.#vh = newH;
			svg.setAttribute("viewBox", `${this.#vx} ${this.#vy} ${this.#vw} ${this.#vh}`);
		}, { passive: false });

		svg.addEventListener("pointerdown", event => {
			//			if (this.hasAttribute("name")) return;

			this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

			if (this._pointers.size === 1) {
				// one-finger pan start
				this._isPanning = true;
				this._startX = event.clientX;
				this._startY = event.clientY;
				this._startVx = this.#vx;
				this._startVy = this.#vy;
				this._pinch = null;
			} else if (this._pointers.size === 2) {
				// pinch start
				this._isPanning = false;
				const [a, b] = [...this._pointers.values()];
				const dx = b.x - a.x, dy = b.y - a.y;
				const midX = (a.x + b.x) / 2;
				const midY = (a.y + b.y) / 2;
				const rect = svg.getBoundingClientRect();
				this._pinch = {
					dist: Math.hypot(dx, dy),
					vx: this.#vx,
					vy: this.#vy,
					vw: this.#vw,
					vh: this.#vh,
					cx: ((midX - rect.left) / rect.width) * this.#vw + this.#vx,
					cy: ((midY - rect.top) / rect.height) * this.#vh + this.#vy,
				};
			}
		});

		svg.addEventListener("pointermove", event => {
			//			if (this.hasAttribute("name")) return;
			if (!this._pointers.has(event.pointerId)) return;

			this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

			if (this._pointers.size === 2 && this._pinch) {
				// pinch-to-zoom anchored to initial SVG point under finger midpoint
				const [a, b] = [...this._pointers.values()];
				const dx = b.x - a.x, dy = b.y - a.y;
				const dist = Math.max(1, Math.hypot(dx, dy));
				const zoom = this._pinch.dist / dist;
				const newW = this._pinch.vw * zoom;
				const newH = this._pinch.vh * zoom;

				const rect = svg.getBoundingClientRect();
				const midX = (a.x + b.x) / 2;
				const midY = (a.y + b.y) / 2;

				this.#vw = newW;
				this.#vh = newH;
				this.#vx = this._pinch.cx - ((midX - rect.left) / rect.width) * newW;
				this.#vy = this._pinch.cy - ((midY - rect.top) / rect.height) * newH;
				svg.setAttribute("viewBox", `${this.#vx} ${this.#vy} ${this.#vw} ${this.#vh}`);
				return;
			}

			if (this._pointers.size === 1 && this._isPanning) {
				// one-finger pan
				if (Math.abs(event.clientX - this._startX) > 3 || Math.abs(event.clientY - this._startY) > 3)
					this._didPan = true;
				const rect = svg.getBoundingClientRect();
				const dxPan = (event.clientX - this._startX) * (this.#vw / rect.width);
				const dyPan = (event.clientY - this._startY) * (this.#vh / rect.height);
				this.#vx = this._startVx - dxPan;
				this.#vy = this._startVy - dyPan;
				svg.setAttribute("viewBox", `${this.#vx} ${this.#vy} ${this.#vw} ${this.#vh}`);
			}
		});

		const endPointer = event => {
			this._pointers.delete(event.pointerId);
			if (this._pointers.size < 2) this._pinch = null;
			if (this._pointers.size === 0) this._isPanning = false;
		};

		svg.addEventListener("pointerup", endPointer);
		svg.addEventListener("pointercancel", endPointer);
		svg.addEventListener("pointerleave", endPointer);
	}

	#alignSVG(reset = false) {
		const svg = this.#svg;
		if (!svg) return;

		const g = svg.querySelector("g");

		if (reset) {
			// Restore to natural portrait viewBox and clear rotation
			svg.setAttribute("viewBox", `${this.#Vx} ${this.#Vy} ${this.#Vw} ${this.#Vh}`);
			g?.removeAttribute("transform");
		}

		// Read transform state AFTER reset (so hasTransform reflects current reality)
		const landscape = window.innerWidth > window.innerHeight;
		const hasTransform = g?.getAttribute("transform") !== null;

		if (landscape && !hasTransform) {
			// Portrait → Landscape: swap w/h and rotate content
			const [x, y, w, h] = svg.getAttribute("viewBox").split(" ").map(Number);
			svg.setAttribute("viewBox", `${x} ${y} ${h} ${w}`);
			g?.setAttribute("transform", `rotate(90) translate(${y} ${-(y + h)})`);
		} else if (!landscape && hasTransform) {
			// Landscape → Portrait: swap w/h back and remove rotation
			const [x, y, w, h] = svg.getAttribute("viewBox").split(" ").map(Number);
			svg.setAttribute("viewBox", `${x} ${y} ${h} ${w}`);
			g?.removeAttribute("transform");
		}

		// Always keep _vx/_vy/_vw/_vh in sync with the actual SVG viewBox
		[this.#vx, this.#vy, this.#vw, this.#vh] =
			svg.getAttribute("viewBox").split(" ").map(Number);
	}

	async #highlight(sentiment = false) {
		const svgDoc = this.#svgDoc;
		if (!(svgDoc && this.hasAttribute("inventory"))) return;

		if (!sentiment)
			svgDoc.querySelectorAll("rect").forEach(el => el.classList.remove("selected"));

		const inventoryUrl = new URL(this.getAttribute("inventory"));
		const highlight = this.getAttribute("highlight");
		if (highlight) {
			const params = new URLSearchParams(highlight);
			for (const [key, value] of params.entries()) {
				if (["location", "partnumber", "lu"].includes(key)) {
					inventoryUrl.searchParams.set(key, value);
				}
			}
		}

		console.debug(inventoryUrl.toString());

		const response = await fetch(inventoryUrl);
		const inventory = await response.json();

		let selected = false;
		inventory.forEach(su => {
			let el = svgDoc.querySelector(`rect[id='${su.location.toUpperCase()}']`);

			if (el) {
				if (su.location[0] === su.location[0].toUpperCase()) {
					el.classList.add("selected");
					selected = true;
				}

				el.classList.remove("available", "unavailable")
				if (su.sentiment !== null)
					el.classList.add(su.sentiment + this._sentiment <= 5 ? "available" : "unavailable");
			}
		});

		svgDoc.firstElementChild.style.border = "";
		if (!selected)
			svgDoc.firstElementChild.style.border = "thin solid red"
	}

	#editSU(target, auto) {
		if (!target.querySelector("title"))
			target.insertAdjacentHTML("afterbegin", `<title></title>`);

		if (auto && this.#svg.querySelector(".lastEdit")) {
			target.setAttribute("dir", this.#svg.querySelector(".lastEdit").getAttribute("dir") || "ltr");

			const suggested = this.#lastSU(target);
			target.querySelector("title").textContent = suggested;
			target.setAttribute("id", suggested);
			return;
		}

		const suggested = this.#lastSU(target);
		const current = target.querySelector("title").textContent;
		const currentDirection = target.getAttribute("dir") || "ltr";
		// Create dialog
		const dialog = document.createElement("dialog");
		dialog.className = "vSUEdit";
		dialog.innerHTML = `
			<h3>${this.#t("su_dialog_title")}</h3>
			<form method="dialog" style="display:flex;flex-direction:column;gap:1em">
				<label><span>${this.#t("su_position_label")}</span><br>
					<select name="dir">
						<option value="ltr" ${currentDirection === "ltr" ? "selected" : ""}>${this.#t("su_position_ltr")}</option>
						<option value="rtl" ${currentDirection === "rtl" ? "selected" : ""}>${this.#t("su_position_rtl")}</option>
					</select>
				</label>
				<label><span>${this.#t("su_label_label")}</span><br>
					<input name="label" type="text" value="${current || suggested}" style="width:100%" autofocus>
				</label>
				<div style="display:flex;justify-content:flex-end;gap:1em">
					<button value="cancel" type="button" onclick="this.closest('dialog').close()">${this.#t("su_cancel")}</button>
					<button value="ok" type="submit">${this.#t("su_ok")}</button>
				</div>
			</form>
		`;
		this.appendChild(dialog);
		dialog.showModal();

		dialog.addEventListener("close", () => dialog.remove());

		dialog.querySelector("form").addEventListener("submit", e => {
			e.preventDefault();
			const form = e.target;
			const label = form.label.value.trim();
			const dir = form.dir.value;
			if (!label) { dialog.close(); return; }
			target.querySelector("title").textContent = label;
			// Sync all non-empty titles → element ids
			this.#svg.querySelectorAll("title").forEach(t => {
				if (t.textContent !== "") t.parentElement.setAttribute("id", t.textContent);
			});
			// Update dir attribute
			target.setAttribute("dir", dir);
			this.#emitSVGChange();
			dialog.close();
		});

		if (!dialog.querySelector("input[name='label']").value) {
			dialog.querySelector("input[name='label']").value = suggested;
			// dialog.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true }));
		}
	}
}

customElements.define("wms-map", WMSMap);

class WMSStorageUnit extends HTMLElement {
	constructor() {
		super();
	}

	showDialog(storageUnit, requestedSentiment, dir, detailed = false) {
		const maxAllowedSentiment = requestedSentiment == null ? null : 5 - requestedSentiment;

		let prefix, col, cols, colLabels = "", rows = "";
		if (storageUnit.location.length === 8) {
			prefix = storageUnit.location.substring(0, 3) ?? "";

			col = Number(storageUnit.location.substring(3, 6));
			cols = Array.from({ length: storageUnit.cols }, (_, i) => col + i);
			if (dir === "rtl") cols.reverse();

			colLabels = `${dir === "ltr" ? `<th style="width:2em"></th>` : ""}${cols.map(col => `<th>${prefix} ${String(col).padStart(3, "0")}</th>`).join("")}${dir === "rtl" ? `<th style="width:2em"></th>` : ""}`;

			rows = Array.from({ length: storageUnit.rows }, (_, row) => storageUnit.rows - row)
				.map(row => {
					const cells = cols.map(col => {
						const location = storageUnit.units.find(unit => unit.location === `${prefix}${String(col).padStart(3, "0")}${String(row).padStart(2, "0")}`);
						const sentiment = location.sentiment;
						const sentimentAttr = Number.isFinite(sentiment) ? ` data-sentiment="${sentiment}"` : "";

						const isAvailable = maxAllowedSentiment !== null && Number.isFinite(sentiment) && sentiment <= maxAllowedSentiment;
						const isUnavailable = maxAllowedSentiment !== null && Number.isFinite(sentiment) && sentiment > maxAllowedSentiment;

						const allClasses = [location.highlight ? "selected" : "", isAvailable ? "available" : isUnavailable ? "unavailable" : ""]
							.filter(Boolean)
							.join(" ");

						let content = '';
						if (detailed)
							content = location.items?.map(item => this.#binContent(item)).join("<br>") ?? "";
						else if (location.items)
							content = `<i class="fas fa-fw fa-boxes-stacked"></i>`; 

						return `<td class="${allClasses}"${sentimentAttr}>${content}</td>`;
					}).join("");

					return `<tr>${dir === "ltr" ? `<th>${String(row).padStart(2, "0")}</th>` : ""}${cells}${dir === "rtl" ? `<th>${String(row).padStart(2, "0")}</th>` : ""}</tr>`;
				}).join("");
		} else {
			prefix = storageUnit.location.substring(0, 1) ?? "";

			colLabels = `<th style="width:2em"></th><th>${prefix}</th>`;
			for (let row = 1; row <= 32; ++row)
				rows += `<tr><th>D${String(row).padStart(2, "0")}</th><td></td></tr>`
		}

		this.innerHTML = `<dialog class="wms"><i class="fa-solid fa-times" onclick="this.parentElement.remove()" style="cursor:pointer; position:absolute; ${dir === "rtl" ? 'right' : 'left'}:1em; top:0.5em; font-size:x-large;"></i><table><thead><tr>${colLabels}</tr></thead><tbody>${rows}</tbody></table></dialog>`;

		const dialog = this.querySelector("dialog");
		dialog.addEventListener("close", () => this.remove());
		dialog.showModal();
	}

	#binContent(item) {
		return `<span${item.highlight ? ` class="selected"` : ""}><b title="${String(item.lu).padStart(9, "0")}">${item.partnumber}</b> <i>${item.quantity.toLocaleString()} ${item.um}</i></span>`;
	}
}

customElements.define("wms-storage-unit", WMSStorageUnit);

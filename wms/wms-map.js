// deno-lint-ignore-file
const StorageUnits = [
	{ name: "small", alias: "A", layout: "vertical", w: 3, h: 7, bays: 6, shelves: 5 },
	{ name: "medium", alias: "B", layout: "vertical", w: 7, h: 17, bays: 3, shelves: 3 },
	{ name: "large", alias: "D", layout: "horizontal", w: 18, h: 26, default: { cols: 20, rows: 2 }, drawers: [] }
];

class WMSMap extends HTMLElement {
	// viewBox state
	#Vx = 0; #Vy = 0; #Vw = 0; #Vh = 0; 
	#vx = 0; #vy = 0; #vw = 0; #vh = 0;

	constructor() {
		super();
		this.insertAdjacentHTML("afterbegin", `<textarea id="SVG" name="SVG" style="display:block">SVG</textarea>`);

		this.attachShadow({ mode: "open" });

		// pan state
		this._isPanning = false;
		this._didPan = false;
		this._startX = this._startY = this._startVx = this._startVy = 0;

		// pointer/touch gesture state
		this._pointers = new Map();
		this._pinch = null; // { dist, vw, vh }

		this._svgLoaded = false;
		this._eventsAttached = false;

		this.onResize = () => this.#alignSVG();
	}

	static get observedAttributes() {
		return ["map", "inventory", "locations", "data", "mode"];
	}

	connectedCallback() {
		const validModes = ["picking", "putaway", "edit"];
		const queryMode = this.#norm(this.#queryParams.get("mode"));
		const attrMode = this.#norm(this.getAttribute("mode"));

		if (validModes.includes(queryMode))
			this.setAttribute("mode", queryMode);
		else if (!validModes.includes(attrMode))
			this.setAttribute("mode", "picking");

		this.#render();
		window.addEventListener("resize", this.onResize);
	}

	disconnectedCallback() {
		window.removeEventListener("resize", this.onResize);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		if (name === "map") {
			const obj = this.shadowRoot?.querySelector("object");
			if (obj) obj.data = newValue ?? "";
		}
		if (name === "inventory" && this._svgLoaded) {
			this.#localizeRack();
		}
		if (name === "locations" && this._svgLoaded && this.getAttribute("mode") === "putaway") {
			this.#localizeRack();
		}
		if (name === "data" && this._svgLoaded) {
			this.#localizeRack();
		}
		if (name === "mode") {
			this.#syncSizeControlVisibility();
		}
		if (name === "mode" && this._svgLoaded) {
			switch (newValue) {
				case "putaway":
				case "edit":
					break;
				default:
					this.setAttribute("mode", "picking");
			}
			this.#setup();
			this.#syncViewBox();
			this.#localizeRack();
		}
	}



	#render() {
		this.shadowRoot.innerHTML = `
			<style>
				object { display: block; width: 100%; height: 100%; border: thin solid gray; box-sizing: border-box; }
				.vStorageUnit { width: 90%; }
				.vStorageUnit table { width: 100%; border-collapse: collapse; }
				.vStorageUnit table tr:last-child td { border-bottom: thick solid CanvasText; }
				.vStorageUnit th { font-size: small; }
				.vStorageUnit td { border: 1px solid CanvasText; padding: 0.25em; height: 4em; vertical-align: top; overflow: auto; position: relative; }
				.vStorageUnit td[data-occupancy]::after { content: attr(data-occupancy); position: absolute; top: 4px; right: 4px; font-size: 0.75em; font-weight: bold; color: Canvas; background: CanvasText; padding: 0.25em 0.5em;}
				.vStorageUnit td.selected { background: lightgreen; color: black; }
				.vStorageUnit td.available { outline: 3px solid Highlight; outline-offset: -4px; }
				.vStorageUnit td.unavailable { outline: 3px solid red; outline-offset: -4px; }
				.vStorageUnit td.putaway { cursor: pointer; }
			</style>
			<p id="size-control">Dimensione carico: <label><input type="radio" name="size" value="1">1</label> <label><input type="radio" name="size" value="2">2</label> <label><input type="radio" name="size" value="3">3</label> <label><input type="radio" name="size" value="4">4</label> <label><input type="radio" name="size" value="5">5</label></p>
			<object type="image/svg+xml"></object>
		`;

		const querySize = this.#getRequestedSizeFromQuery() ?? 1;
		const sizeRadios = this.shadowRoot.querySelectorAll('input[name="size"]');
		for (const radio of sizeRadios) {
			radio.checked = radio.value === String(querySize);
			radio.addEventListener("change", () => this.#onSizeChange());
		}
		this.#syncSizeControlVisibility();

		const obj = this.shadowRoot.querySelector("object");
		const map = this.getAttribute("map");
		if (map) obj.data = map;

		obj.addEventListener("load", () => {
			if (this.getAttribute("mode") === "edit")
				this.#setup();
			this.#init();
			this._svgLoaded = true;
			this.#localizeRack();
		});
	}

	#onSizeChange() {
		const requestedSize = this.#getRequestedSize();
		const url = new URL(window.location.href);
		if (requestedSize === null)
			url.searchParams.delete("size");
		else
			url.searchParams.set("size", String(requestedSize));
		history.replaceState(null, "", url);

		if (this.getAttribute("mode") === "putaway" && this._svgLoaded)
			this.#localizeRack();
	}

	#syncSizeControlVisibility() {
		const sizeControl = this.shadowRoot?.querySelector("#size-control");
		if (!sizeControl) return;
		sizeControl.hidden = this.getAttribute("mode") !== "putaway";
	}

	get #svgDoc() {
		return this.shadowRoot.querySelector("object")?.contentDocument ?? null;
	}

	get #svg() {
		return this.#svgDoc?.querySelector("svg") ?? null;
	}

	get SVG() {
		return this.querySelector("#SVG").value;
	}
	get SVGDocument() {
		return this.#svgDoc ?? null;
	}

	// The #setup method transforms a raw SVG into a structured format with <rect> elements for racks and a clean viewBox.
	// In this case a DWG→SVG conversion with consistent path formats is assumed, but this can be adapted as needed.
	// https://anyconv.com/dwg-to-svg-converter/
	#setup() {
		const svgDoc = this.#svgDoc;
		if (!svgDoc) return;

		// Inject SVG styles
//		svgDoc.querySelectorAll("style").forEach(s => s.remove());
		const style = svgDoc.createElement("style");
		style.textContent = `
			:root { color-scheme: light dark; }
			svg { background: Canvas; color: CanvasText; stroke: gray; }
			path { stroke-width: 0.25; stroke: gray; fill: Canvas; }
			.rack { stroke: CanvasText; fill: Canvas; stroke-width: 0.25; }
			.rack.selected { fill: Mark; }
			.rack.available { stroke: Highlight; stroke-width: 0.5; }
			.rack.unavailable { stroke: red; stroke-width: 0.5; }
		`;

		// Wrap SVG content in a <g> if needed (required for rotate transform)
		if (svgDoc.documentElement.firstElementChild?.tagName !== "g") {
			const inner = svgDoc.documentElement.innerHTML;
			svgDoc.documentElement.innerHTML = `<g>${inner}</g>`;
		}
//		svgDoc.documentElement.firstElementChild.insertAdjacentElement("afterbegin", style);

		const svg = this.#svg;

		// Convert matching paths → rack <rect> elements and compute bounding box
		let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
		svg.querySelectorAll("path").forEach(path => {
			const pts = path.getAttribute("d").split(/[ML ]/).map(parseFloat).filter(n => !isNaN(n));

			if (pts.length === 16) {
				const w = Math.abs(Math.round(pts[2] - pts[0]) || Math.abs(Math.round(pts[6] - pts[4])));
				const h = Math.abs(parseInt(pts[3] - pts[1]) || Math.abs(parseInt(pts[7] - pts[5])));
				for (const unit of StorageUnits) {
					if (w * h === unit.w * unit.h) {
						path.insertAdjacentHTML("afterend",
							`<rect class="rack ${unit.name}" x="${pts[0]}" y="${pts[1]}" width="${w}" height="${h}"><title></title></rect>`);
						path.remove();
						break;
					}
				}
			} else if (pts.length > 16 || pts[0] > 235) {
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

		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		svg.setAttribute("viewBox",
			`${Math.floor(xmin) - 5} ${Math.floor(ymin) - 5} ${Math.ceil(xmax - xmin) + 10} ${Math.ceil(ymax - ymin) + 10}`);

		svg.firstElementChild?.tagName === "TITLE" && svg.firstElementChild.remove();
		svg.firstElementChild?.tagName === "DESC" && svg.firstElementChild.remove();

		this.#assignTitles(svg);
		this.#emitSvgChange();
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

	#emitSvgChange() {
		const svg = this.#svg;
		if (!svg) return;
		const map = svg.outerHTML.replace(` xmlns=""`, "").replaceAll(/\s+/g, " ").trim();
		this.dispatchEvent(new CustomEvent("svgchange", { detail: map, bubbles: true }));
		if (this.getAttribute("mode") === "edit")
			this.querySelector("#SVG").value = map;
	}

	#assignTitles(svg) {
		svg.querySelectorAll("rect.rack").forEach(rack => {
			if (!rack.querySelector("title"))
				rack.insertAdjacentHTML("afterbegin", `<title></title>`);
			const type = StorageUnits.find(unit => rack.classList.contains(unit.name));
			if (type?.layout === "vertical")
				rack.querySelector("title").textContent = rack.id;
		});
	}

	#lastRack(selectedRack) {
		let rackId = selectedRack.id || "";
		for (const rack of selectedRack.ownerDocument.querySelectorAll(".rack[id]")) {
			if (rackId === "" ||
				rack.id.substring(0, 4) > rackId.substring(0, 4) ||
				(rack.id.substring(0, 4) === rackId.substring(0, 4) &&
					Number(rack.id.substring(4)) > Number(rackId.substring(4)))) {
				rackId = rack.id;
			}
		}
		if (!rackId) return "B01 1";
		return rackId.substring(0, 4) + (Number(rackId.substring(4)) + 1);
	}

	#attachSVGEvents(svg) {
		// Prevent browser-native touch scrolling/zooming inside SVG area
		svg.style.touchAction = "none";

		svg.addEventListener("dblclick", () => {
			if (this.getAttribute("mode") === "edit") return;
			this.#alignSVG(true);
		});

		svg.addEventListener("click", event => {
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
				target = hit?.closest?.("rect.rack") ?? target;
			}
			if (target?.tagName === "rect") {
				if (this.getAttribute("mode") === "edit")
					this.#editRack(target, event.ctrlKey);
				else
					this.#showStorageUnit({ target });
			} else if (event.target.tagName === "DIALOG" && event.target.open) {
				event.target.close();
			}
		});

		svg.addEventListener("wheel", event => {
			if (this.getAttribute("mode") === "edit") return;
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
			if (this.getAttribute("mode") === "edit") return;

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
			if (this.getAttribute("mode") === "edit") return;
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

	async #localizeRack(inventory) {
		const svgDoc = this.#svgDoc;
		if (!svgDoc) return;

		svgDoc.querySelectorAll(".selected,.available").forEach(el => {
			el.classList.remove("selected", "available");
		});

		if (this.getAttribute("mode") === "putaway") {
			const requestParams = this.#requestApiParams();
			const inventoryData = Array.isArray(inventory)
				? inventory
				: await this.#loadDataAttribute("inventory", [], requestParams);
			const locationsData = await this.#loadDataAttribute("locations", {}, requestParams);
			this.#colorizeRacks(
				this.#asArray(inventoryData),
				locationsData && typeof locationsData === "object" && !Array.isArray(locationsData) ? locationsData : {}
			);
			return;
		}

		if (!Array.isArray(inventory)) {
			const requestParams = this.#requestApiParams();
			const loadedInventory = await this.#loadDataAttribute("inventory", [], requestParams);
			inventory = this.#asArray(loadedInventory);
		}
		if (this.getAttribute("mode") === "picking") {
			const requestParams = this.#requestApiParams();
			const pickingData = await this.#loadDataAttribute("data", null, requestParams);

			if (pickingData != null) {
				const pickRows = this.#normalizePickingDataRows(pickingData);
				const matchedLocations = new Set();

				for (const row of pickRows) {
					if (typeof row !== "object" || row === null) continue;

					this.#splitCSVValues(row.location).forEach(loc => matchedLocations.add(loc));

					const partnumbers = this.#splitCSVValues(row.partnumber).map(v => v.toLowerCase());
					const lus = this.#splitCSVValues(row.lu).map(v => v.toLowerCase());
					if (!partnumbers.length && !lus.length) continue;

					this.#matchInventoryLocations(inventory, partnumbers, lus, matchedLocations);
				}

				inventory = [...matchedLocations];
			} else {
				const qs = this.#queryParams;
				const qsLocations = this.#splitCSVValues(qs.get("location"));
				const qsPartnumbers = this.#splitCSVValues(qs.get("partnumber")).map(v => v.toLowerCase());
				const qsLus = this.#splitCSVValues(qs.get("lu")).map(v => v.toLowerCase());

				if (qsPartnumbers.length || qsLus.length) {
					inventory = [...this.#matchInventoryLocations(inventory, qsPartnumbers, qsLus, new Set(qsLocations))];
				} else {
					inventory = qsLocations;
				}
			}
		}

		inventory.forEach(location => {
			if (typeof location === "object" && location !== null)
				location = location.location;
			if (!location) return;

			const storageUnit = StorageUnits.find(unit => unit.alias === location[0]);
			if (!storageUnit) return;

			let rack;
			if (storageUnit.layout === "horizontal") {
				for (rack of svgDoc.querySelectorAll(`rect[id^='${location[0]}']`)) {
					if (Number(rack.id.substring(1, 3)) <= Number(location.substring(1, 3)) &&
						Number(location.substring(1, 3)) <= Number(rack.id.substring(4, 6)))
						break;
					rack = undefined;
				}
			} else {
				for (rack of svgDoc.querySelectorAll(`rect[id^='${location.substring(0, 3)}']`)) {
					const bay = Number(rack.firstChild?.textContent.substring(4, 7));
					if (bay <= Number(location.substring(3, 6)) &&
						Number(location.substring(3, 6)) < bay + storageUnit.bays)
						break;
					rack = undefined;
				}
			}

			svgDoc.firstElementChild.style.border = ""
			if (rack)
				svgDoc.getElementById(rack.id)?.classList.add("selected");
			else
				// alert(`Ubicazione ${this.#formatLocation(location)} non trovata.`);
				svgDoc.firstElementChild.style.border = "thick solid red"
		});
	}

	#normalizePickingDataRows(data) {
		if (Array.isArray(data)) return data;
		if (typeof data === "string") {
			try {
				const parsed = JSON.parse(data);
				if (Array.isArray(parsed)) return parsed;
				if (parsed && typeof parsed === "object") return [parsed];
			} catch {
				return [];
			}
			return [];
		}
		if (data && typeof data === "object") {
			if (Array.isArray(data.items)) return data.items;
			return [data];
		}
		return [];
	}

	#splitCSVValues(value) {
		if (Array.isArray(value))
			return value
				.flatMap(v => this.#splitCSVValues(v))
				.filter(Boolean);
		if (value == null) return [];
		return String(value)
			.split(",")
			.map(s => s.trim())
			.filter(Boolean);
	}

	get #queryParams() {
		return new URL(window.location.href).searchParams;
	}

	#norm(value) {
		return String(value ?? "").trim().toLowerCase();
	}

	#formatLocation(loc) {
		return loc.replace(/^(.{3})(.{3})(.{2})$/, "$1 $2 $3");
	}

	#isValidOccupancy(v) {
		return Number.isFinite(v) && v >= 0 && v <= 5;
	}

	#asArray(value) {
		return Array.isArray(value) ? value : [];
	}

	#matchInventoryLocations(inventory, partnumbers, lus, seed = new Set()) {
		for (const item of this.#asArray(inventory)) {
			if (typeof item !== "object" || item === null) continue;
			const loc = String(item.location ?? "").trim();
			if (!loc) continue;
			if ((partnumbers.length ? partnumbers.includes(this.#norm(item.partnumber)) : true) &&
				(lus.length ? lus.includes(this.#norm(item.lu)) : true))
				seed.add(loc);
		}
		return seed;
	}

	#requestApiParams(extra = {}) {
		const query = this.#queryParams;
		const mode = query.get("mode") ?? this.getAttribute("mode");
		const location = query.get("location");
		const partnumber = query.get("partnumber");
		const lu = query.get("lu");
		const size = query.get("size");

		return {
			...(mode ? { mode } : {}),
			...(location ? { location } : {}),
			...(partnumber ? { partnumber } : {}),
			...(lu ? { lu } : {}),
			...(size ? { size } : {}),
			...extra
		};
	}

	#buildApiUrl(value, extraParams = {}) {
		const url = new URL(value, window.location.href);
		const params = this.#requestApiParams(extraParams);
		for (const [key, val] of Object.entries(params)) {
			if (val == null || val === "") continue;
			url.searchParams.set(key, String(val));
		}
		return url;
	}

	async #loadDataAttribute(name, fallback, extraParams = {}) {
		const attr = this.getAttribute(name);
		if (!attr) return fallback;
		const value = attr.trim();
		if (!value) return fallback;

		if (!/^(https?:\/\/|\.|\/)/i.test(value)) {
			console.error(`Invalid ${name} attribute: expected URL/path, received non-URL value.`);
			return fallback;
		}

		const url = this.#buildApiUrl(value, extraParams);
		const key = url.href;
		const cached = sessionStorage.getItem(key);
		if (cached !== null)
			return JSON.parse(cached);
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(`Failed to fetch ${name}: ${response.status} ${response.statusText}`);
		const data = await response.json();
		try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* quota exceeded */ }
		return data;
	}

	/**
	 * Returns all location codes belonging to a vertical rack rect.
	 * e.g. rack id "A01 043 01" → ["A0104301","A0104302",...,"A0104805"]
	 */
	#rackLocations(rack) {
		const storageUnit = StorageUnits.find(u => u.alias === rack.id[0]);
		if (!storageUnit || storageUnit.layout !== "vertical") return [];
		const m = rack.id.match(/^([A-Z])(\d{2}) (\d{3}) \d{2}$/);
		if (!m) return [];
		const [, alias, row, bayStr] = m;
		const startBay = parseInt(bayStr);
		const codes = [];
		for (let b = 0; b < storageUnit.bays; b++) {
			const bay = String(startBay + b).padStart(3, "0");
			for (let s = 1; s <= storageUnit.shelves; s++)
				codes.push(`${alias}${row}${bay}${String(s).padStart(2, "0")}`);
		}
		return codes;
	}

	/**
	 * Putaway mode rack colorization.
	 * - selected: rack has at least one location containing querystring partnumber
	 * - available: rack has at least one location with occupancy + requestedSize <= 5
	 */
	#colorizeRacks(inventory, locations) {
		const svgDoc = this.#svgDoc;
		if (!svgDoc) return;

		const partnumber = this.#getQueryPartnumber();
		const requestedSize = this.#getRequestedSize();

		const hitSet = new Set(
			(partnumber
				? inventory.filter(item =>
					typeof item === "object" && item !== null &&
					this.#norm(item.partnumber) === partnumber &&
					typeof item.location === "string")
				: [])
				.map(item => item.location.trim())
		);

		svgDoc.querySelectorAll("rect.rack").forEach(rack => {
			rack.classList.remove("available", "unavailable", "selected");

			const codes = this.#rackLocations(rack);
			if (!codes.length) return;

			// selected = rack contains requested partnumber
			if (partnumber && codes.some(c => hitSet.has(c))) rack.classList.add("selected");

			// available = at least one location can hold requested size
			// occupancy value is 0..5 where 5 means full
			if (requestedSize !== null) {
				const maxAllowedOccupancy = 5 - requestedSize;
				let hasKnown = false;
				let canFit = false;
				for (const c of codes) {
					const raw = locations?.[c];
					const v = raw == null ? Number.NaN : Number(raw);
					if (!this.#isValidOccupancy(v)) continue;
					hasKnown = true;
					if (v <= maxAllowedOccupancy) { canFit = true; break; }
				}
				if (canFit) rack.classList.add("available");
				else if (hasKnown) rack.classList.add("unavailable");
			}
		});
	}

	#getQueryPartnumber() {
		return this.#norm(this.#queryParams.get("partnumber"));
	}

	#getRequestedSizeFromQuery() {
		const raw = this.#queryParams.get("size");
		if (raw == null || raw === "") return null;
		const n = Number.parseInt(raw, 10);
		if (Number.isNaN(n)) return null;
		return Math.max(1, Math.min(5, n));
	}

	/**
	 * Requested size in range 1..5.
	 * Returns null if not provided.
	 */
	#getRequestedSize() {
		const checked = this.shadowRoot?.querySelector('input[name="size"]:checked');
		if (checked) {
			const inputSize = Number.parseInt(checked.value, 10);
			if (!Number.isNaN(inputSize))
				return Math.max(1, Math.min(5, inputSize));
		}
		return this.#getRequestedSizeFromQuery();
	}

	/**
	 * Label a rack in edit mode.
	 * Plain click  → prompt (pre-filled with current label or next sequential ID).
	 * Ctrl+click   → auto-assign next sequential ID without prompting.
	 */
	#editRack(target, autoAssign = false) {
		if (!target.querySelector("title"))
			target.insertAdjacentHTML("afterbegin", `<title></title>`);

		const suggested = this.#lastRack(target);
		const current = target.querySelector("title").textContent;
		const label = autoAssign
			? suggested
			: prompt("Rack label:", current || suggested);

		if (label === null) return; // cancelled
		target.querySelector("title").textContent = label;

		// Sync all non-empty titles → element ids
		this.#svg.querySelectorAll("title").forEach(t => {
			if (t.textContent !== "") t.parentElement.setAttribute("id", t.textContent);
		});

		this.#emitSvgChange();
	}

	async #showStorageUnit(event) {
		const target = event.target;
		const storageUnit = StorageUnits.find(unit => unit.alias === target.id[0]);
		if (!storageUnit) return;

		if (storageUnit.layout === "horizontal") {
			for (const rack of this.#svgDoc.querySelectorAll(`rect[id^='${target.id[0]}']`)) {
				if (Number(rack.id.substring(1, 3)) <= Number(target.id.substring(1, 3)) &&
					Number(target.id.substring(1, 3)) <= Number(rack.id.substring(4, 6)))
					rack.classList.toggle("selected");
			}
		} else {
			const mode = this.getAttribute("mode");
			const extraParams = { location: target.id };
			try {
				const inventory = await this.#loadDataAttribute("inventory", [], extraParams);
				let locationStates = {};
				if (mode === "putaway") {
					const loaded = await this.#loadDataAttribute("locations", {}, extraParams);
					if (loaded && typeof loaded === "object" && !Array.isArray(loaded))
						locationStates = loaded;
				}
				this.#openStorageUnitDialog(target, storageUnit,
					this.#asArray(inventory),
					{ mode, locationStates });
			} catch (err) {
				console.error("Error fetching storage unit data", err);
				this.#openStorageUnitDialog(target, storageUnit, [], { mode });
			}
		}
	}

	#binContent(item, standard = false) {
		if (typeof item !== "object" || item === null)
			return String(item);
		if (standard)
			return Object.entries(item)
				.filter(([k]) => k !== "location")
				.map(([k, v]) => `<b>${k}</b>: ${v}`)
				.join("<br>");
		else
			return `<div>${String(item.lu).padStart(9, "0")} <b>${item.partnumber}</b> <i>${item.quantity.toLocaleString()} ${item.um}</i></div>`;
	}

	#openStorageUnitDialog(target, storageUnit, inventory, context = {}) {
		const { mode, locationStates = {} } = context;
		const partnumber = this.#getQueryPartnumber();
		const requestedSize = this.#getRequestedSize();
		const maxAllowedOccupancy = requestedSize == null ? null : 5 - requestedSize;

		const bay = Number(target.firstChild?.textContent.substring(4, 7));
		const bays = Array.from({ length: storageUnit.bays }, (_, i) => bay + i);
		if (target.getAttribute("direction") === "rtl") bays.reverse();

		const prefix = target.firstChild?.textContent.substring(0, 3) ?? "";

		// Index fetched inventory by location code for O(1) cell lookup
		const byLoc = new Map();
		for (const item of inventory) {
			const loc = typeof item === "object" && item !== null ? item.location : item;
			if (!loc) continue;
			if (!byLoc.has(loc)) byLoc.set(loc, []);
			byLoc.get(loc).push(item);
		}

		const ths = bays.map(b =>
			`<th style="width:${100 / bays.length}%">${prefix} ${String(b).padStart(3, "0")}</th>`
		).join("");

		const rows = Array.from({ length: storageUnit.shelves }, (_, i) => storageUnit.shelves - i)
			.map(j => {
				const cells = bays.map(b => {
					const locCode = `${prefix}${String(b).padStart(3, "0")}${String(j).padStart(2, "0")}`;
					const items = byLoc.get(locCode) ?? [];
					const hasPartnumber = partnumber
						? items.some(item => this.#norm(item?.partnumber) === partnumber)
						: false;
					const rawOccupancy = locationStates?.[locCode];
					const occupancy = rawOccupancy == null ? Number.NaN : Number(rawOccupancy);
					const validOccupancy = this.#isValidOccupancy(occupancy);
					const isAvailable = mode === "putaway" && maxAllowedOccupancy !== null &&
						validOccupancy && occupancy <= maxAllowedOccupancy;
					const isUnavailable = mode === "putaway" && maxAllowedOccupancy !== null &&
						validOccupancy && occupancy > maxAllowedOccupancy;
					const content = items.map(item => this.#binContent(item)).join("");
					const occupancyAttr = validOccupancy ? ` data-occupancy="L${occupancy}"` : "";
					const putawayAttr = mode === "putaway" ? ` data-location="${locCode}"` : "";
					const putawayClass = mode === "putaway" ? "putaway" : "";
					const allClasses = [hasPartnumber ? "selected" : "", isAvailable ? "available" : isUnavailable ? "unavailable" : "", putawayClass]
						.filter(Boolean)
						.join(" ");
					return `<td class="${allClasses}"${occupancyAttr}${putawayAttr}>${content}</td>`;
				}).join("");
				return `<tr>${cells}<th style="width:2em">${String(j).padStart(2, "0")}</th></tr>`;
			}).join("");

		const html = `
			<dialog class="vStorageUnit">
				<table><tr>${ths}<th style="cursor:pointer;font-size:xx-large" onclick="this.closest('dialog').close()">&times;</th></tr>${rows}</table>
			</dialog>`;

		const tpl = document.createElement("div");
		tpl.innerHTML = html;
		const dialog = tpl.firstElementChild;
		this.shadowRoot.appendChild(dialog);
		dialog.showModal();
		dialog.addEventListener("close", () => dialog.remove());

		if (mode === "putaway") {
			dialog.addEventListener("click", e => {
				const td = e.target.closest("td[data-location]");
				if (!td) return;
				const location = td.dataset.location;
				const occupancy = prompt(`Quanto è piena l'ubicazione ${this.#formatLocation(location)}? [0-5] N.B. Se non è utlizzata lasciare vuoto.`, td.dataset.occupancy);
				if (occupancy === null) return;
				const n = Number.parseInt(occupancy, 10);
				if (Number.isNaN(n) || n < 0 || n > 5) return;
				locationStates[location] = n;
				this.#colorizeRacks(inventory, locationStates);
			});
		}
	}
}

customElements.define("wms-map", WMSMap);

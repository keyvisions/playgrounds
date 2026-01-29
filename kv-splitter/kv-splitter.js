class KVSPlitter extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onPointerMove = this._onPointerMove.bind(this);
		this._onPointerUp = this._onPointerUp.bind(this);
		this._gutters = [];
		this._active = null;
	}

	_getRootFontSize() {
		if (!this._rootFont) {
			const v = getComputedStyle(document.documentElement).fontSize || '16px';
			this._rootFont = parseFloat(v) || 16;
		}
		return this._rootFont;
	}

	_pxToRem(px) {
		const root = this._getRootFontSize();
		return (px / root) + 'rem';
	}

	connectedCallback() {
		// Prefer CSS custom-property for stylistic options (e.g. flex-direction).
		// Fall back to attribute when the CSS variable isn't provided.
		let dir = (getComputedStyle(this).getPropertyValue('--direction') || '').trim();
		if (!dir) dir = this.getAttribute('direction') || 'row';
		let mode = (getComputedStyle(this).getPropertyValue('--mode') || '').trim();
		if (!mode) mode = this.getAttribute('mode') || 'panels';

		this.shadowRoot.innerHTML = `
			<style>
			:host{display:block}
			.container{position:relative;height:100%}
			.wrap{display:flex;flex-direction:var(--direction, row);gap:var(--kv-gap,0.5rem);height:100%;align-items:stretch}
			::slotted(*){flex:1 1 0;min-width:0;min-height:0}
			#gutters{position:absolute;inset:0;pointer-events:none}
			.gutter{position:absolute;background:transparent;z-index:10;pointer-events:auto}
			.gutter.visible{background:rgba(0,0,0,0.06)}
			</style>
			<div class="container">
				<div class="wrap" part="wrap"><slot></slot></div>
				<div id="gutters"></div>
			</div>
		`;

		this._mode = mode;
		// Read the final computed direction so component logic (gutters/drag) matches styling.
		this._dir = (getComputedStyle(this).getPropertyValue('--direction') || dir).trim() || 'row';
		this._wrap = this.shadowRoot.querySelector('.wrap');
		this._slot = this.shadowRoot.querySelector('slot');
		this._guttersHost = this.shadowRoot.getElementById('gutters');

		// bind helpers so we can add/remove listeners reliably
		this._boundCreateGutters = this._createGutters.bind(this);
		this._boundAdjustMax = this._adjustMaxHeight.bind(this);
		this._createGutters();
		this._adjustMaxHeight();

		// recompute on resize or slot changes
		this._ro = new ResizeObserver(this._boundCreateGutters);
		this._ro.observe(this);
		this._slot.addEventListener('slotchange', this._boundCreateGutters);
		window.addEventListener('resize', this._boundCreateGutters);
		window.addEventListener('resize', this._boundAdjustMax);
	}

	disconnectedCallback() {
		window.removeEventListener('resize', this._boundCreateGutters);
		window.removeEventListener('resize', this._boundAdjustMax);
		this._slot?.removeEventListener('slotchange', this._boundCreateGutters);
		this._ro?.disconnect();
	}

	_adjustMaxHeight() {
		// Calculate available vertical space from the element's top to the bottom of the viewport
		// and cap the element's max-height so borders/margins/paddings won't push it beyond the viewport.
		try {
			const rect = this.getBoundingClientRect();
			const style = getComputedStyle(this);
			const marginBottom = parseFloat(style.marginBottom) || 0;
			const borderBottom = parseFloat(style.borderBottomWidth) || 0;
			const paddingBottom = parseFloat(style.paddingBottom) || 0;
			const extra = marginBottom + borderBottom + paddingBottom + 1; // small fudge
			const availPx = Math.max(0, window.innerHeight - rect.top - extra);
			const currentH = parseFloat(getComputedStyle(this).height) || 0;
			if (currentH > availPx) {
				this.style.maxHeight = this._pxToRem(availPx);
			} else {
				// clear maxHeight if it isn't needed
				this.style.maxHeight = '';
			}
		} catch (err) {
			// ignore
		}
	}

	_createGutters() {
		// clear existing
		this._guttersHost.innerHTML = '';
		this._gutters = [];
		const assigned = this._slot.assignedElements({ flatten: true }).filter(el => el.nodeType === 1);
		if (assigned.length < 2) return;

		// for each gap between adjacent elements create an overlay gutter
		for (let i = 0; i < assigned.length - 1; i++) {
			const a = assigned[i];
			const b = assigned[i + 1];
			const rectA = a.getBoundingClientRect();
			const rectB = b.getBoundingClientRect();
			const hostRect = this.getBoundingClientRect();

			const gutter = document.createElement('div');
			gutter.className = 'gutter';
			gutter.dataset.index = i;
			// position and size
			const GUTTER_PX = 12;
			const HALF_PX = GUTTER_PX / 2;
			if (this._dir === 'row') {
				// center gutter in the gap between a.right and b.left
				const gapCenter = ((rectA.right + rectB.left) / 2) - hostRect.left;
				const top = rectA.top - hostRect.top;
				const height = rectA.height;
				gutter.style.left = this._pxToRem(gapCenter - HALF_PX);
				gutter.style.top = this._pxToRem(top);
				gutter.style.width = this._pxToRem(GUTTER_PX);
				gutter.style.height = this._pxToRem(height);
				gutter.style.cursor = 'col-resize';
			} else {
				// center gutter in the gap between a.bottom and b.top
				const gapCenter = ((rectA.bottom + rectB.top) / 2) - hostRect.top;
				const left = rectA.left - hostRect.left;
				const width = rectA.width;
				gutter.style.top = this._pxToRem(gapCenter - HALF_PX);
				gutter.style.left = this._pxToRem(left);
				gutter.style.height = this._pxToRem(GUTTER_PX);
				gutter.style.width = this._pxToRem(width);
				gutter.style.cursor = 'row-resize';
			}

			gutter.addEventListener('pointerdown', (e) => this._onPointerDown(e, i));
			this._guttersHost.appendChild(gutter);
			this._gutters.push(gutter);
		}
	}

	_positionGutter(index) {
		const assigned = this._slot.assignedElements({ flatten: true }).filter(el => el.nodeType === 1);
		if (index < 0 || index >= assigned.length - 1) return;
		const a = assigned[index];
		const rectA = a.getBoundingClientRect();
		const b = assigned[index + 1];
		const rectB = b.getBoundingClientRect();
		const hostRect = this.getBoundingClientRect();
		const gutter = this._gutters[index];
		if (!gutter) return;
		const GUTTER_PX = 12;
		const HALF_PX = GUTTER_PX / 2;
		if (this._dir === 'row') {
			const gapCenter = ((rectA.right + rectB.left) / 2) - hostRect.left;
			gutter.style.left = this._pxToRem(gapCenter - HALF_PX);
			gutter.style.top = this._pxToRem(rectA.top - hostRect.top);
			gutter.style.height = this._pxToRem(rectA.height);
		} else {
			const gapCenter = ((rectA.bottom + rectB.top) / 2) - hostRect.top;
			gutter.style.top = this._pxToRem(gapCenter - HALF_PX);
			gutter.style.left = this._pxToRem(rectA.left - hostRect.left);
			gutter.style.width = this._pxToRem(rectA.width);
		}
	}

	_onPointerDown(e, index) {
		e.preventDefault();
		const gutter = e.currentTarget;
		gutter.classList.add('visible');

		const assigned = this._slot.assignedElements({ flatten: true }).filter(el => el.nodeType === 1);
		const a = assigned[index];
		const b = assigned[index + 1];
		const rectA = a.getBoundingClientRect();
		const rectB = b.getBoundingClientRect();

		if (this._mode === 'gap') {
			this._active = { index, startX: e.clientX, startY: e.clientY, startGap: this._getGap(), gutter };
		} else {
			// panels mode: store start sizes and elements
			this._active = {
				index,
				startX: e.clientX,
				startY: e.clientY,
				a, b,
				aStartSize: (this._dir === 'row') ? rectA.width : rectA.height,
				bStartSize: (this._dir === 'row') ? rectB.width : rectB.height,
				gutter
			};
			// ensure adjacent items use fixed basis during drag if they were flexible
			a.style.flex = a.style.flex || '1 1 0px';
			b.style.flex = b.style.flex || '1 1 0px';
			// set explicit basis to their current sizes (use rem units)
			a.style.flex = `0 0 ${this._pxToRem(this._active.aStartSize)}`;
			b.style.flex = `0 0 ${this._pxToRem(this._active.bStartSize)}`;
		}

		window.addEventListener('pointermove', this._onPointerMove);
		window.addEventListener('pointerup', this._onPointerUp);
	}

	_onPointerMove(e) {
		if (!this._active) return;
		const delta = (this._dir === 'row') ? (e.clientX - this._active.startX) : (e.clientY - this._active.startY);
		if (this._mode === 'gap') {
			const newGap = Math.max(0, this._active.startGap + delta);
			// set gap as rem so layout scales with root font size
			this.style.setProperty('--kv-gap', this._pxToRem(newGap));
			// update all gutters positions as needed
			this._gutters.forEach((g, i) => this._positionGutter(i));
		} else {
			// panels mode: resize only adjacent panels
			const minSizePx = 20; // px (kept as px for calculations)
			const aNew = Math.max(minSizePx, this._active.aStartSize + delta);
			const bNew = Math.max(minSizePx, this._active.bStartSize - delta);
			// apply new fixed bases (use rem units)
			try {
				this._active.a.style.flex = `0 0 ${this._pxToRem(aNew)}`;
				this._active.b.style.flex = `0 0 ${this._pxToRem(bNew)}`;
			} catch (err) {/* ignore if elements removed */ }
			// update active gutter position
			this._positionGutter(this._active.index);
		}
	}

	_onPointerUp(e) {
		if (!this._active) return;
		const g = this._gutters[this._active.index];
		g?.classList.remove('visible');

		// If panels mode, convert the current pixel sizes into percentages
		// so panels respond to window/container resizes.
		if (this._mode === 'panels' && this._active && this._active.a && this._active.b) {
			try {
				const wrapRect = this._wrap.getBoundingClientRect();
				if (this._dir === 'row') {
					const aRect = this._active.a.getBoundingClientRect();
					const bRect = this._active.b.getBoundingClientRect();
					const total = Math.max(1, wrapRect.width);
					const aPct = (aRect.width / total) * 100;
					const bPct = (bRect.width / total) * 100;
					this._active.a.style.flex = `0 0 ${aPct.toFixed(4)}%`;
					this._active.b.style.flex = `0 0 ${bPct.toFixed(4)}%`;
				} else {
					const aRect = this._active.a.getBoundingClientRect();
					const bRect = this._active.b.getBoundingClientRect();
					const total = Math.max(1, wrapRect.height);
					const aPct = (aRect.height / total) * 100;
					const bPct = (bRect.height / total) * 100;
					this._active.a.style.flex = `0 0 ${aPct.toFixed(4)}%`;
					this._active.b.style.flex = `0 0 ${bPct.toFixed(4)}%`;
				}
			} catch (err) {
				// ignore if elements removed
			}
		}

		this._active = null;
		window.removeEventListener('pointermove', this._onPointerMove);
		window.removeEventListener('pointerup', this._onPointerUp);
	}

	_getGap() {
		let v = getComputedStyle(this).getPropertyValue('--kv-gap') || getComputedStyle(this).getPropertyValue('--gap') || '0.5rem';
		v = v.trim();
		if (v.endsWith('rem')) {
			const val = parseFloat(v);
			return (val || 0) * this._getRootFontSize();
		}
		if (v.endsWith('px')) {
			return parseFloat(v) || 0;
		}
		// fallback: try parse as number (assume px)
		return parseFloat(v) || 0;
	}
}

customElements.define('kv-splitter', KVSPlitter);

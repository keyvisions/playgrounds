/*
** Author: Giancarlo Trevisan
** Date: 2026/01/27
** Description: Signature pad web component for capturing digital signatures
** Usage: <kv-sign width="500" height="200"></kv-sign>
*/
class kvSign extends HTMLElement {
    static formAssociated = true;

    static observedAttributes = ['width', 'height', 'color', 'linewidth'];

    constructor() {
        super();
        this._internals = this.attachInternals();

        this.canvas = null;
        this.ctx = null;
        this.drawing = false;
        this.lastX = 0;
        this.lastY = 0;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    attributeChangedCallback(_name, oldValue, newValue) {
        if (this.canvas && oldValue !== newValue) {
            this.render();
            this.setupEventListeners();
        }
    }

    render() {
        const width = this.getAttribute('width') || '500';
        const height = this.getAttribute('height') || '200';
        
        this.innerHTML = `
            <div class="kv-sign-container">
                <canvas class="kv-sign-canvas" width="${width}" height="${height}"></canvas>
                <div class="kv-sign-buttons">
                    <button class="kv-sign-clear">Clear</button>
                </div>
            </div>
        `;

        this.canvas = this.querySelector('.kv-sign-canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    setupEventListeners() {
        if (!this.canvas) return;

        const clearBtn = this.querySelector('.kv-sign-clear');
        const saveBtn = this.querySelector('.kv-sign-save');

        // Remove old listeners by cloning nodes
        const newCanvas = this.canvas.cloneNode(true);
        this.canvas.parentNode.replaceChild(newCanvas, this.canvas);
        this.canvas = newCanvas;
        this.ctx = this.canvas.getContext('2d');

        this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('pointerleave', this.handlePointerLeave.bind(this));

        clearBtn.addEventListener('click', this.clear.bind(this));
        saveBtn.addEventListener('click', this.save.bind(this));
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return { x, y };
    }

    handlePointerDown(e) {
        e.preventDefault();
        this.drawing = true;
        const pos = this.getPos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    handlePointerMove(e) {
        if (!this.drawing) return;
        e.preventDefault();
        const pos = this.getPos(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.strokeStyle = this.getAttribute('color') || '#000';
        this.ctx.lineWidth = this.getAttribute('linewidth') || 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
        
        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    handlePointerUp() {
        this.drawing = false;
    }

    handlePointerLeave() {
        this.drawing = false;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.dispatchEvent(new CustomEvent('clear', { bubbles: true }));
    }

    save() {
        if (!this.isCanvasBlank()) {
            const dataUrl = this.canvas.toDataURL('image/png');
            this.dispatchEvent(new CustomEvent('save', { 
                bubbles: true, 
                detail: { dataUrl } 
            }));
            return dataUrl;
        } else {
            this.dispatchEvent(new CustomEvent('save', { 
                bubbles: true, 
                detail: { dataUrl: null, error: 'Canvas is blank' } 
            }));
            return null;
        }
    }

    isCanvasBlank() {
        const blank = document.createElement('canvas');
        blank.width = this.canvas.width;
        blank.height = this.canvas.height;
        return this.canvas.toDataURL() === blank.toDataURL();
    }

    getSignature() {
        return this.save();
    }

    isEmpty() {
        return this.isCanvasBlank();
    }

    dataURLToBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    get formData() {
        const formData = new FormData();
        if (!this.isEmpty()) {
            const dataUrl = this.canvas.toDataURL('image/png');
            const blob = this.dataURLToBlob(dataUrl);
            const file = new File([blob], 'signature.png', { type: 'image/png' });
            const name = this.getAttribute('name') || 'signature';
            formData.append(name, file);
        }
        return formData;
    }
}

customElements.define('kv-sign', kvSign);

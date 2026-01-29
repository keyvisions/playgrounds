# kv-sign

A lightweight web component for capturing digital signatures on a canvas.

## Usage

```html
<link href="./kv-sign.css" type="text/css" rel="stylesheet">
<script src="./kv-sign.js" defer></script>

<kv-sign></kv-sign>
```

## Attributes

- `width` - Canvas width in pixels (default: 500)
- `height` - Canvas height in pixels (default: 200)
- `color` - Stroke color (default: #000)
- `linewidth` - Line width in pixels (default: 2)

## Examples

### Basic signature pad
```html
<kv-sign></kv-sign>
```

### Custom size
```html
<kv-sign width="800" height="300"></kv-sign>
```

### Custom styling
```html
<kv-sign color="#0066cc" linewidth="3"></kv-sign>
```

## Events

The component dispatches custom events:

### `save` event
Fired when the save button is clicked.

```javascript
element.addEventListener('save', (e) => {
    if (e.detail.dataUrl) {
        // Signature saved successfully
        console.log(e.detail.dataUrl); // Base64 PNG data URL
    } else {
        // Canvas is blank
        console.log(e.detail.error);
    }
});
```

### `clear` event
Fired when the clear button is clicked.

```javascript
element.addEventListener('clear', () => {
    console.log('Signature cleared');
});
```

## Methods

### `getSignature()`
Returns the signature as a base64 PNG data URL, or null if canvas is blank.

```javascript
const signature = document.querySelector('kv-sign').getSignature();
```

### `isEmpty()`
Returns true if the canvas is blank.

```javascript
const isEmpty = document.querySelector('kv-sign').isEmpty();
```

### `clear()`
Clears the signature canvas.

```javascript
document.querySelector('kv-sign').clear();
```

## Features

- Touch and pointer event support
- Smooth drawing with rounded line caps
- Blank canvas detection
- Custom colors and line widths
- Events for integration with forms
- Responsive design

## Author

Giancarlo Trevisan - 2026/01/27

# kv-fringe Web Component

## Description

The `kv-fringe` web component manages the fringe benefits given to an employee in a given period. It handles the type of benefits (such as Agip, Tosano, Centro Commerciale Palladio), the amount, and the coded cards associated with these benefits.

## Features

- Tracks fringe benefits for employees over specific periods
- Supports various benefit types including fuel stations and shopping centers
- Manages benefit amounts and associated coded cards

## Usage

To use the `kv-fringe` web component, include the JavaScript file in your HTML and define the custom element with a data source.

### HTML Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fringe Benefits</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" />
    <script defer src="./kv-fringe.js"></script>
</head>
<body>
    <!-- Data storage element (textarea or input) -->
    <textarea id="fringe-data" name="data"></textarea>
    
    <!-- Custom element -->
    <kv-fringe for="fringe-data" caption="Fringe Benefits"></kv-fringe>
</body>
</html>
```

### Attributes

- `for`: The ID of the HTML element (e.g., textarea or input) used to store the component's data in JSON format.
- `caption`: Optional. The table caption. Defaults to "Fringe L. BILANCIO".

The component automatically loads and saves data to the specified element. Users can add rows for new benefits, edit existing ones, and delete rows as needed. The total amount is calculated and displayed automatically.
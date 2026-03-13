# kv-putaway

## Overview

**kv-putaway** is a custom web component for managing and recording the process of putting items into storage or inventory. It is designed for warehouse or inventory management scenarios, allowing users to input and track details for each item being put away.

Given a "delivery" of a specified quantity (using the `data-quantity` attribute), the component allows you to distribute this total into multiple Loading Units (LU). For example, if you receive 1000 items, you can record their distribution as 5 boxes of 200 pieces each, specifying details such as batch (e.g., 2026-1) and origin (e.g., China) for each LU.

## Features
- Add, edit, and remove rows for multiple items.
- Input fields for units, quantity, batch, and origin.
- Automatic calculation of total units and total quantity.
- Option to finalize the putaway process ("Fine carico").
- Buttons to print labels and save data.

## Usage


Include the component in your HTML:

```html
<kv-putaway name="data" data-quantity="2000" data-lu=""></kv-putaway>
```

- `data-quantity`: Sets the initial quantity for the first row.
- `name` and `data-lu`: Optional attributes for custom data handling.

## Example

The component renders a table where you can:
- Add new rows for additional items.
- Enter units, quantity, batch, and origin for each item.
- Remove rows as needed.
- See totals update automatically.
- Finalize the process or print labels using the provided buttons.

## Typical Use Case

Use **kv-putaway** in warehouse management systems to record the details of goods as they are stored, ensuring accurate tracking and inventory control.

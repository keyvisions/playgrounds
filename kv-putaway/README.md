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
<kv-putaway name="qty" itemid="ABC" onprint="print()">150</kv-putaway>
```

**Attributes:**
- **name**: Name for the hidden input storing JSON data.
- **itemid**: Identifier for the item (displayed in dialog header).
- **onprint**: Optional function name for custom label printing (e.g., onprint="print()").

**Inner text:**
- The number inside the tag sets the initial quantity for the first row.

**Workflow:**
- Click the box icon to open the dialog.
- Add/edit/remove rows for loading units (LU).
- Enter units, quantity, batch, and origin for each LU.
- Totals update automatically.
- Finalize with "Fine carico" checkbox.
- Print labels or save data using buttons.

## Example

The component renders a table where you can:
- Add new rows for additional items.
- Enter units, quantity, batch, and origin for each item.
- Remove rows as needed.
- See totals update automatically.
- Finalize the process or print labels using the provided buttons.

## Typical Use Case

Use **kv-putaway** in warehouse management systems to record the details of goods as they are stored, ensuring accurate tracking and inventory control.

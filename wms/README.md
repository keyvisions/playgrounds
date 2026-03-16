# Workflow Recap

The recommended workflow for setting up the warehouse system is:

1. **Define Warehouse Structure**
	- Use `<wms-structure-editor>` to create and edit the warehouse structure.
	- Save the structure in `./data/structure.json`.
	- The structure uses a `storageUnits` array describing each unit (vertical/horizontal, prefix, count, bins/slots).

2. **Generate All Possible Locations**
	- Use the structure to generate an exhaustive list of all possible locations.
	- Each location is represented in `locations.json` with a value indicating fullness (null = not used).

3. **Create and Prepare SVG Planimetry**
	- Convert the warehouse DWG planimetry to SVG.
	- Configure storage unit dimensions in `wms-warehouse.js` to match the SVG.
	- Use edit mode to detect, label, and clean up racks in the SVG.
	- Save the cleaned SVG for visualization and labeling.

**Important:**
The `storageUnits` structure in `./data/structure.json` is different from the one in `wms-warehouse.js`. These two need to be merged for consistency across the system.

---

# Planimetry & Visualization: kv-warehouse

`kv-warehouse` is a Web Component used as the warehouse visual frontend for the WMS. It renders an SVG planimetry, supports pan/zoom navigation, and highlights racks according to mode and data sources.

## SVG Preparation Workflow

1. Start from the warehouse DWG planimetry.
2. Convert DWG to SVG and ensure rack sizes are consistent.
3. Configure `StorageUnits` dimensions in `kv-warehouse.js` to match SVG.
4. Use `edit` mode to detect and label racks in the SVG.
5. Save and use the cleaned SVG for visualization and labeling.

## Component Usage

```html
<kv-warehouse
	planimetry="./planimetries/warehouse.svg"
	mode="putaway"
	inventory="./data/inventory.json"
	locations="./data/locations.json"
	data="./data/data.json">
</kv-warehouse>
```

## Attributes & API

- `planimetry`: SVG URL/path
- `mode`: `picking`, `putaway`, `edit`
- `inventory`, `locations`, `data`: JSON URLs/paths

Query string parameters and API parameter forwarding are supported for dynamic filtering and context.

## Data Contracts

See `README2.md` for full details on expected JSON shapes for `inventory`, `locations`, and API interactions.

## Mode Behavior

- **Picking**: Highlights all racks involved in a picking list.
- **Putaway**: Highlights racks for a single partnumber, showing available and selected locations.
- **Edit**: Enables SVG labeling and editing.

## Process Architecture

- Web Component: Orchestration and visualization only.
- API: Business logic, validation, and data consistency.

## Visual Semantics

- `.rack.selected`: Selected by location/partnumber.
- `.rack.available`: Has compatible location for putaway.

## Events

- `svgchange`: Emitted after SVG edit/setup.
# Warehouse Management System (WMS)

This folder contains a modular Warehouse Management System for defining, visualizing, and managing warehouse structures, planimetry, Loading Units (LUs), and the transfer of LUs to bins/slots.

## Features

- **Warehouse Structure Definition**: Interactively define racks, drawers, bins, and slots using a visual editor (`<wms-structure-editor>`). Save and manage the structure in a JSON file for use across the system.
- **Planimetry Visualization**: Render the warehouse layout and locations as tables or grids for easy navigation and planning (`<wms-location>`).
- **Loading Units (LU) Management**: Record, split, and track deliveries into multiple LUs, each with batch, origin, and quantity details (`<wms-putaway>`).
- **LU Transfer**: Move LUs to specific bins/slots, scan locations, and record inventory movements (`<wms-transfer>`).
- **Custom Web Components**: All major features are implemented as reusable web components for easy integration and extension.

## Main Components

### 1. Warehouse Structure Editor
- `<wms-structure-editor src="./data/structure.json">` — Interactive table to add, edit, and remove racks and drawers. Download or manage the warehouse structure JSON.

### 2. Planimetry & Location Viewer
- `<wms-location data="./data/structure.json">` — Visualizes the warehouse layout, showing all racks, drawers, bins, and slots as defined in the structure JSON.

### 3. Loading Unit (LU) Management
- `<wms-putaway ...>` — Dialog for splitting deliveries into LUs, entering batch/origin, and printing labels. Ensures all items are accounted for and traceable.

### 4. LU Transfer
- `<wms-transfer>` — Interface for scanning locations and LUs, and recording the transfer of LUs to specific bins/slots.

## Example Workflow

1. **Define Structure**: Use `<wms-structure-editor>` to create or edit the warehouse structure (racks, drawers, bins, slots). Save as `structure.json`.
2. **Visualize Layout**: Use `<wms-location>` to view the planimetry and confirm the structure visually.
3. **Putaway**: When goods arrive, use `<wms-putaway>` to split the delivery into LUs, print labels, and record details.
4. **Transfer**: Use `<wms-transfer>` to scan and move LUs to their assigned locations in the warehouse.

## Typical Use Cases

- Warehouse setup and reconfiguration
- Inventory intake and putaway
- LU tracking and traceability
- Inventory movement and auditing

## Getting Started

1. Open `index.html` in your browser.
2. Use the structure editor to define your warehouse.
3. Visualize and manage inventory using the provided web components.

---

This system is modular and can be extended for advanced WMS needs, including integration with barcode scanners, ERP systems, and real-time inventory tracking.

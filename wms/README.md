
# Warehouse Management System (WMS)

This folder contains a modular Warehouse Management System for defining, visualizing, and managing warehouse structures, map, Loading Units (LUs), and the transfer of LUs.

## Features

- **Warehouse Structure Definition**: Interactively define racks, drawers, bins, and grids using a visual editor (`<wms-structure>`). Save and manage the structure in a JSON file for use across the system.
- **Map Visualization**: Render the warehouse layout and locations as tables or grids for easy navigation and planning (`<wms-location>`).
- **Loading Units (LU) Management**: Record, split, and track deliveries into multiple LUs, each with batch, origin, and quantity details (`<wms-loading-units>`).
- **LU Transfer**: Move LUs to specific bins/grids, scan locations, and record inventory movements (`<wms-transfer>`).
- **Custom Web Components**: All major features are implemented as reusable web components for easy integration and extension.

## Main Components

- `<wms-structure src="./data/structure.json">` — Interactive table to add, edit, and remove racks and drawers. Download or manage the warehouse structure JSON.
- `<wms-location data="./data/structure.json">` — Visualizes the warehouse layout, showing all racks, drawers, bins, and grids as defined in the structure JSON.
- `<wms-loading-units ...>` — Dialog for splitting deliveries into LUs, entering batch/origin, and printing labels. Ensures all items are accounted for and traceable.
- `<wms-transfer>` — Interface for scanning locations and LUs, and recording the transfer of LUs to specific bins/grids.
- `kv-warehouse` — Visual frontend for SVG map, supports pan/zoom, highlights racks by mode and data sources.

## Example Workflow

1. **Define Structure**: Use `<wms-structure>` to create or edit the warehouse structure (racks, drawers, bins, grids). Save as `structure.json`.
2. **Visualize Layout**: Use `<wms-location>` or `kv-warehouse` to view the map and confirm the structure visually.
3. **Putaway**: When goods arrive, use `<wms-loading-units>` to split the delivery into LUs, print labels, and record details.
4. **Transfer**: Use `<wms-transfer>` to scan and move LUs to their assigned locations in the warehouse.

## Typical Use Cases

- Warehouse setup and reconfiguration
- Inventory intake and put
- LU tracking and traceability
- Inventory movement and auditing

## Getting Started

1. Open `index.html` in your browser.
2. Use the structure editor to define your warehouse.
3. Visualize and manage inventory using the provided web components.

---

This system is modular and can be extended for advanced WMS needs, including integration with barcode scanners, ERP systems, and real-time inventory tracking.

This folder contains a modular Warehouse Management System for defining, visualizing, and managing warehouse structures, map, Loading Units (LUs), and the transfer of LUs to bins/slots.

## Features

- **Warehouse Structure Definition**: Interactively define racks, drawers, bins, and slots using a visual editor (`<wms-structure>`). Save and manage the structure in a JSON file for use across the system.
- **Map Visualization**: Render the warehouse layout and locations as tables or grids for easy navigation and planning (`<wms-location>`).
- **Loading Units (LU) Management**: Record, split, and track deliveries into multiple LUs, each with batch, origin, and quantity details (`<wms-loading-units>`).
- **LU Transfer**: Move LUs to specific bins/slots, scan locations, and record inventory movements (`<wms-transfer>`).
- **Custom Web Components**: All major features are implemented as reusable web components for easy integration and extension.

## Main Components

### 1. Warehouse Structure Editor
- `<wms-structure src="./data/structure.json">` — Interactive table to add, edit, and remove racks and drawers. Download or manage the warehouse structure JSON.

### 2. Map & Location Viewer
- `<wms-location data="./data/structure.json">` — Visualizes the warehouse layout, showing all racks, drawers, bins, and slots as defined in the structure JSON.

### 3. Loading Unit (LU) Management
- `<wms-loading-units ...>` — Dialog for splitting deliveries into LUs, entering batch/origin, and printing labels. Ensures all items are accounted for and traceable.

### 4. LU Transfer
- `<wms-transfer>` — Interface for scanning locations and LUs, and recording the transfer of LUs to specific bins/slots.

## Example Workflow

1. **Define Structure**: Use `<wms-structure>` to create or edit the warehouse structure (racks, drawers, bins, slots). Save as `structure.json`.
2. **Visualize Layout**: Use `<wms-location>` to view the map and confirm the structure visually.
3. **Putaway**: When goods arrive, use `<wms-loading-units>` to split the delivery into LUs, print labels, and record details.
4. **Transfer**: Use `<wms-transfer>` to scan and move LUs to their assigned locations in the warehouse.

## Typical Use Cases

- Warehouse setup and reconfiguration
- Inventory intake and put
- LU tracking and traceability
- Inventory movement and auditing

## Getting Started

1. Open `index.html` in your browser.
2. Use the structure editor to define your warehouse.
3. Visualize and manage inventory using the provided web components.

---

This system is modular and can be extended for advanced WMS needs, including integration with barcode scanners, ERP systems, and real-time inventory tracking.

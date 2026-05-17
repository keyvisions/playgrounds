# Warehouse Management System (WMS)

This README documents the operational workflow of each WMS component currently used in this repo.

## End-to-End Page Workflow (`index.html`)

1. Load mission sample data into hidden input `missiondata`.
2. Load backend base URL from `.data`.
3. Configure `wms-map[inventory]` with backend endpoint.
4. Render connected components:
	- loading units table (`wms-loading-units` instances)
	- put widget (`wms-put`)
	- structure editor (`wms-structure`)
	- map (`wms-map`)
	- mission widget (`wms-mission`)
5. Exchange data through hidden inputs and callback functions.
6. Keep map highlights synchronized with put/pick/mission/structure actions.

## Component Workflows

### `wms-structure` (`wms-structure.js`)

Main flow:

1. Read initial structure from inline JSON or from URL in text content.
2. Render editable/non-editable table depending on `name` attribute.
3. Let user edit `prefix`, `count`, `grid`, `ref` in edit mode.
4. Recompute total locations after each edit.
5. Serialize updated structure into hidden input when `name` is set.
6. If `refmap` is configured, clicking a row highlights related location in map.
7. If `onprint` is configured, clicking barcode icon calls print callback for that row.

Inputs:
- `name` (optional): enables editing + hidden output.
- `refmap` (optional): target map id.
- `onprint` (optional): print callback function name.

Output:
- Hidden input JSON with structure when `name` is provided.

### `wms-map` (`wms-map.js`)

Main flow:

1. Load SVG from `map` attribute or inline SVG content.
2. Initialize navigation (pan/zoom), responsive alignment, and click handling.
3. Resolve highlights from `highlight` attribute and URL query params.
4. In `pick`/`put` mode, fetch inventory data and update highlighted SUs.
5. In `normalize`/edit flow, convert suitable SVG paths to SU rectangles and clean map.
6. On SU click, fetch detailed storage-unit data and open detail dialog.

Inputs:
- `map`: SVG source.
- `mode`: `pick`, `put`, `normalize`.
- `inventory`: endpoint for map highlight data.
- `highlight`: query-like values (`location`, `partnumber`, `lu`).

Output/events:
- Emits `svgchange` when normalized/edit SVG changes.

#### Fundamental SVG Preparation Workflow

Reliable pick/put visualization depends on preparing SVG correctly.

1. Start from warehouse DWG map.
2. Ensure equivalent racks are drawn with consistent size.
3. Convert DWG to SVG: https://anyconv.com/dwg-to-svg-converter/
4. Configure `StorageUnits` dimensions (`w`, `h`) in `wms-map.js` to match real SU geometry.
5. Run map in normalize/edit flow to:
	- detect rectangular paths,
	- convert compatible paths into `<rect class="SU ...">`,
	- classify rack types,
	- remove heavy/noisy artifacts and compute viewport bounds.
6. Save cleaned SVG and replace source SVG.
7. Re-open in edit flow and apply rack labels.

### `wms-loading-units` (`wms-loading-units.js`)

Main flow:

1. Read LU data for row from hidden input (`for`) + `refid`, or fallback from inline content.
2. Render compact summary (`declared/actual` quantities + open dialog icon).
3. Reuse global dialog (`WMSLoadingUnitsDialog`) across all instances.
4. In dialog, user manages rows (`units`, `quantity`, `batch`, `origin`).
5. Rows with positive quantity show barcode action when `onaction` is available.
6. Barcode action calls `onaction` to assign/update `firstLU` for the row.
7. On save, rows with non-positive `units` or `quantity` are dropped.
8. Aggregated LU payload is written back to hidden input (`for`).

Inputs:
- `for`: hidden input id for aggregated LU data.
- `refid`, `itemid`: item-line identity.
- `onaction` (optional): async callback for LU assignment/labels.

Output:
- Hidden input JSON containing LU data for all matching `wms-loading-units[for="..."]`.

### `wms-put` (`wms.js`)

Main flow:

1. User scans or enters a code (location or LU).
2. Component calls `oncheck` to validate code and fetch metadata.
3. Component updates visual feedback and item description.
4. If both LU and location are present, sentiment selector is enabled.
5. User selects sentiment and component sends payload through `onsubmit`.
6. If `refmap` is set, map highlight is synchronized with scanned result.

Inputs:
- `oncheck`: validation callback.
- `onsubmit`: submit callback.
- `refmap` (optional): map id for highlight updates.

### `wms-pick` (`wms.js`)

Main flow:

1. User scans/inputs LU code.
2. Component calls `oncheck` and receives response (`partnumber`, quantity, etc.).
3. User enters picked quantity; left quantity is suggested automatically.
4. Sentiment selector becomes active when code + quantity are available.
5. On sentiment click, component emits `wms-pick-submit` and optionally calls `onsubmit`.
6. It also emits `wms-pick-check` after each successful code check.

Inputs:
- `oncheck`: lookup callback.
- `onsubmit` (optional): submit callback.
- `refmap` (optional): map id for highlight updates.

Outputs/events:
- `wms-pick-check`
- `wms-pick-submit`

### `wms-mission` (`wms-mission.js`)

Main flow:

1. Load mission payload from hidden input (`for`) or inline content.
2. Normalize mission lines and compute availability constraints by partnumber.
3. Render mission table and state controls.
4. State transitions:
	- `working` -> `confirmed`
	- `confirmed` -> `picking`
	- `picking` -> `closed`
5. In `working/confirmed`, user edits `pickQty`.
6. In `picking`, LU scans are handled through embedded `wms-pick`.
7. After each meaningful change, mission JSON is synced to hidden input.
8. Emits lifecycle/update events and optional callbacks.

Inputs:
- `for`: hidden input id containing mission payload.
- `state` (optional): external state override.
- `refmap` (optional): map id for highlights.
- `onchange` (optional): mission change callback.
- `onconfirm` (optional): callback when moved to confirmed state.

Outputs/events:
- Hidden input JSON mission payload.
- `missioninit` event on initial sync.
- `missionchange` event on updates.

## Data Files Used in Demo

- `data/wms-structure.json`
- `data/wms-mission.json`
- `data/wms-inventory.json`
- `media/warehouse.svg`
- `.data` (backend URL bootstrap)

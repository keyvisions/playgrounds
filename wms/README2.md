# kv-warehouse

`kv-warehouse` is a Web Component used as the warehouse visual frontend for the WMS.
It renders an SVG planimetry, supports pan/zoom navigation, and highlights racks according to mode and data sources.

## SVG preparation workflow (fundamental)

`kv-warehouse` depends on a properly prepared warehouse SVG.

Recommended workflow:

1. Start from the warehouse DWG planimetry.
2. Ensure equal racks are drawn with equal sizes in the source drawing.
3. Convert DWG to SVG https://anyconv.com/dwg-to-svg-converter/
4. Configure `StorageUnits` dimensions (`w`, `h`) in `kv-warehouse.js` to match SU sizes in the SVG. The dimensions need to be determined from the resulting SVG by listing all rectangular paths and their counts, then comparing them to the planimetry.
5. Open the component in `edit` mode:
	- it loads the SVG,
	- detects rectangular paths matching configured unit sizes,
	- converts matching paths into `<rect class="SU ...">`,
	- classifies racks by storage-unit type,
	- performs additional SVG cleanup removing extremely complex paths and paths outside of a given boundary, lastly determine the confining viewport.
6. Save the resulting cleaned SVG replacing the original source SVG.
7. Re-open in `edit` mode and label the racks.

This preparation step is required before reliable picking/putaway visualization.

## Component usage

```html
<kv-warehouse
	planimetry="./planimetries/warehouse.svg"
	mode="putaway"
	inventory="./data/inventory.json"
	locations="./data/locations.json"
	data="./data/data.json">
</kv-warehouse>
```

## Attributes

- `planimetry`
	- URL/path of the SVG to render.
- `mode`
	- Supported values: `picking`, `putaway`, `edit`.
	- Startup normalization:
		- if query string has valid `mode`, it overrides the attribute.
		- otherwise invalid/missing mode falls back to `picking`.
- `inventory`
	- JSON URL/path only.
	- In `picking`: used as source to resolve locations from `partnumber` / `lu` rows in `data`.
	- In `putaway`: used to mark racks containing the queried `partnumber`.
- `locations`
	- JSON URL/path only.
	- Used in `putaway` to compute SU availability.
- `data`
	- JSON URL/path only.
	- Used in `picking` mode only.
	- Supported row fields: `location`, `partnumber`, `lu`.

## Query string parameters

The component reads these from the page URL:

- `mode`
- `location`
- `partnumber`
- `lu`
- `size`

Notes:
- `location`, `partnumber`, and `lu` can be comma-separated lists where relevant.
- `size` is parsed as integer and clamped to `1..5`.

## API parameter forwarding

For attributes `inventory`, `locations`, and `data` (URL/path values), the component appends query params to the request.

Forwarded params (when present):

- `mode`
- `location`
- `partnumber`
- `lu`
- `size`

Example page URL:

```text
/warehouse?mode=putaway&location=A0211103,A0211104&partnumber=EA1018D-1E(02)&size=2
```

Generated API calls in `putaway` mode:

```text
GET /api/inventory?mode=putaway&location=A0211103,A0211104&partnumber=EA1018D-1E(02)&size=2
GET /api/locations?mode=putaway&location=A0211103,A0211104&partnumber=EA1018D-1E(02)&size=2
```

## Data contracts

### `inventory`

Minimal expected shape:

```json
[
	{
		"partnumber": "EA1018D-1E(02)",
		"location": "A0211103",
		"lu": "000000009"
	}
]
```

### `locations`

Expected shape:

```json
{
	"A0211103": 3,
	"A0211104": 1
}
```

Availability check in `putaway`:

- `maxAllowedOccupancy = 5 - size`
- location is available if occupancy is numeric in `0..5` and `occupancy <= maxAllowedOccupancy`

## Mode behavior

### `picking`

Picking operates on **many partnumbers at once**. The worker receives a picking list and the component highlights all racks involved, giving an overall picture so the worker can choose a reasonable picking path through the warehouse.

1. Loads `inventory` from its URL/path attribute (if provided).
2. Loads `data` from its URL/path attribute (if provided).
3. For each `data` row:
	- adds `row.location` values directly.
	- if `row.partnumber` and/or `row.lu` are present, matches inventory rows and adds their `location`.
4. Highlights mapped racks with `.selected`.
5. If `data` is absent, falls back to query string `location` list.

### `putaway`

Putaway focuses on a **single partnumber**. The worker asks: "where should this item be stowed?" The component answers by highlighting racks that already contain the same partnumber (`.selected`) and racks that have room for it (`.available`).

1. Loads `inventory` and `locations`.
2. Applies `.selected` to racks containing the queried `partnumber`.
3. Applies `.available` to racks having at least one location compatible with the queried `size`.

#### Size sentiment

In putaway mode a radio group labeled "Dimensione carico" is shown (values 1–5, default 1). The warehouse worker selects how much space the item being put away will occupy. The answer is a **sentiment** — not a precise measurement — reflecting the worker's quick judgment:

| Value | Meaning |
|-------|---------|
| **1** | Very small — fits almost anywhere |
| **2** | Small |
| **3** | Medium |
| **4** | Large |
| **5** | Takes the entire location |

The component uses this value to determine which racks/locations can hold the item:

- `maxAllowedOccupancy = 5 - size`
- A location is **available** if its current occupancy ≤ `maxAllowedOccupancy`.

This means a location already at occupancy 3 can still accept an item with size sentiment 2 (3 + 2 = 5), but not size 3 (3 + 3 > 5). The selected value is also forwarded to the API via the `size` query parameter.

### `edit`

- Enables SU labeling/edit workflow.
- On mode change, `_setup()` is run to normalize/rebuild SVG structures used for editing.

## Process point of view

The recommended architecture is:

- **Web Component = orchestration + visualization**
	- shows candidate racks and bin context.
	- captures operator interactions (navigation, SU inspection, barcode scans).
	- sends intent to API and re-renders from API responses.
- **API = warehouse business logic + data consistency**
	- validates process rules (item identity, allowed destinations, capacity, task state).
	- performs authoritative updates for `inventory` and `locations`.
	- returns updated/filtered datasets for the current operation.

### Putaway process (operator flow)

1. Operator receives putaway list (LUs / partnumbers / constraints).
2. Component highlights involved racks (`selected` / `available`) using API-provided data.
3. Operator moves physically with cart, reaches highlighted SU, inspects slots.
4. Operator scans package barcode (LU or partnumber) and then scans destination location barcode.
5. Component sends the scan event to API (task id + barcode + location + context).
6. API validates and applies transaction atomically:
	- confirms barcode belongs to an open putaway task.
	- confirms location is allowed and can contain required size.
	- updates `inventory` (new placement) and `locations` (new occupancy).
	- marks task line progress/completion.
7. Component refreshes data from API and updates highlighting.

Key rule: the component must not be the source of truth for occupancy or stock; it only reflects API state.

### Picking process (operator flow)

1. Operator receives picking list (locations and/or partnumber/LU constraints).
2. Component highlights racks containing requested items.
3. Operator reaches SU, scans location and/or item depending on procedure.
4. Component sends confirmation to API (task id + scanned values + quantity).
5. API validates and applies transaction atomically:
	- confirms item and source location match open picking line.
	- updates `inventory` (decrement/move) and `locations` occupancy where required.
	- closes or partially closes picking line.
6. Component reloads and refreshes visual state.

### Practical implication for `kv-warehouse`

- Keep it deterministic and side-effect light: render what API says.
- Prefer explicit API endpoints for scan/confirm actions rather than local mutation logic.
- Use server responses as the only trigger for final visual state after each operation.

## Visual semantics

- `.SU.selected`
	- SU selected by location mapping (picking) or partnumber hit (putaway).
- `.SU.available`
	- SU has at least one compatible location for requested putaway size.

## Lifecycle and public API

- Observed attributes: `planimetry`, `inventory`, `locations`, `data`, `mode`.
- `connectedCallback()` normalizes mode and renders component.
- `attributeChangedCallback()` refreshes localization when relevant sources change.
- Public helper: `loadData(url)` fetches JSON and re-localizes using fetched payload.

## Emitted events

- `svgchange`
	- Emitted after SVG setup/edit changes.
	- `detail` contains serialized SVG string.

# [MISER=8] Build 5 Interactive 3D Viz Blocks

Build 5 new `miser-3d-` prefixed EDS blocks. All have real Three.js 3D
interactivity (mouse rotate/zoom). Two visualize actual data in 3D space.
Blocks live at `blocks/miser-3d-<name>/`. Do NOT overwrite any existing block.

---

## Blocks

### 1. `miser-3d-force-graph`
Real data in 3D space. Three.js force-directed graph where nodes and links float
in 3D. Mouse drag rotates the whole graph. Content format: same pipe-delimited
`Source|Target|Weight` lines as `miser-d3-graph` (one per row in block cell).
- CDN: `https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js`
- Orbit controls via inline mini-implementation (no CDN dep for controls)
- Nodes: spheres, color by degree. Links: `THREE.Line`. Labels optional.
- Canvas fills block height (default `420px`, override via `height` field).
- **Constraint**: layout runs N spring iterations then freezes for perf.

### 2. `miser-3d-scatter`
Real data in 3D space. Three.js 3D scatter plot with labelled axes.
Content format: CSV rows `label,x,y,z,color` (first row = header, ignored).
- Axes drawn with `THREE.LineSegments`. Tick marks every 20% of range.
- Points: `THREE.Points` with `THREE.BufferGeometry`. Size controlled by field.
- Mouse orbit + zoom. Tooltip on hover shows label+coords via raycasting.
- Canvas height via field (default `420px`).
- Color defaults to `#0070f3` if column absent.

### 3. `miser-3d-bars`
Isometric 3D bar chart. Three.js box geometries arranged in a grid.
Content format: CSV `category,value,color` (multiline in single cell) or
`row,col,value` for a 2D grid heatmap variant selected by variant field.
- Bars extruded upward from a flat grid plane. Top face slightly lighter shade.
- Axes labels on X and Z edges. Value label floats above each bar.
- Variant field: `bars` (default) or `grid` (heatmap grid, color by value).
- Rotate on drag, zoom on scroll.

### 4. `miser-3d-globe`
Decorative interactive globe with data markers.
Content format: `label|lat|lon|value` lines (one per row).
- Sphere with wireframe overlay (`THREE.WireframeGeometry`). Subtle auto-rotation.
- Markers: small `THREE.SphereGeometry` pins placed at lat/lon positions.
- Color and size of pin driven by `value` (normalized 0-1 scale).
- Drag to rotate, scroll to zoom. Click marker shows label in DOM tooltip.
- Default color scheme field: `blue` | `green` | `amber` | `purple`.

### 5. `miser-3d-orbit`
Decorative 3D orbital / solar-system viz for hierarchy or milestones.
Content format: `label|radius|speed|size|color` lines.
- Central sphere + N orbital rings. Objects travel their ring each frame.
- Rings drawn with `THREE.TorusGeometry`. Satellites are small spheres.
- Auto-rotates slowly. Drag to tilt/spin. Scroll to zoom.
- Labels float above each satellite via projected screen coords.
- Speed is relative (1.0 = default). Set to 0 for a static ring diagram.

---

## File layout per block

```
blocks/miser-3d-<name>/
  miser-3d-<name>.js      # decorate(block) function, Three.js scene
  miser-3d-<name>.css     # .miser-3d-<name> { position:relative; width:100% }
  _miser-3d-<name>.json   # XWalk model (<=4 fields, definitions+models+filters)
```

---

## AEM model constraints (enforced)
- Max 4 fields per model (`xwalk/max-cells` lint rule).
- All JSON files must follow `definitions` + `models` + `filters` schema.
- fj.mcp MUST be used for all `_*.json` files.

### Model field summary

| Block              | Fields (<=4)                                 |
|--------------------|----------------------------------------------|
| miser-3d-force-graph | graphData (text-area), height (text), color (text) |
| miser-3d-scatter   | csvData (text-area), height (text), pointSize (text) |
| miser-3d-bars      | csvData (text-area), height (text), variant (text) |
| miser-3d-globe     | markerData (text-area), color (text), height (text) |
| miser-3d-orbit     | orbitData (text-area), color (text), height (text) |

---

## Demo page

Create `demo/miser-3d-demo.html` with all 5 blocks with sample data:
- force-graph: 6 nodes, 7 links (token cost network, same style as miser-demo-viz)
- scatter: 10 sample points in 3D space with realistic X/Y/Z spread
- bars: 6 categories with values
- globe: 6 data markers at major cities (New York, London, Tokyo, Sydney, etc.)
- orbit: 5 orbital bodies at varying radii and speeds

---

## Build + verify

After all blocks built:
1. `npm run build:json` — must pass (0 errors)
2. `npm run lint` — must pass (0 errors; warnings OK)
3. Verify block dirs exist: `ls blocks/miser-3d-*/`

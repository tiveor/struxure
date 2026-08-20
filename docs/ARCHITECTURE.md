# Architecture

This document maps how the pieces of Struxure fit together — the analysis
pipeline, the design-check dispatch, state, rendering, and import/export.
It's written from the code as of this writing; if something here looks
stale, trust the source files it names over this document.

## The one-paragraph version

Struxure runs entirely in the browser. There is no backend: a model is a
plain JavaScript object held in a Zustand store, the finite element solve
runs in a Web Worker (with a synchronous main-thread fallback), and results
flow into a separate results store that the 3D viewport and the side panels
read independently.

## The analysis pipeline

1. **`src/store/model-store.ts`** holds the editable model — nodes,
   elements, materials, sections, supports, nodal loads, distributed loads.
   Clicking Analyze reads the current model out of this store.

2. **`src/core/solver-manager.ts`** (`SolverManager`) spawns
   `solver.worker.ts` as a module worker and exposes a promise-based
   `solve(model)` API with a progress callback. `SolverManager` itself has
   *no* fallback logic — if the worker rejects, its promise rejects. The
   fallback to a synchronous solve lives in the callers instead: `App.tsx`,
   `src/components/layout/Toolbar.tsx`, and `src/components/mobile/MobileViewer.tsx`
   all follow the same pattern — try `new SolverManager().solve(model)`,
   and on failure catch and call `solveModel(model)` from `src/core/solver.ts`
   directly on the main thread. This same "worker fails → solve synchronously"
   logic is duplicated across three files, several times over within
   `MobileViewer.tsx` alone (its template-load and analyze handlers each
   repeat it), and none of the copies are covered by a test; centralizing
   it inside `SolverManager` — e.g. an internal fallback so callers only
   ever see one code path — would remove the duplication. That's out of
   scope here, but worth flagging for anyone touching this area next.

3. **`src/core/solver.worker.ts`** runs the same pipeline as `solver.ts`
   (assembly → boundary conditions → solve → post-process) but posts
   `progress` messages at each step (`assembly`, `boundaries`, `solving`,
   `postprocess`, `complete`) and a final `result` message, typed as
   `WorkerResponse` in that file.

4. **`src/core/solver.ts`** (`solveModel`) is the direct-stiffness solver:
   assemble the global stiffness matrix and force vector
   (`src/core/assembler.ts`, which builds each element's 12×12 local
   stiffness matrix via `src/core/local-stiffness.ts` and rotates it into
   global coordinates via `src/core/transformation.ts`), apply boundary
   conditions (`src/core/boundary-conditions.ts`), solve `K_ff · u_f = F_f`
   for the free-DOF displacements by matrix inversion (`ml-matrix`), then
   hand off to post-processing.

5. **`src/core/post-processor.ts`** (`postProcess`) computes per-node
   displacements, support reactions (`R = K·u`, restricted to restrained
   DOFs and adjusted for applied nodal loads), and per-element internal
   forces, returning an `AnalysisResults` object.

6. Result flows into **`src/store/results-store.ts`**, which the viewport
   and result panels read.

### The `Map` serialization boundary

This is the single most surprising thing in the pipeline, and the most
likely place for a contributor to get confused.

`AnalysisResults` (defined in `src/core/types.ts`) stores `reactions`,
`elementForces`, and `nodeDisplacements` as `Map<string, ...>`, keyed by
node or element ID. Structured cloning — the mechanism used to pass data
between a Web Worker and the main thread — cannot carry `Map` instances
across that boundary the way the rest of the pipeline expects, so
`solver.worker.ts` flattens them to plain objects before posting the
`result` message:

```ts
// solver.worker.ts
const serializedResults = {
  ...results,
  reactions: Object.fromEntries(results.reactions),
  elementForces: Object.fromEntries(results.elementForces),
  nodeDisplacements: Object.fromEntries(results.nodeDisplacements),
};
```

This flattened shape is typed as `SerializedAnalysisResults` in
`solver.worker.ts`. `solver-manager.ts` rebuilds real `Map`s from it on
receipt, before resolving its promise:

```ts
// solver-manager.ts
const results: AnalysisResults = {
  ...data.results,
  reactions: new Map(Object.entries(data.results.reactions)),
  elementForces: new Map(Object.entries(data.results.elementForces)),
  nodeDisplacements: new Map(Object.entries(data.results.nodeDisplacements)),
};
```

Everything downstream of `SolverManager.solve()` — the results store, the
viewport, the design runner — sees real `Map`s again and doesn't need to
know this happened. The main-thread fallback path (`solveModel` called
directly) never serializes at all, since it never crosses a worker
boundary. If you add a field to `AnalysisResults`, remember it needs to be
added to both the flattening in `solver.worker.ts` and the rebuild in
`solver-manager.ts` if it's ever a `Map`.

## Design checks

**`src/design/design-runner.ts`** (`runDesign`) takes the model and the
`AnalysisResults`, and for each element looks up its material and
dispatches by `material.type`:

- `'steel'` → `designSteelElement` from `src/design/aisc360/index.ts`,
  which runs `tension.ts`, `compression.ts`, `flexure.ts`, and combines the
  axial and flexural ratios via `combined.ts` (P-M interaction).
- `'concrete'` → `designConcreteElement` from `src/design/aci318/index.ts`,
  which treats the element as a column (`columns.ts`) if the axial load
  exceeds `0.1·f'c·Ag`, otherwise as a beam using `flexure.ts` and
  `shear.ts`.

Both paths return a `DesignCheckResult` (`src/design/types.ts`) carrying a
governing demand/capacity (`ratio`) and a `pass`/`fail` `status`. These
results feed `src/store/results-store.ts` as `designResults`, which the
viewport heatmap and the PDF report both consume.

Note: as of this writing, `src/design/aisc360/` and `src/design/aci318/`
have no dedicated validation tests under a `__tests__/` directory — unlike
`src/core/`, which does (`src/core/__tests__/solver.test.ts` and others).
Any new design-check work is a good opportunity to add the validation test
described in [CONTRIBUTING.md](../CONTRIBUTING.md).

## State

Four Zustand stores under `src/store/`, kept separate because they change
independently and for different reasons:

- **`model-store.ts`** — the structural model itself: nodes, elements,
  materials, sections, supports, nodal and distributed loads, plus CRUD
  actions for each. This is the only store that needs to be serialized when
  saving/loading a `.json` model file.
- **`results-store.ts`** — analysis and design output: `analysisResults`,
  `designResults`, solver progress/error state (`isSolving`, `solverStep`,
  `solverProgress`, `analysisError`). **It is not cleared automatically
  when the model is edited.** `clearResults()` is only called from a
  handful of call sites — New, Import (JSON/IFC), an AI-generated model
  load, and template load/switch (`Toolbar.tsx`, `AiSidebar.tsx`,
  `MobileViewer.tsx`) — never from `model-store.ts`'s `updateNode`,
  `updateElement`, `updateMaterial`, or any other mutator. This means
  editing an already-analyzed model (moving a node, changing a section)
  leaves the previous analysis and design results displayed, stale against
  the new geometry, until the user re-runs Analyze. This is a real gap,
  not documented behavior a contributor should assume is intentional.
- **`ui-store.ts`** — view/display state that has nothing to do with the
  model or the analysis: active panel, view mode, render mode, heatmap
  variable/scheme, diagram type/scale, theme, unit system, selection. This
  is what would otherwise cause every model edit to re-render the entire
  viewport chrome if it lived in one store with the model.
- **`chat-store.ts`** — the AI assistant panel (`src/components/chat/`):
  chat history and local/online model settings, persisted to
  `localStorage` separately from everything else.

## Rendering

`src/components/viewport/Viewport3D.tsx` is the root of the React Three
Fiber tree, wiring together `NodeMesh.tsx`, `ElementMesh.tsx`,
`SupportMesh.tsx`, `LoadArrows.tsx`, `DeformedShape.tsx`, and
`ForceDiagram3D.tsx` inside a drei `Canvas`/`OrbitControls` setup, and
owning the display-settings UI (heatmap variable/scheme, diagram
type/scale, render mode, grid, labels, animation controls).

- **Element geometry** is built in `ElementMesh.tsx`: each element's
  midpoint and orientation come from its two nodes (`elementGeometry`,
  `useMemo`), and in "sections" render mode an extruded 3D cross-section
  is generated from the section profile (`extrudeGeo`, via
  `SectionShapes.ts` / `section-to-shape.ts`) instead of a plain
  wireframe cylinder.
- **The heatmap** value per element comes from `getSchemeColor` /
  `normalizeValue` in `src/utils/color-ramp.ts`. **This normalizes
  relative to the current model's own min/max**, not to fixed thresholds:
  `ElementMesh.tsx` collects the heatmap value for every element, takes
  `Math.min`/`Math.max` across them, and maps each element's value into
  that range before coloring it. That means the reddest element in the
  viewport is only the worst-utilized element *in this particular model*
  — not necessarily a failing one. This gap is already called out for end
  users in `docs/quick-start.md`.

  `getDesignColor()` — a fixed four-band D/C scale (≤0.50 green, 0.50–0.75
  yellow, 0.75–1.00 orange, >1.00 red), exported from
  `src/utils/color-ramp.ts` as `getDesignColor()` / `DESIGN_BANDS` — is used
  by an `else if (viewMode === 'design')` branch in `ElementMesh.tsx` that
  is checked **before** the heatmap branch above, so it takes precedence
  whenever `viewMode` is `'design'`. In the whole codebase the only call
  that sets `viewMode` to `'design'` is `report-generator.ts`, when it
  switches the view to capture the report's embedded 3D screenshot (the
  very next lines of that same function also set `heatmapVariable` to
  `'dc_ratio'`, but the branch order means the design check wins). The live
  viewport's toolbar only ever sets `viewMode` to `'model'` or `'moment'`,
  so this ordering has no effect on what a user sees interactively — the
  on-screen heatmap stays relative to the current model's min/max, as
  described above. Only the report's captured screenshot renders with the
  absolute four-band scale, and the report draws a matching colour key
  (`addDesignColorLegend` in `report-generator.ts`, sourced from the same
  `DESIGN_BANDS` constant) directly below the image, since the on-screen
  `ColorLegend` DOM overlay is not part of the captured canvas. The PDF's
  own **Design Checks table** (a separate part of the report, not the
  screenshot) uses neither scale — it colors the Status column (`FAIL`
  red/bold, `PASS` green) and the D/C Ratio column (red/bold above 1.0,
  amber above 0.9, default otherwise) directly in `report-generator.ts`,
  independent of `ElementMesh.tsx` entirely.
- **Force diagrams** (`ForceDiagram3D.tsx`) pull per-element end forces out
  of `analysisResults.elementForces`, distribute them along the element
  span via `src/core/internal-forces-distribution.ts`, and scale the
  offset by `diagramScale` from `ui-store.ts`.

## Import and export

- **DXF import** — `src/utils/dxf-import.ts` (via the `dxf-parser`
  package), converting DXF entities into nodes and frame elements.
- **IFC import** — `src/utils/ifc-import.ts` (via `web-ifc`, the C++/WASM
  IFC parser), reading geometry and profile data into the structural
  model; profile mapping lives in `src/utils/ifc-profiles.ts`.
- **IFC export** — `src/utils/ifc-export.ts`, writing analysis results back
  out as IFC.
- **PDF report** — `src/utils/report-generator.ts` (via `jspdf` /
  `jspdf-autotable`), producing the design/results report with the fixed
  D/C color bands described above.
- **JSON model** — `src/utils/export.ts` (`exportModelJSON`), a full dump
  of the model store for save/load round-trips.
- **CSV results** — `src/utils/export.ts` (`exportResultsCSV`), displacements,
  reactions, and internal forces.

## Testing

Tests live alongside the code they cover, in `__tests__/` directories:
`src/core/__tests__/`, `src/data/__tests__/`, `src/utils/__tests__/`, and
`src/components/viewport/__tests__/`. All run under Vitest via `pnpm test`.

A validation test — required for any change to `src/core/` or
`src/design/`, see [CONTRIBUTING.md](../CONTRIBUTING.md#the-rule-that-matters-most)
— states its source (a closed-form solution, a cited textbook example, or a
fully reproduced hand calculation) in a comment, then asserts against it
with an explicit tolerance (`toBeCloseTo`, not exact equality).
`src/core/__tests__/solver.test.ts` is the canonical example of this
pattern in the codebase; new validation tests should follow it.

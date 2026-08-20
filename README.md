# Struxure

[![CI](https://github.com/tiveor/struxure/actions/workflows/ci.yml/badge.svg)](https://github.com/tiveor/struxure/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

3D Structural Finite Element Analysis (FEA) engine with integrated design checks, running 100% in the browser.

Struxure lets you model, analyze, and verify bar-type structures (beams, columns, braces, trusses) with no backend or software installation required.

> **For education and preliminary design only.** Struxure's results are not
> independently verified and are not a substitute for review by a licensed
> professional engineer. It is provided without warranty of any kind — see
> [LICENSE](LICENSE) and [NOTICE](NOTICE).

[Leer en Espanol](README.es.md)

## Features

### Modeling
- **Interactive 3D modeling** — Create and edit nodes, elements, supports, and loads with real-time visualization via Three.js
- **Multi-material support** — Steel (A992) and concrete with full property definitions
- **AISC section library** — Searchable database of W, HSS, and Pipe sections with auto-populated properties
- **8 built-in templates** — Simple beam, cantilever, portal frame, Warren truss, parabolic arch, 3D building, and Eiffel Tower (88-element 3D lattice)
- **DXF import** — Drag-and-drop AutoCAD `.dxf` files to import geometry
- **IFC (BIM) import** — Drag-and-drop `.ifc` files with dual strategy: analytical model preferred, physical elements fallback

### Analysis
- **Linear static analysis** — Direct stiffness method with 3D frame elements (12x12 stiffness matrix)
- **Web Worker solver** — Non-blocking analysis runs in a background thread with progress feedback
- **Cancellable operations** — Cancel long-running analyses at any time

### Visualization
- **3D force diagrams** — Moment (M3), shear (V2), and axial (N) ribbon diagrams with adjustable scale
- **Heatmaps** — Color-coded elements by D/C ratio, displacement, axial stress, or combined stress (Jet, Thermal, Blue-Red schemes)
- **Animated deformed shape** — Oscillate, pulse, or progressive animation modes with speed control
- **3D section rendering** — Toggle between wireframe and 3D extruded section views
- **Viewport controls** — Orbit, pan, zoom extents, and grid toggle

### Design Checks
- **AISC 360 (Steel)** — Tension (Ch. D), Compression (Ch. E), Flexure (Ch. F), Combined P-M interaction (Ch. H)
- **ACI 318 (Concrete)** — Beam flexure (Whitney block), Shear (Vc + Vs), Columns (simplified P-M interaction)
- **D/C ratio visualization** — Elements color-coded by demand/capacity ratio

### Export
- **JSON** — Save and reload complete structural models
- **CSV** — Export analysis results (displacements, reactions, element forces)
- **PDF reports** — Professional reports with cover page, project info, tables, screenshot, and color-coded design checks
- **IFC export** — Export model + results to IFC4 format with IfcStructuralAnalysisModel, boundary conditions, and reactions

## Built-in Templates

| Template | Type | Description |
|----------|------|-------------|
| Simple Beam | 2D | Simply supported beam with center load |
| Cantilever | 2D | Fixed-free beam with tip load |
| Portal Frame | 2D | 3-bay, 2-story moment frame |
| Truss Bridge | 2D | Warren truss with diagonal web members |
| Parabolic Arch | 2D | Two-hinged arch under gravity loads |
| 3D Building | 3D | 2x2 bay, 3-story space frame with wind |
| **Eiffel Tower** | 3D | 25-node, 88-element lattice tower with X-bracing |
| **Cristo de la Concordia** | 3D | 35-node statue frame with arms — Cochabamba, Bolivia |

## Stack

| Layer | Technology |
|---|---|
| UI | React 19 + TypeScript |
| Bundler | Vite 7 |
| Styling | Tailwind CSS 4 |
| 3D | Three.js + React Three Fiber + Drei |
| FEA Engine | Pure TypeScript (main thread + Web Worker) |
| Linear Algebra | ml-matrix |
| State | Zustand |
| PDF | jsPDF + jspdf-autotable |
| BIM/IFC | web-ifc (C++ WASM) |
| Persistence | IndexedDB (idb) |
| Analytics | Umami, opt-in via `VITE_UMAMI_ID` (privacy-first, cookieless) |

## Quick Start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173/struxure/` in your browser (Vite serves the app under the `/struxure/` base path configured in `vite.config.ts`).

For a step-by-step guide on creating your first model, see the [Quick Start Guide](docs/quick-start.md).

## Available Scripts

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm typecheck    # Type-check with tsc
pnpm test         # Run tests
pnpm test:watch   # Tests in watch mode
pnpm lint         # Linting with ESLint
pnpm preview      # Preview production build
pnpm deploy       # Build and deploy to GitHub Pages
```

## Architecture

```
src/
├── core/           # FEA engine (no UI dependencies)
│   ├── local-stiffness.ts      # 12x12 local stiffness matrix
│   ├── transformation.ts       # 3D coordinate transformation
│   ├── assembler.ts            # Global stiffness assembly
│   ├── boundary-conditions.ts  # Boundary conditions
│   ├── solver.ts               # Solve K·u = F
│   ├── solver.worker.ts        # Web Worker for non-blocking analysis
│   ├── solver-manager.ts       # Spawns the solver Web Worker; no fallback of its own (see docs/ARCHITECTURE.md)
│   └── post-processor.ts       # Internal forces and reactions
├── data/           # AISC section database
├── design/         # Design verification
│   ├── aisc360/    # Steel: tension, compression, flexure, combined
│   └── aci318/     # Concrete: flexure, shear, columns
├── components/     # React UI
│   ├── viewport/   # 3D visualization (meshes, diagrams, heatmaps)
│   ├── panels/     # Model editors (nodes, elements, materials, sections)
│   ├── shared/     # Dialogs (report, IFC import, analysis progress)
│   ├── layout/     # Sidebar, toolbar, status bar, results bar
│   ├── chat/       # AI assistant sidebar (local LM Studio or online model)
│   └── mobile/     # Mobile viewer and install prompt
├── store/          # Global state (Zustand)
└── utils/          # Templates, export, DXF/IFC import, color ramp, animation
```

## Analytics

Struxure ships with **no analytics enabled**. Nothing is sent from a fork, a self-hosted instance, or local development.

The maintainer's own deployment at [alvarotech.dev/struxure](https://alvarotech.dev/struxure/) sets `VITE_UMAMI_ID` in its build environment to enable [Umami](https://umami.is/) — privacy-first and cookieless, no personal data, GDPR-compliant.

You can enable it on your own deployment by setting `VITE_UMAMI_ID` (see [`.env.example`](./.env.example)). If you self-host Umami, `VITE_UMAMI_SRC` lets you point at your own script URL.

### Tracked Events (when analytics are enabled)

| Event | Description | Properties |
|-------|-------------|------------|
| `analyze` | User runs structural analysis | — |
| `template_load` | User loads a built-in template | `{ template }` |
| `open_file` | User opens a saved .json model | — |
| `results_tab` | User switches to Results view | — |
| `results_switch` | User switches result sub-tab | `{ tab: shear/moment/deflection }` |
| `export_pdf` | User generates a PDF report | — |
| `export_ifc` | User exports to IFC format | — |
| `animation_play` | User plays deformed shape animation | — |

All events go through `track()` in `src/utils/analytics.ts`, which checks `typeof umami` before calling and swallows any error from the script. The app works normally when analytics are disabled, when the script is blocked, or when it fails to load. Note that `umami?.track()` would *not* be safe here: optional chaining guards a `null`/`undefined` value, but throws `ReferenceError` when the binding was never declared.

## Limitations

- Bar-type (3D frame) elements only
- Linear static analysis only
- ~200 nodes recommended maximum
- No dynamic, modal, or P-Delta analysis
- Imperial units (kips, inches, ksi)

See [ROADMAP.md](ROADMAP.md) for planned features and how these limitations are expected to be addressed.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), which
covers the development setup, the commit conventions, and the validation-test
requirement for changes to the solver or the design checks.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open a
public issue for security problems.

## Authors

Built by **Alvaro Orellana** ([alvarotech.dev](https://alvarotech.dev)) with
**Claude Code**.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the
full text and [NOTICE](NOTICE) for attribution and standards disclaimers.

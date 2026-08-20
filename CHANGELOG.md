# Changelog

## v0.3.0
- Apache-2.0 license, NOTICE, SECURITY policy and Code of Conduct
- CONTRIBUTING guide with a validation-test requirement for solver and design changes
- Continuous integration running lint, typecheck, tests and build
- Public roadmap and architecture documentation
- Engineering disclaimer in the About dialog and both READMEs
- Analytics are now opt-in through `VITE_UMAMI_ID` and are disabled by default
- The About dialog is a single shared component across desktop and mobile
- Fix: pnpm 11 no longer skips the esbuild and core-js build scripts
- Fix: all TypeScript and ESLint errors across the codebase
- Fix: analytics calls no longer throw when the script is absent — `umami?.track()`
  raised `ReferenceError` because optional chaining guards a value, not an
  undeclared binding. All events now go through a `typeof`-guarded `track()` helper.
- Fix: the PDF report's 3D screenshot now colors elements by the absolute
  four-band D/C scale instead of the viewport's model-relative gradient, so a
  failing element is unambiguous without knowing the model's own min/max — the
  report also prints a matching colour key below the image.

## v0.2.7
- PWA support: installable as app on mobile (manifest, service worker, icons)
- Mobile install prompt with iOS "Add to Home Screen" instructions and Android native install
- About dialog on mobile with version, credits, and tech stack (info button in header)
- New isometric 3D building favicon and app icons with color-coded structural levels

## v0.2.6
- AI chat sidebar — describe structures in natural language, generate 3D models
- LM Studio integration (local LLM, OpenAI-compatible API)
- Collapsible right sidebar with 3 tabs: Local, Online, Settings
- Auto-analyze generated models with design checks
- Conversational follow-ups to modify existing models
- URL-based template loading with auto-analyze (`?t=eiffel-tower`)
- Example prompt chips for quick-start
- Online tab supports OpenRouter, Together, Groq, OpenAI (any OpenAI-compatible API)
- Fix: Test Connection now requires API key for online providers (prevents false positives)
- Fix: Validate OpenRouter API keys via auth endpoint
- Auto-expanding chat textarea (up to 5 lines)

## v0.2.5
- Mobile 3D viewer replaces "desktop required" gate — touch rotate, zoom, pan
- Cycle through featured templates (Eiffel Tower, Cristo, Portal Frame) on mobile
- Run structural analysis directly from mobile with full solver support
- Toggle deformed shape, D/C ratio heatmap, and 3D sections on mobile
- Version display in mobile footer

## v0.2.4
- 3D viewport screenshot tool (captures scene with background and gizmo axis)

## v0.2.3
- Collapsible/expandable Display Settings panel with chevron toggle
- Export filenames use "Structural Analysis - {name}" format (JSON, CSV, IFC, PDF)
- Heatmap legend moved to bottom-left, shortened labels to fit container
- Eiffel Tower template description updated

## v0.2.2
- 6 UI color themes (Midnight, Forest, Ember, Orchid, Arctic, Rosewood) with light/dark modes
- Material library with ASTM steel grades and ACI concrete grades
- Distributed loads UI (Nodal/Distributed tabs in Load Editor)
- Unified Node Editor with add/edit form (matching Element Editor pattern)
- Auto-switch sidebar tabs when selecting nodes/elements in 3D viewport
- Click-outside-to-deselect in 3D viewport
- Custom Struxure favicon
- About dialog link to portfolio

## v0.2.1
- Unit system switcher (Imperial/Metric) with persistence
- Functional Results Bar tabs (Summary, Displacements, Reactions, Forces, Design Checks)
- UX polish and minor fixes

## v0.2.0
- Collapsible sidebar
- Mobile gate (desktop-only notice)
- Design screenshot export
- Tooltips on toolbar buttons
- 7 built-in templates with template picker
- Comprehensive documentation

## v0.1.0
- IFC (BIM) import/export with web-ifc WASM engine
- Professional PDF report export with cover page and tables
- AISC steel section library with searchable database
- Web Worker solver for non-blocking analysis
- 3D internal force diagrams with ribbon visualization
- DXF file import with drag-and-drop
- Stress heatmap visualization with colormap schemes
- Extruded 3D cross-sections for structural elements
- Animated 3D deformation visualization

## v0.0.1
- Initial MVP: 3D structural FEA with React, Three.js, and Vite
- Node/element/support/load editors
- Direct stiffness method solver (6 DOF per node)
- AISC 360 design checks
- JSON/CSV export

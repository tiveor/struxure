# Changelog

## Unreleased

### Fixed

- **Vertical columns bent about their weak axis (#66).** With beta = 0, a
  vertical member in an XY frame bent in plane about Iy, and members within
  about 2.56° of vertical switched axis convention. Local z is now global +Z
  for every member in the XY plane, so columns bend in plane about Ix like
  beams. **Results of models with vertical members change**: re-run them. Use
  beta = 90 for a column that is meant to bend about its weak axis.
- The 3D view draws each section with the analysis local axes and beta, so
  I-shapes in a plane frame show their web in the plane. Force diagrams are
  drawn along each member's local y, and the combined stress heatmap uses the
  strong-axis moment instead of the weak-axis one.

## v0.3.1

The concrete design checks were wrong. Writing the validation tests that
`CONTRIBUTING.md` has always required for `src/design/` surfaced two unit-scaling
defects, both from ACI expressions that take f'c and fy in psi while models here
carry f'c in ksi. **Any concrete result from v0.3.0 or earlier should be
re-run.** The steel checks needed no correction.

### Fixed

- **ACI 318 minimum flexural steel was 1000x too large.** `As,min` applied a
  stray factor of 1000 to the `200/fy * bw * d` expression, so every concrete
  beam was reported as failing with an impossible required steel area — 860 in²
  on a 12x24.
- **ACI 318 concrete shear capacity was ~31.6x too high.** `Vc` used
  `2*sqrt(f'c)` with f'c in ksi, but the ACI expression takes psi and returns
  pounds, dropping a factor of sqrt(1000). Concrete shear effectively never
  governed: 500 kips on a 12x24 passed at D/C 0.65 against a real phi*Vc of
  24.5 kips. The `Vs,max` limit had the same slip.
- **The AI assistant matched providers by substring**, so an endpoint merely
  containing `openrouter.ai` — `https://host.example.com/v1?note=openrouter.ai`,
  or `https://openrouter.ai.example.com/v1` — was treated as OpenRouter, and the
  user's API key was forwarded there for verification even when it belonged to a
  different provider. All provider detection now compares the parsed hostname.
- Analysis and design results are no longer left on screen after the model is
  edited; any structural change now invalidates them (#3).
- The service worker cache is versioned per release. It previously used a fixed
  name that its own eviction logic could never clear, so returning visitors kept
  being served the previous build's assets.
- Removed the `deploy` script, which invoked a `deploy.sh` absent from this
  repository and so failed for everyone but the maintainer.

### Added

- `docs/validation.md`, stating which checks are verified against a published
  reference and which are not — including the caveat that the ACI column check
  assumes 1% reinforcement rather than analysing the actual bars.
- Validation suites for AISC 360 and ACI 318: tension, compression and flexure
  against AISC Manual (15th ed.) Tables 5-1, 4-1 and 3-2, and ACI 318-19 §9.6.1.2,
  §22.2 and Eq. 22.5.5.1 worked by hand. Reverting either concrete fix above now
  fails 9 of the 20 ACI tests.
- Screenshots and a hero animation of the app running, in the README and the
  quick-start guide, and a live-demo link above the fold.
- A social preview image, plus Open Graph, Twitter Card and canonical metadata —
  links to the app previously rendered as bare text everywhere they were shared.
- Component tests: a file opts into a DOM with `// @vitest-environment jsdom`
  and renders through `@testing-library/react`. Previously impossible.
- `eslint-plugin-jsx-a11y`, Dependabot, CodeQL scanning and CODEOWNERS.

### Changed

- Modal dialogs are announced as dialogs, named by their heading, and close on
  Escape; icon-only viewport controls and mobile tabs and toggles now expose
  their name and selected state.
- The analysis pipeline lives in one `runAnalysis()` helper instead of five
  near-identical copies, so a failure is reported the same way wherever it
  happens (#6).
- Dependencies: three.js 0.182 → 0.185, React 19.2.0 → 19.2.8, Vite 7 → 8,
  ESLint 9 → 10, and the GitHub Actions used by CI. Vitest is held at 4 pending
  an upstream jest-dom fix (#21).

Test suite: 248 → 345.

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

# Roadmap

Struxure is developed in the open. This page lists what is planned, not what is
promised — dates are deliberately absent.

## Shipped

The current feature set (see [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md) for detail):

- Interactive 3D [modeling](README.md#modeling) — nodes, elements, supports, and loads, with real-time Three.js visualization
- Steel (A992) and concrete materials, with a searchable AISC section library (W, HSS, Pipe)
- 8 built-in templates, from a simple beam to a 3D lattice tower
- DXF import and IFC (BIM) import/export
- Linear static [analysis](README.md#analysis) via the direct stiffness method, running in a cancellable Web Worker so the UI stays responsive
- [Visualization](README.md#visualization): 3D force diagrams, D/C ratio and stress heatmaps, animated deformed shapes, extruded 3D section rendering
- [Design checks](README.md#design-checks): AISC 360 (tension, compression, flexure, combined P-M) and ACI 318 (beam flexure, shear, columns)
- JSON/CSV [export](README.md#export) and PDF report generation
- An AI Assistant that generates models from natural-language descriptions, against a local (LM Studio) or online (OpenAI-compatible) LLM — see [docs/ai-assistant.md](docs/ai-assistant.md)
- Imperial/metric display unit switcher, multiple UI themes, and PWA installability

## Next

- Timoshenko (shear-deformable) beam formulation, for short or deep members where Euler-Bernoulli assumptions break down
- Broader AISC 360 chapter coverage in the design checks (shear, HSS-specific provisions)
- A sparse, factorization-based solver to replace the current dense matrix inversion, raising the practical node-count ceiling
- Expanded automated test coverage against textbook and benchmark solutions

## Under consideration

These are larger directions with open design questions rather than committed work. If one of these matters to you, please open an issue to discuss the approach before sending a pull request — some of them (a solver rewrite, a new element type) touch core architecture and are worth agreeing on a design first.

- P-Delta / second-order geometric analysis
- Modal (eigenvalue) analysis, as a foundation for response-spectrum seismic analysis
- Shell/plate elements, for slabs and shear walls
- Automated load-case combinations per a selectable building code
- Automated wind/snow load generation

## Known limitations

- Bar-type (3D frame) elements only — no shells or plates
- Linear static analysis only — no P-Delta or other second-order effects
- No modal or dynamic analysis
- No automated load combinations — combinations are built and analyzed manually
- ~200 nodes recommended maximum; the solver factors a dense stiffness matrix rather than a sparse one
- Model data is entered and stored in imperial units (kips, inches, ksi); the metric option only converts values for display

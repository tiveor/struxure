# Quick Start Guide — STRUXURE MVP

## Prerequisites

- Node.js 22.13 or newer (pnpm 11 requires it)
- pnpm (`npm install -g pnpm`)

## Installation

```bash
cd struxure
pnpm install
pnpm dev
```

Open `http://localhost:5173/struxure/` in your browser (Vite serves the app under the `/struxure/` base path configured in `vite.config.ts`).

## Your first model in 60 seconds

### Quick option: load a template

1. Click **Templates** in the top bar
2. Load the Portal Frame template — a 3-bay, 2-story steel moment frame with loads already applied
3. Click **Analyze** to run the analysis (design checks run automatically alongside it)
4. Open **Display Settings** (top right of the viewport) and set **Heatmap** to **D/C Ratio** to see the elements colored by AISC 360 demand/capacity ratio

### Manual option: build a model step by step

#### 1. Define nodes

In the side panel, **Nodes** tab:

| ID | X   | Y   | Z |
|----|-----|-----|---|
| A  | 0   | 0   | 0 |
| B  | 0   | 144 | 0 |
| C  | 240 | 144 | 0 |
| D  | 240 | 0   | 0 |

> Coordinates are in inches. 144 in = 12 ft, 240 in = 20 ft.

#### 2. Define elements

**Elements** tab — connect the nodes:

| Element | Node I | Node J | Material    | Section |
|---------|--------|--------|-------------|---------|
| C1      | A      | B      | A992 Steel  | W10x49  |
| B1      | B      | C      | A992 Steel  | W12x26  |
| C2      | D      | C      | A992 Steel  | W10x49  |

This creates a simple portal frame: two columns and a beam.

#### 3. Define supports

**Supports** tab:

- Node **A** → Fixed
- Node **D** → Fixed

#### 4. Apply loads

**Loads** tab:

- Node **B**: Fy = **-20** kips (downward gravity load)
- Node **C**: Fy = **-20** kips
- Node **B**: Fx = **5** kips (lateral load)

> Sign convention: positive Y = up, positive X = right.

#### 5. Analyze

Click **Analyze**. Results appear in:

- The **Results** tab of the side panel (table of displacements, reactions, and internal forces)
- The **Results** toggle in the top bar (3D deformed shape, scaled up)

#### 6. Design

Design checks are computed automatically as part of Analyze. **Display Settings → Heatmap → D/C Ratio** in the viewport colors elements with a continuous gradient, scaled between the lowest and highest D/C ratio *found in the current model* — the legend just shows Min/Max, not fixed thresholds. That means the reddest element is only the most utilized one in this particular model, not necessarily one that fails: a model where every element is well within capacity still renders its worst element red. For the exact ratio and a pass/fail verdict per element, open the **Results** tab and check the **Design Results (D/C)** table, which lists each element's D/C ratio and a PASS/FAIL badge.

The PDF report (the report icon next to Analyze, once a model is analyzed) does **not** use that same relative gradient in its **Design Checks table**: the Status column colors `FAIL` red and bold, `PASS` green; the D/C Ratio column colors a ratio above 1.0 red and bold, above 0.9 amber, and leaves everything else the default color — there's no 0.50 or 0.75 breakpoint. The embedded 3D screenshot elsewhere in the report is different: it uses the fixed four-band absolute scale (≤0.50 green, 0.50–0.75 yellow, 0.75–1.00 orange, >1.00 red), not the live viewport's relative gradient, so a failing element is unambiguous at a glance even without knowing the model's own min/max range — a compact colour key is printed directly below the image for reference. The live viewport heatmap itself is unchanged and stays relative, as described above. The **Design Results (D/C)** table in the Results tab (mentioned above) remains the one place with an exact per-element ratio and PASS/FAIL verdict.

## Available views

The top bar has a **Model / Results** toggle. Once a model is analyzed, switching to **Results** shows the 3D deformed shape; the **Display Settings** panel (top right of the viewport) controls what else is drawn on top of it:

- **Heatmap** — color elements by **D/C Ratio**, **Displacement**, **Axial Stress**, or **Combined Stress**
- **Diagram** — overlay a **Moment (M3)**, **Shear (V2)**, or **Axial (N)** force diagram, with an adjustable scale
- **3D Sections** — toggle between wireframe and extruded 3D cross-sections
- **Deformations** / **Shear Moment** / **Node IDs** — additional display checkboxes

When the deformed shape is visible, animation controls (Oscillate, Pulse, Progressive) appear at the bottom of the viewport.

## 3D viewport controls

- **Left-click + drag** — Rotate the view
- **Scroll** — Zoom in/out
- **Right-click + drag** — Pan
- **Click a node/element** — Select it for editing

## Predefined materials

| Material           | E (ksi) | Fy/f'c | Design code |
|---------------------|---------|--------|-------------|
| A992 Steel          | 29,000  | 50 ksi | AISC 360    |
| f'c=4000 Concrete   | 3,605   | 4 ksi  | ACI 318     |

You can add custom materials in the **Materials** tab.

## Predefined sections

The model ships with **W12x26** as the default section. You can:

- Add custom sections in the **Sections** tab (by entering A, Ix, Iy, J)
- Use the template's sections (W12x26 for beams, W10x49 for columns)

## Exporting results

- **Save** — Downloads the complete model as a `.json` file
- **Open** — Loads a model from a `.json` file
- **Export CSV** — Downloads displacements, reactions, and internal forces as CSV

## Included design checks

### Steel (AISC 360)

| Check      | Chapter | What it verifies                    |
|------------|---------|--------------------------------------|
| Tension    | D       | Yielding of gross section            |
| Compression| E       | Flexural buckling (Euler)            |
| Flexure    | F       | Yielding + lateral-torsional buckling|
| Combined   | H       | P-M interaction (Eq. H1-1a/b)        |

### Concrete (ACI 318)

| Check        | What it verifies                          |
|--------------|---------------------------------------------|
| Beam flexure | Required As (Whitney stress block)          |
| Beam shear   | Vu ≤ φ(Vc + Vs), stirrups required          |
| Columns      | Simplified P-M interaction diagram          |

## Useful commands

```bash
pnpm dev          # Development server (localhost:5173/struxure/)
pnpm build        # Production build
pnpm test         # Run the FEA engine tests
pnpm test:watch   # Tests in watch mode
pnpm preview      # Preview of the production build
```

## MVP Limitations

- Bar-type elements only (3D frame) — no shells or plates
- Linear static analysis only
- Recommended maximum: ~200 nodes (browser performance)
- No dynamic, modal, or P-Delta analysis
- Imperial units (kips, inches, ksi)

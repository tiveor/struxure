# Validation

Struxure is only useful if its numbers are right. This page states what has been
checked against an independent reference, what has only been checked for
internal consistency, and what has not been checked at all.

Please read it before trusting a result, and read the disclaimer in
[NOTICE](../NOTICE): this project is for education and preliminary design, and
is not a substitute for review by a licensed professional engineer.

## How to read this

- **Validated** — compared against a value from a published table or a
  closed-form solution worked independently of this code.
- **Self-consistent** — internal relationships are tested (monotonicity, sign
  handling, boundaries between code equations), but no external reference
  fixes the absolute magnitude.
- **Unverified** — no automated test.

Every claim below is backed by a test in [`src/design/__tests__/`](../src/design/__tests__/)
and [`src/core/__tests__/`](../src/core/__tests__/). Run them with `pnpm test`.

## Design checks

Every check returns the capacity it used alongside the D/C ratio, so the
references below are asserted against that capacity directly rather than
inferred by feeding in a demand and reading the ratio back.

| Check | Reference | Status |
|---|---|---|
| AISC 360 Ch. D — tension yielding | AISC Manual (15th ed.) Table 5-1: W12x26, Fy 50 → φPn = 344 kips | Validated |
| AISC 360 Ch. E — compression | AISC Manual Table 4-1: W10x49, KL = 14 ft → φcPn = 471 kips; both Eq. E3-2 and E3-3 branches | Validated |
| AISC 360 Ch. F — flexure | AISC Manual Table 3-2: W18x50, Fy 50 → φbMp = 379 kip-ft, Lp = 5.83 ft | Validated at Lb ≤ Lp |
| AISC 360 Ch. F — LTB beyond Lp | — | Self-consistent (monotonic decrease, capped at Mp) |
| AISC 360 Ch. H — P-M interaction | Eq. H1-1a / H1-1b, including the Pr/Pc = 0.2 switch | Validated |
| ACI 318 — beam flexure | ACI 318-19 §22.2 Whitney block and §9.6.1.2 minimum steel, worked by hand for a 12x24 with f'c = 4 ksi | Validated |
| ACI 318 — beam shear | ACI 318-19 Eq. 22.5.5.1 (Vc) and §22.5.1.2 (Vs limit) | Validated |
| ACI 318 — columns with reinforcement, P-M interaction | Strain compatibility per ACI 318-19 22.2 (Whitney block, β1 per Table 22.2.2.4.3, εcu = 0.003, Es = 29000 ksi), φ per Table 21.2.2, Pn,max = 0.80 Po (22.4.2.1). Two hand calculations reproduced in full in the test: 16x16 with 8 #8, f'c = 4 ksi (Po = 1228.1 kips, φPn,max = 638.6 kips, balanced φPn = 237.8 kips / φMn = 2118.7 kip-in, pure bending φMn = 2043.2 kip-in, φPnt = 341.3 kips) and 12x20 with 6 #9, f'c = 5 ksi (β1 = 0.80; Po = 1354.5 kips, balanced Pn = 411.3 kips / Mn = 5103.1 kip-in, pure bending φMn = 2585.9 kip-in, φPnt = 324 kips) | Validated |
| ACI 318 — columns with reinforcement, φ transition | Table 21.2.2 at εt = εty, εty + 0.003 and in between (e.g. εt = 0.005 → φ = 0.894) | Validated |
| ACI 318 — columns with reinforcement, D/C ratio | Radial ratio to the φ curve; checked at points on the curve (D/C = 1), along a ray (0.5, 2) and at the pure axial and pure bending ends | Validated against the diagram above |
| ACI 318 — columns with reinforcement, biaxial | Linear load contour (Bresler, α = 1) | Self-consistent (conservative by construction) |
| ACI 318 — columns without reinforcement, pure axial φPn,max | ACI 318-19 22.4.2.2 (Po) with the 0.80 tied cap of 22.4.2.1, worked by hand for a 16x16 at 1% steel → 528 kips | Validated |
| ACI 318 — columns without reinforcement, P-M interaction | — | Self-consistent only, indicative (see the caveat below) |

### ACI 318 columns

A concrete element is checked as a column when its axial load exceeds
0.1 f'c Ag. What the check does depends on whether its section defines
reinforcement.

**With reinforcement** (a rectangular b x h section with bars, entered in the
Sections tab or as `reinforcement` in the JSON file), `checkReinforcedColumn`
builds the section's P-M interaction diagram by strain compatibility
([`src/design/aci318/interaction.ts`](../src/design/aci318/interaction.ts)):
the neutral axis is stepped across the section, bars inside the stress block
displace concrete, φ varies between 0.65 (tied) and 0.90 with the net tensile
strain, the curve is capped at 0.80 φ Po and includes pure tension. The D/C
ratio is radial: the demand (Pu, Mu) is scaled along the ray from the origin
until it meets the φ curve, and D/C is the demand's distance over the
curve's. The result is not marked indicative and reports `AsProvided` and
`rhoProvided`.

Caveats for the reinforced check:

- Ties only. Spiral columns (φ = 0.75, 0.85 Po cap) are not modelled.
- Bars are one size, in a perimeter layout symmetric about both axes
  (`barsAlongB` per b face, `barsAlongH` per h face, corners included).
- The strong-axis moment (local z, depth h) is checked as today. When the
  analysis also reports a weak-axis moment, biaxial bending uses the linear
  load contour Mux/φMnx + Muy/φMny ≤ 1 at the scaled axial load, which is
  conservative compared with the curved contours of real sections.
- Each element end is checked with its own (P, M) pair, and the larger ratio
  governs. Slenderness (moment magnification, ACI 318-19 6.6.4) is not
  applied, so the check is for short columns or for moments that already
  include second-order effects.
- Shear and detailing (tie spacing, minimum and maximum ρ of 10.6.1.1) are
  not checked.

**Without reinforcement** the old screening check runs: `checkColumn` is a
simplified linear P-M interaction that **assumes a 1% reinforcement ratio**
and approximates the balanced point. It is a screening tool, not a column
design. The result carries an `indicative` flag and its D/C ratio is marked
with a † in the results panel, on the D/C heatmap legend and in the PDF
report's design checks table, with a note asking the user to define the
section's reinforcement. The assumed steel is reported as `rhoAssumed`, not
as `AsRequired`. Its pure axial anchor `phiPn0` is pinned against a hand
calculation; the balanced point and `phiMn0` are approximations, and nothing
between the anchors is validated.

## Analysis engine

| Area | Status |
|---|---|
| `solveModel` end-to-end (K·u = F, reactions, element forces) | Validated against analytical beam solutions |
| Internal force distribution along members | Self-consistent |
| Local element stiffness matrix and fixed-end forces (`local-stiffness.ts`) | Validated against the closed-form space-frame element matrix, entry by entry, plus symmetry and the six rigid-body modes |
| 3D transformation (`transformation.ts`) | Validated against the direction-cosine rotation matrix: identity along X, plane rotation about Z, beta rotation about local x, orthonormal and right-handed, block-diagonal 12x12. See the caveat below on near-vertical members |
| Global assembly (`assembler.ts`) | Validated: two collinear elements sum at the shared node term by term, an inclined element matches the closed-form plane-frame global matrix, and nodal and uniform-load equivalent forces land on the right DOFs |
| Boundary conditions (`boundary-conditions.ts`) | Validated: DOF numbering of restraints, free/restrained partition, and the reduced cantilever system solved against PL³/3EI and PL²/2EI |
| Matrix helpers (`matrix-utils.ts`) | Validated against hand-worked products, the plane truss bar Tᵀ·k·T, and direct-stiffness scatter of two springs |
| Post-processing (`post-processor.ts`) | Validated: reactions and member end forces of a determinate cantilever and simply supported beam under nodal loads, and of a simply supported beam under a uniform load (R = wL/2), from closed-form displacements, with ΣF = 0 and ΣM = 0. Reactions are K·u minus the full equivalent nodal load vector, member loads included |
| Support reactions under member loads (`reactions-member-loads.test.ts`) | Validated through `solveModel` against AISC Manual Table 3-23 for a uniform load on a simple beam (R = wL/2), a cantilever (R = wL, M = wL²/2) and a propped cantilever (R = 5wL/8 and 3wL/8, M = wL²/8), plus hand statics for an inclined beam with perpendicular and axial loads, weak-axis and axial loads on a cantilever, and mixed nodal and member loads. Every case checks ΣF = 0 and ΣM = 0 with the member loads included |

End-to-end coverage is not a substitute for these: a sign error
in the weak-axis coupling term of the local stiffness matrix passes the entire
`solveModel` suite. Every model in it is planar in XY and loaded in plane, so
the weak-axis bending DOFs are never excited and the wrong term never reaches
a result.

### Known open defects in the analysis engine

One defect surfaced while validating the core modules in isolation. It is
pinned by a skipped test that states the correct expectation, so it can be
enabled once the fix lands.

- **Local axes jump near vertical** (`transformation.ts`). Members within
  about 2.56° of global Y switch to a different local y/z convention, so two
  members tilted 87° and 88° from horizontal in the XY plane bend in plane
  about different section axes (Ix vs Iy). A perfectly vertical column in an
  XY frame with beta = 0 also bends in plane about its weak axis.

## Known unit pitfalls

ACI 318 writes `2√f'c` and `200/fy` with **f'c and fy in psi**, while models here
carry f'c in **ksi**. Two defects of exactly this kind were found and fixed when
this test suite was first written:

- Minimum flexural steel was computed 1000× too large, so every concrete beam
  reported a fail with an absurd required area.
- Concrete shear capacity was ~31.6× (√1000) too high, so concrete shear
  effectively never governed.

If you touch `src/design/aci318/`, add a test that pins the absolute magnitude
against a hand-worked value.

The trap is not the D/C ratio itself. Demand comes from the analysis and only
the capacity carries the error, so a ratio built from an independent demand does
surface a scaling mistake. The trap is deriving the expected value from the
function under test: that puts the same wrong factor on both sides of the
assertion, where it cancels and the test passes either way.

Since the checks report their capacity, prefer asserting it against the
published value straight out of the function. Both defects above are caught
that way in one line, and the assertion says what the number is rather than
what it implies.

## Contributing a validation case

Changes to `src/core/` or `src/design/` require a validation test — see
[CONTRIBUTING.md](../CONTRIBUTING.md). A good one:

1. Cites its source in a comment (manual table, code equation, or textbook
   problem, with the edition).
2. Pins an **absolute** value, not only a relationship.
3. Works the reference independently in the test rather than calling the
   implementation to produce its own expectation.

Benchmark problems from textbooks are very welcome, especially for the areas
marked Unverified above.

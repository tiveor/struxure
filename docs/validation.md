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
| ACI 318 — columns, pure axial φPn,max | ACI 318-19 22.4.2.2 (Po) with the 0.80 tied cap of 22.4.2.1, worked by hand for a 16x16 at 1% steel → 528 kips | Validated |
| ACI 318 — columns, P-M interaction | — | Self-consistent only — see the caveat below |

### Caveat on ACI 318 columns

`checkColumn` is a simplified linear P-M interaction that **assumes a 1%
reinforcement ratio** rather than analysing the section's actual bars, and
approximates the balanced point. It is a screening tool, not a column design.
Treat its ratio as indicative and verify any column that matters by other means.

The pure axial anchor it reports, `phiPn0`, is a plain ACI equation and is
pinned against a hand calculation. The balanced point and the pure moment
anchor `phiMn0` are approximations, and nothing between the anchors is
validated.

## Analysis engine

| Area | Status |
|---|---|
| `solveModel` end-to-end (K·u = F, reactions, element forces) | Validated against analytical beam solutions |
| Internal force distribution along members | Self-consistent |
| Local element stiffness matrix and fixed-end forces (`local-stiffness.ts`) | Validated against the closed-form space-frame element matrix, entry by entry, plus symmetry and the six rigid-body modes |
| 3D transformation, assembly, boundary conditions | Unverified in isolation — only exercised through `solveModel` |

Expanding the remaining ones into standalone validation cases is on the
[roadmap](../ROADMAP.md). End-to-end coverage is not a substitute: a sign error
in the weak-axis coupling term of the local stiffness matrix passes the entire
`solveModel` suite. Every model in it is planar in XY and loaded in plane, so
the weak-axis bending DOFs are never excited and the wrong term never reaches
a result.

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

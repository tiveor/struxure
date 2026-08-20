# Contributing to Struxure

Thanks for your interest in improving Struxure. This guide covers everything
you need to set up the project, understand the rules around solver and design
changes, and get a pull request merged.

By contributing, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md)
and that your contribution is licensed under [Apache-2.0](LICENSE).

## Development setup

You need Node 22.13 or newer and pnpm 11 (the version pinned in `package.json` via
`packageManager`).

```bash
git clone https://github.com/tiveor/struxure.git
cd struxure
pnpm install
pnpm dev
```

Open `http://localhost:5173/struxure/` — Struxure is served under a
`/struxure/` base path (see the `base` option in `vite.config.ts`), so the
plain `http://localhost:5173/` root will 404.

No `.env` file is required to develop. Struxure ships with analytics off by
default; `.env.example` documents the one optional variable
(`VITE_UMAMI_ID`) that turns them on, and you don't need it for local work.

### Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start the Vite dev server |
| `pnpm test` | Run the test suite once (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint with ESLint |
| `pnpm typecheck` | Type-check with `tsc -b` |
| `pnpm build` | Production build |
| `pnpm preview` | Serve the production build locally, to sanity-check a build before opening a PR |

To run a single test file instead of the whole suite, pass its path to `vitest` directly:

```bash
pnpm vitest run src/core/__tests__/solver.test.ts
```

## Before you open a pull request

All four of these must pass locally:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs exactly these four checks (on Node 22 and 24), plus a DCO check on
your commits (see below). A pull request that fails any of them won't be
merged.

## The rule that matters most

> **Any change to the solver or to a design check must ship with a
> validation test against a known analytical solution or a published worked
> example.**

This applies to anything under `src/core/` (the FEA engine — stiffness
matrices, assembly, the solver, post-processing) and `src/design/` (the
AISC 360 and ACI 318 design checks).

Struxure computes numbers that people may use to reason about real
structures. A change that silently shifts a result by a few percent is
worse than one that crashes — a crash gets noticed immediately, a quiet
drift in a moment or a D/C ratio does not.

### What a validation test looks like

It states its source in a comment and asserts against it with an explicit
tolerance. This is a real example from `src/core/__tests__/solver.test.ts`:

```ts
/**
 * Test 1: Simply supported beam with point load at midspan.
 *
 * Beam: L = 120 in, W12x26 steel section
 * Load: 10 kips downward at midspan
 *
 * Analytical solution (Euler-Bernoulli):
 *   δ_max = PL³ / (48EI) = 10 * 120³ / (48 * 29000 * 204) = 0.0608 in
 *   Reactions: R_A = R_B = P/2 = 5 kips (upward)
 *   Max moment at midspan: M = PL/4 = 10*120/4 = 300 kip-in
 */
describe('Simply Supported Beam - Point Load at Midspan', () => {
  // ...model definition...

  it('should compute correct midspan deflection', () => {
    const results = solveModel(model);
    const nodeB = results.nodeDisplacements.get('B')!;
    // Analytical: δ = PL³/(48EI) = 10*120³/(48*29000*204) ≈ 0.0608 in
    const analytical_delta = (10 * Math.pow(120, 3)) / (48 * 29000 * 204);
    expect(nodeB[1]).toBeCloseTo(-analytical_delta, 3);
  });
});
```

Follow that pattern: put the source and the formula in a comment above the
test, then assert with `toBeCloseTo` (or an equivalent explicit tolerance) —
never a bare equality check on a floating-point result.

### Acceptable sources, in order of preference

1. A closed-form analytical solution, with the formula in a comment (as
   above).
2. A worked example from a textbook or a standard's commentary, cited by
   edition and example number (e.g. "McCormac & Csernak, *Structural Steel
   Design*, 6th ed., Example 5-3").
3. A hand calculation reproduced in full in the test comments, so a reviewer
   can check it without re-deriving it.

**"I checked it against SAP2000 on my machine" is not reproducible and is
not sufficient on its own.** A reviewer — or a future contributor debugging
a regression — needs to be able to verify the expected value from the test
file alone, without access to your machine or a commercial license.

Pure UI, documentation, and tooling changes don't need a validation test,
but `pnpm test` must still pass.

## Commits

Struxure follows [Conventional Commits](https://www.conventionalcommits.org/).
Examples drawn from this project:

```
feat: add P-Delta analysis toggle
fix: correct shear capacity for HSS sections
test: add validation case for the two-hinged arch
docs: clarify heatmap normalization in quick-start guide
refactor: extract element DOF mapping into a shared helper
```

### Sign-off is required

Every commit needs a [Developer Certificate of Origin](https://developercertificate.org/)
sign-off — CI blocks pull requests that contain an authored commit without
one (merge commits are excluded from the check).

Sign off as you commit:

```bash
git commit --signoff -m "fix: correct shear capacity for HSS sections"
```

Fix the most recent commit:

```bash
git commit --amend --signoff --no-edit
```

Sign off an entire branch at once:

```bash
git rebase --signoff origin/main
```

## Pull requests

- One logical change per PR.
- Describe what changed and why, not just what.
- Link the issue it addresses, if any.
- Include screenshots for any change to the viewport or other visible UI.
- If your change touches `src/core/` or `src/design/`, name the validation
  test that covers it in the PR description.

## Project layout

For a map of how the pieces fit together — the analysis pipeline, the
design-check dispatch, the stores, and the rendering layer — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Good first issues

Issues labeled `good first issue` are scoped to be approachable without deep
familiarity with the codebase. If one turns out to be unclear or more
involved than it looked, say so in the issue — that's useful feedback about
the issue, not a shortcoming on your part.

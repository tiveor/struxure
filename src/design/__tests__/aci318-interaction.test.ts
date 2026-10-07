import { describe, it, expect } from 'vitest';
import type { ColumnReinforcement, Material, Section } from '../../core/types';
import {
  beta1,
  buildInteractionDiagram,
  interactionRatio,
  neutralAxisForPn,
  phiMomentAt,
  phiTied,
  pureCompression,
  sectionStrengthAt,
} from '../aci318/interaction';
import { checkReinforcedColumn, columnInteractionSections } from '../aci318/columns';
import { barLayout, coverToBarCenter, reinforcementErrors, totalBars, totalSteelArea } from '../aci318/rebar';

/**
 * Validation of the strain-compatibility P-M interaction diagram
 * (src/design/aci318/interaction.ts) against hand calculations per
 * ACI 318-19, reproduced in full below so a reviewer can check every number.
 *
 * Procedure (the standard one, e.g. Wight & MacGregor, Reinforced Concrete:
 * Mechanics and Design, ch. 11, and the PCA Notes on ACI 318, ch. 6): pick a
 * neutral axis depth c; strain in each bar layer eps_s = 0.003 (c - d) / c
 * (+ compression); fs = Es eps_s capped at +/- fy, Es = 29000 ksi; bars inside
 * the Whitney block (d < a = beta1 c) carry fs - 0.85 f'c; Cc = 0.85 f'c b a;
 * Pn = Cc + sum(As fs); Mn about mid-depth = Cc (h/2 - a/2) + sum(As fs (h/2 - d)).
 * phi from Table 21.2.2 (tied) by eps_t of the deepest layer, eps_ty = fy/Es.
 *
 * No textbook example is cited for the numbers themselves: the values are
 * worked by hand (and checked against an independent script), so the test
 * comment is the reference.
 */

const C4000: Material = {
  id: 'c4', name: "f'c = 4000 psi", type: 'concrete', E: 3605, G: 1502, density: 0.0000868, fc: 4,
};
const C5000: Material = {
  id: 'c5', name: "f'c = 5000 psi", type: 'concrete', E: 4031, G: 1680, density: 0.0000868, fc: 5,
};

/**
 * Example A. 16 x 16 in tied column, f'c = 4 ksi, fy = 60 ksi, 8 #8 bars
 * (3 bars per face, corners shared), #3 ties, 1.5 in clear cover.
 *
 *   #8: db = 1.000 in, Ab = 0.79 in^2; #3 tie: 0.375 in.
 *   d' = 1.5 + 0.375 + 1.0/2 = 2.375 in, so bending about x has three layers:
 *     layer 1: d = 2.375  in, 3 bars, As = 2.37 in^2
 *     layer 2: d = 8.000  in, 2 bars, As = 1.58 in^2
 *     layer 3: d = 13.625 in, 3 bars, As = 2.37 in^2
 *   Ast = 6.32 in^2, Ag = 256 in^2, beta1 = 0.85 (f'c = 4 ksi).
 */
const REINF_A: ColumnReinforcement = { cover: 1.5, barSize: 8, barsAlongB: 3, barsAlongH: 3, tieSize: 3 };
const SEC_A = columnInteractionSections(16, 16, REINF_A, 4).x;

/**
 * Example B. 12 x 20 in tied column (h = 20 in the bending direction),
 * f'c = 5 ksi, fy = 60 ksi, 6 #9 bars (3 on each 12 in face, none on the
 * sides), #3 ties, 1.5 in clear cover.
 *
 *   #9: db = 1.128 in, Ab = 1.00 in^2.
 *   d' = 1.5 + 0.375 + 1.128/2 = 2.439 in; layers d = 2.439 and 17.561 in,
 *   3.00 in^2 each. Ast = 6.00 in^2, Ag = 240 in^2.
 *   beta1 = 0.85 - 0.05 (5 - 4) = 0.80 (Table 22.2.2.4.3).
 */
const REINF_B: ColumnReinforcement = { cover: 1.5, barSize: 9, barsAlongB: 3, barsAlongH: 2, tieSize: 3 };
const SEC_B = columnInteractionSections(12, 20, REINF_B, 5).x;

const EPS_TY = 60 / 29000; // 0.0020690

describe('ACI 318 interaction: bar layout', () => {
  it('places 8 #8 bars at 2.375 in from each face of a 16x16', () => {
    expect(coverToBarCenter(REINF_A)).toBeCloseTo(2.375, 10);
    expect(totalBars(REINF_A)).toBe(8);
    expect(totalSteelArea(REINF_A)).toBeCloseTo(6.32, 10);
    const bars = barLayout(16, 16, REINF_A);
    expect(bars).toHaveLength(8);
    const depths = SEC_A.bars.map((b) => b.d).sort((a, b) => a - b);
    expect(depths.map((d) => +d.toFixed(3))).toEqual([2.375, 2.375, 2.375, 8, 8, 13.625, 13.625, 13.625]);
  });

  it('places 6 #9 bars on the two 12 in faces of a 12x20', () => {
    expect(totalBars(REINF_B)).toBe(6);
    const depths = SEC_B.bars.map((b) => +b.d.toFixed(3)).sort((a, b) => a - b);
    expect(depths).toEqual([2.439, 2.439, 2.439, 17.561, 17.561, 17.561]);
  });
});

describe('ACI 318 interaction: beta1 and phi', () => {
  it('follows Table 22.2.2.4.3 for beta1', () => {
    expect(beta1(3)).toBe(0.85);
    expect(beta1(4)).toBe(0.85);
    expect(beta1(5)).toBeCloseTo(0.8, 12);
    expect(beta1(6)).toBeCloseTo(0.75, 12);
    expect(beta1(8)).toBe(0.65);
    expect(beta1(10)).toBe(0.65);
  });

  it('follows Table 21.2.2 for tied members', () => {
    // Compression-controlled: eps_t <= eps_ty -> 0.65
    expect(phiTied(-0.001, EPS_TY)).toBe(0.65);
    expect(phiTied(EPS_TY, EPS_TY)).toBe(0.65);
    // Tension-controlled: eps_t >= eps_ty + 0.003 = 0.005069 -> 0.90
    expect(phiTied(EPS_TY + 0.003, EPS_TY)).toBe(0.9);
    expect(phiTied(0.01, EPS_TY)).toBe(0.9);
    // Transition: phi = 0.65 + 0.25 (eps_t - eps_ty) / 0.003
    //   eps_t = 0.005: 0.65 + 0.25 (0.005 - 0.0020690) / 0.003 = 0.89425
    expect(phiTied(0.005, EPS_TY)).toBeCloseTo(0.89425, 5);
    //   midpoint of the transition gives 0.775
    expect(phiTied(EPS_TY + 0.0015, EPS_TY)).toBeCloseTo(0.775, 12);
  });
});

describe('ACI 318 interaction: Example A, 16x16, 8 #8, f\'c = 4 ksi', () => {
  const diag = buildInteractionDiagram(SEC_A);

  it('pure compression Po and phiPn,max (22.4.2.2, 22.4.2.1)', () => {
    // Po = 0.85 (4)(256 - 6.32) + 60 (6.32) = 848.912 + 379.2 = 1228.112 kips
    // phiPn,max = 0.65 (0.80)(1228.112) = 638.618 kips
    expect(pureCompression(SEC_A)).toBeCloseTo(1228.112, 3);
    expect(diag.Po).toBeCloseTo(1228.112, 3);
    expect(diag.phiPnMax).toBeCloseTo(638.618, 3);
    expect(diag.points[diag.points.length - 1].phiPn).toBeCloseTo(638.618, 3);
  });

  it('balanced point (eps_t = eps_ty)', () => {
    // c_b = 13.625 (0.003) / (0.003 + 0.0020690) = 13.625 (87/147) = 8.06378 in
    // a = 0.85 (8.06378) = 6.85421 in; Cc = 0.85 (4)(16)(6.85421) = 372.869 kips
    // layer 1: eps = 0.003 (8.06378 - 2.375)/8.06378 = 0.002116 > eps_ty,
    //          fs = 60, inside block -> 60 - 3.4 = 56.6; F = 2.37 (56.6) = 134.142
    // layer 2: eps = 0.003 (0.06378)/8.06378 = 0.0000237, fs = 0.688 ksi
    //          (d = 8 > a, no deduction); F = 1.58 (0.688) = 1.087
    // layer 3: eps = -eps_ty, fs = -60; F = 2.37 (-60) = -142.2
    // Pn = 372.869 + 134.142 + 1.087 - 142.2 = 365.898 kips
    // Mn = 372.869 (8 - 3.42710) + 134.142 (5.625) + 1.087 (0) - 142.2 (-5.625)
    //    = 1705.090 + 754.549 + 799.875 = 3259.515 kip-in
    // phi = 0.65 -> phiPn = 237.834 kips, phiMn = 2118.685 kip-in
    const cb = (13.625 * 87) / 147;
    const p = sectionStrengthAt(SEC_A, cb);
    expect(cb).toBeCloseTo(8.06378, 5);
    expect(p.epsT).toBeCloseTo(EPS_TY, 10);
    expect(p.Pn).toBeCloseTo(365.898, 2);
    expect(p.Mn).toBeCloseTo(3259.515, 2);
    expect(p.phi).toBe(0.65);
    expect(p.phiPn).toBeCloseTo(237.834, 2);
    expect(p.phiMn).toBeCloseTo(2118.685, 2);
    // The diagram, read at phiPn_b, gives the same moment.
    expect(phiMomentAt(diag, p.phiPn)!).toBeCloseTo(2118.685, 0);
  });

  it('pure bending (Pn = 0)', () => {
    // Solve Pn(c) = 0. At c = 3.70161 in: a = 0.85 c = 3.14637 in,
    //   Cc = 0.85 (4)(16)(3.14637) = 171.162
    //   layer 1: eps = 0.003 (3.70161 - 2.375)/3.70161 = 0.0010752,
    //            fs = 29000 (0.0010752) = 31.180; in block -> 27.780; F = 65.838
    //   layer 2: eps = -0.003484 -> fs = -60; F = 1.58 (-60) = -94.8
    //   layer 3: eps = -0.008043 -> fs = -60; F = -142.2
    //   Pn = 171.162 + 65.838 - 94.8 - 142.2 = 0.000 (checks)
    //   Mn = 171.162 (8 - 1.57318) + 65.838 (5.625) + 0 + 142.2 (5.625)
    //      = 1100.026 + 370.337 + 799.875 = 2270.24 kip-in
    //   eps_t = 0.008043 >= 0.005069 -> phi = 0.90, phiMn = 2043.22 kip-in
    const c = neutralAxisForPn(SEC_A, 0);
    const p = sectionStrengthAt(SEC_A, c);
    expect(c).toBeCloseTo(3.70161, 4);
    expect(p.Pn).toBeCloseTo(0, 6);
    expect(p.Mn).toBeCloseTo(2270.24, 1);
    expect(p.phi).toBe(0.9);
    expect(p.phiMn).toBeCloseTo(2043.22, 1);
    expect(phiMomentAt(diag, 0)!).toBeCloseTo(2043.22, 0);
  });

  it('pure tension (22.4.3)', () => {
    // Pnt = fy Ast = 60 (6.32) = 379.2 kips; phi = 0.90 -> 341.28 kips
    expect(diag.Pnt).toBeCloseTo(379.2, 6);
    expect(diag.phiPnt).toBeCloseTo(341.28, 6);
    expect(diag.points[0].phiPn).toBeCloseTo(-341.28, 6);
    expect(diag.points[0].phiMn).toBe(0);
    expect(phiMomentAt(diag, -341.28)).toBeCloseTo(0, 3);
    expect(phiMomentAt(diag, -341.3)).toBeNull();
  });

  it('transition zone point at eps_t = 0.005', () => {
    // c = 13.625 (0.003)/(0.008) = 5.10938 in, a = 4.34297 in
    //   Cc = 54.4 (4.34297) = 236.258
    //   layer 1: eps = 0.001606, fs = 46.560, in block -> 43.160; F = 102.288
    //   layer 2: eps = -0.001697, fs = -49.220; F = -77.768
    //   layer 3: fs = -60; F = -142.2
    //   Pn = 236.258 + 102.288 - 77.768 - 142.2 = 118.578 kips
    //   Mn = 236.258 (5.82852) + 102.288 (5.625) + 142.2 (5.625) = 2752.28 kip-in
    //   phi = 0.89425 -> phiPn = 106.039, phiMn = 2461.23
    const c = (13.625 * 0.003) / 0.008;
    const p = sectionStrengthAt(SEC_A, c);
    expect(p.epsT).toBeCloseTo(0.005, 12);
    expect(p.Pn).toBeCloseTo(118.578, 2);
    expect(p.Mn).toBeCloseTo(2752.28, 1);
    expect(p.phi).toBeCloseTo(0.89425, 5);
    expect(p.phiPn).toBeCloseTo(106.039, 2);
    expect(p.phiMn).toBeCloseTo(2461.23, 1);
  });

  it('is ordered by phiPn from pure tension to the cap', () => {
    for (let i = 1; i < diag.points.length; i++) {
      expect(diag.points[i].phiPn).toBeGreaterThan(diag.points[i - 1].phiPn);
    }
  });
});

describe('ACI 318 interaction: Example B, 12x20, 6 #9, f\'c = 5 ksi', () => {
  const diag = buildInteractionDiagram(SEC_B);

  it('pure compression Po and phiPn,max', () => {
    // Po = 0.85 (5)(240 - 6) + 60 (6) = 994.5 + 360 = 1354.5 kips
    // phiPn,max = 0.65 (0.80)(1354.5) = 704.34 kips
    expect(diag.Po).toBeCloseTo(1354.5, 6);
    expect(diag.phiPnMax).toBeCloseTo(704.34, 6);
  });

  it('balanced point', () => {
    // c_b = 17.561 (87/147) = 10.39324 in; a = 0.80 c_b = 8.31460 in
    // Cc = 0.85 (5)(12)(8.31460) = 424.044 kips
    // top: eps = 0.003 (10.39324 - 2.439)/10.39324 = 0.002296 -> fs = 60,
    //      in block -> 60 - 4.25 = 55.75; F = 3 (55.75) = 167.25
    // bottom: fs = -60; F = -180
    // Pn = 424.044 + 167.25 - 180 = 411.294 kips
    // Mn = 424.044 (10 - 4.15730) + 167.25 (7.561) + 180 (7.561)
    //    = 2477.534 + 1264.577 + 1360.980 = 5103.12 kip-in
    // phi = 0.65 -> phiPn = 267.341, phiMn = 3317.03
    const cb = (17.561 * 87) / 147;
    const p = sectionStrengthAt(SEC_B, cb);
    expect(p.Pn).toBeCloseTo(411.294, 2);
    expect(p.Mn).toBeCloseTo(5103.12, 1);
    expect(p.phiPn).toBeCloseTo(267.341, 2);
    expect(p.phiMn).toBeCloseTo(3317.03, 1);
  });

  it('pure bending', () => {
    // At c = 3.20117 in: a = 2.56094 in, Cc = 51 (2.56094) = 130.608
    //   top: eps = 0.003 (0.76217)/3.20117 = 0.000714, fs = 20.714,
    //        in block -> 16.464; F = 49.392
    //   bottom: eps = -0.013457 -> fs = -60; F = -180
    //   Pn = 130.608 + 49.392 - 180 = 0 (checks)
    //   Mn = 130.608 (8.71953) + 49.392 (7.561) + 180 (7.561)
    //      = 1138.84 + 373.45 + 1360.98 = 2873.27 kip-in
    //   phi = 0.90 -> phiMn = 2585.95 kip-in
    const c = neutralAxisForPn(SEC_B, 0);
    const p = sectionStrengthAt(SEC_B, c);
    expect(c).toBeCloseTo(3.20117, 4);
    expect(p.Mn).toBeCloseTo(2873.27, 1);
    expect(p.phiMn).toBeCloseTo(2585.95, 1);
  });

  it('pure tension', () => {
    // phiPnt = 0.90 (60)(6.00) = 324 kips
    expect(diag.phiPnt).toBeCloseTo(324, 6);
  });

  it('tension-controlled limit eps_t = eps_ty + 0.003 has phi = 0.90', () => {
    // c = 17.561 (0.003)/(0.008069) = 6.52909 in
    //   Pn = 237.138 kips, Mn = 4468.97 kip-in, phi = 0.90
    const c = (17.561 * 0.003) / (0.003 + EPS_TY + 0.003);
    const p = sectionStrengthAt(SEC_B, c);
    expect(p.phi).toBeCloseTo(0.9, 10);
    expect(p.Pn).toBeCloseTo(237.138, 2);
    expect(p.Mn).toBeCloseTo(4468.97, 1);
  });
});

describe('ACI 318 interaction: D/C ratio (radial)', () => {
  const diag = buildInteractionDiagram(SEC_A);
  const balanced = sectionStrengthAt(SEC_A, (13.625 * 87) / 147);

  it('is 1.0 on the curve and scales linearly along a ray', () => {
    // A demand exactly on the phi curve at the balanced point has D/C = 1;
    // half of it, on the same ray, has D/C = 0.5.
    expect(interactionRatio(diag, null, balanced.phiPn, balanced.phiMn)).toBeCloseTo(1, 2);
    expect(interactionRatio(diag, null, balanced.phiPn / 2, balanced.phiMn / 2)).toBeCloseTo(0.5, 2);
    expect(interactionRatio(diag, null, 2 * balanced.phiPn, 2 * balanced.phiMn)).toBeCloseTo(2, 2);
  });

  it('reduces to Pu / phiPn,max for pure axial and Mu / phiMn0 for pure bending', () => {
    expect(interactionRatio(diag, null, 319.309, 0)).toBeCloseTo(319.309 / 638.618, 6);
    expect(interactionRatio(diag, null, 0, 1000)).toBeCloseTo(1000 / 2043.22, 3);
    expect(interactionRatio(diag, null, -170.64, 0)).toBeCloseTo(0.5, 6);
    expect(interactionRatio(diag, null, 0, 0)).toBe(0);
  });

  it('uses the linear load contour (alpha = 1) for biaxial bending', () => {
    // Square, symmetric section: phiMnx(P) = phiMny(P). With Mux = Muy = M and
    // P = 0, the contour gives 2M / phiMn0 = 1 at M = phiMn0 / 2.
    const sq = columnInteractionSections(16, 16, REINF_A, 4);
    const dx = buildInteractionDiagram(sq.x);
    const dy = buildInteractionDiagram(sq.y);
    expect(interactionRatio(dx, dy, 0, 2043.22 / 2, 2043.22 / 2)).toBeCloseTo(1, 3);
    // Biaxial is never less critical than either uniaxial component.
    expect(interactionRatio(dx, dy, 200, 800, 300)).toBeGreaterThan(interactionRatio(dx, null, 200, 800));
  });

  it('checkReinforcedColumn reports As and rho provided and the governing end', () => {
    const section = {
      id: 'C', name: 'C', A: 256, Ix: 5461, Iy: 5461, J: 0, b: 16, h: 16, reinforcement: REINF_A,
    } as Section & { b: number; h: number; reinforcement: ColumnReinforcement };
    const r = checkReinforcedColumn(
      [{ P: balanced.phiPn / 2, Mx: balanced.phiMn / 2, My: 0 }, { P: 100, Mx: 100, My: 0 }],
      C4000,
      section
    );
    expect(r.ratio).toBeCloseTo(0.5, 2);
    expect(r.AsProvided).toBeCloseTo(6.32, 10);
    expect(r.rhoProvided).toBeCloseTo(6.32 / 256, 10);
    expect(r.phiPnMax).toBeCloseTo(638.618, 3);
    expect(r.phiMn0).toBeCloseTo(2043.22, 1);
  });

  it('uses the weak-axis depth b for My', () => {
    // 12 x 20 section: bending about y has depth 12 in, so it is weaker.
    const section = {
      id: 'B', name: 'B', A: 240, Ix: 8000, Iy: 2880, J: 0, b: 12, h: 20, reinforcement: REINF_B,
    } as Section & { b: number; h: number; reinforcement: ColumnReinforcement };
    const strong = checkReinforcedColumn([{ P: 100, Mx: 1500, My: 0 }], C5000, section).ratio;
    const weak = checkReinforcedColumn([{ P: 100, Mx: 0, My: 1500 }], C5000, section).ratio;
    expect(weak).toBeGreaterThan(strong);
  });
});

describe('ACI 318 interaction: reinforcement validation', () => {
  const base = { b: 16, h: 16 };

  it('accepts a valid layout and an absent one', () => {
    expect(reinforcementErrors({ ...base, reinforcement: REINF_A })).toEqual([]);
    expect(reinforcementErrors(base)).toEqual([]);
  });

  it('rejects bad sizes, counts and missing dimensions', () => {
    expect(reinforcementErrors({ ...base, reinforcement: { ...REINF_A, barSize: 12 } })).toHaveLength(1);
    expect(reinforcementErrors({ ...base, reinforcement: { ...REINF_A, tieSize: 6 } })).toHaveLength(1);
    expect(reinforcementErrors({ ...base, reinforcement: { ...REINF_A, barsAlongB: 1 } })).toHaveLength(1);
    expect(reinforcementErrors({ ...base, reinforcement: { ...REINF_A, barsAlongH: 2.5 } })).toHaveLength(1);
    expect(reinforcementErrors({ ...base, reinforcement: { ...REINF_A, fy: -60 } })).toHaveLength(1);
    expect(reinforcementErrors({ reinforcement: REINF_A })[0]).toMatch(/"b" and "h"/);
    expect(reinforcementErrors({ ...base, reinforcement: 'lots' })).toEqual(['"reinforcement" must be an object']);
  });

  it('rejects bars that do not fit', () => {
    expect(reinforcementErrors({ b: 5, h: 5, reinforcement: REINF_A })[0]).toMatch(/does not fit/);
    expect(reinforcementErrors({ ...base, reinforcement: { ...REINF_A, barsAlongB: 13 } })[0]).toMatch(/overlap/);
  });
});

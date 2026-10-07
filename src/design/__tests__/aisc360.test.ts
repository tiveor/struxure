import { describe, it, expect } from 'vitest';
import type { Material, Section } from '../../core/types';
import { checkTension } from '../aisc360/tension';
import { checkCompression } from '../aisc360/compression';
import { checkFlexure, iShapeSlenderness, NONCOMPACT_WEB_REASON } from '../aisc360/flexure';
import { EURO_SECTIONS, euroToSection } from '../../data/euro-sections';
import { checkCombined } from '../aisc360/combined';
import { designSteelElement } from '../aisc360';

/**
 * Validation tests for the AISC 360 checks.
 *
 * Each capacity below is compared against a value tabulated in the AISC Steel
 * Construction Manual (15th ed.), so the reference is independent of this
 * implementation. Each check returns the capacity it used alongside the
 * demand/capacity ratio, so the tabulated value is asserted directly; the
 * ratio at a demand equal to that capacity must still come back as 1.0.
 *
 * Section properties are from AISC Manual Table 1-1 (W-shapes).
 */

const KSI_TO_MPA = 6.894757293168361;
const KIPIN_TO_KNM = 4.4482216152605 * 0.0254;

const A992: Material = {
  id: 'steel-A992', name: 'A992 Steel', type: 'steel',
  E: 29000, G: 11200, density: 0.000284, fy: 50, fu: 65,
};

const W12x26: Section = {
  id: 'W12x26', name: 'W12x26',
  A: 7.65, Ix: 204, Iy: 17.3, J: 0.3,
  Sx: 33.4, Sy: 5.48, Zx: 37.2, Zy: 8.17,
  rx: 5.17, ry: 1.51, d: 12.2, bf: 6.49, tf: 0.38, tw: 0.23,
};

const W10x49: Section = {
  id: 'W10x49', name: 'W10x49',
  A: 14.4, Ix: 272, Iy: 93.4, J: 1.39,
  Sx: 54.6, Sy: 18.7, Zx: 60.4, Zy: 28.3,
  rx: 4.35, ry: 2.54, d: 10.0, bf: 10.0, tf: 0.56, tw: 0.34,
};

const W18x50: Section = {
  id: 'W18x50', name: 'W18x50',
  A: 14.7, Ix: 800, Iy: 40.1, J: 1.24,
  Sx: 88.9, Sy: 10.7, Zx: 101, Zy: 16.6,
  rx: 7.38, ry: 1.65, d: 17.99, bf: 7.495, tf: 0.57, tw: 0.355,
};

describe('AISC 360 Chapter D — tension', () => {
  // Manual Table 5-1, W12x26, Fy = 50 ksi: phi*Pn = 344 kips (yielding on Ag).
  const PHI_PN = 0.9 * 50 * 7.65; // 344.25 kips

  it('returns the tabulated yielding capacity', () => {
    expect(checkTension(PHI_PN, A992, W12x26).phiPn).toBeCloseTo(344, 0);
  });

  it('reports the capacity whatever the demand is', () => {
    // phi*Pn is a property of the section, so it does not move with Pu and is
    // still reported when the member is in compression.
    expect(checkTension(0, A992, W12x26).phiPn).toBeCloseTo(344, 0);
    expect(checkTension(-200, A992, W12x26).phiPn).toBeCloseTo(344, 0);
  });

  it('reaches D/C = 1.0 at the tabulated yielding capacity', () => {
    expect(PHI_PN).toBeCloseTo(344, 0);
    expect(checkTension(PHI_PN, A992, W12x26).ratio).toBeCloseTo(1.0, 6);
  });

  it('scales linearly with demand', () => {
    expect(checkTension(PHI_PN / 2, A992, W12x26).ratio).toBeCloseTo(0.5, 6);
  });

  it('reports no demand for a compressive axial force', () => {
    expect(checkTension(-200, A992, W12x26).ratio).toBe(0);
  });
});

describe('AISC 360 Chapter E — compression', () => {
  // Manual Table 4-1, W10x49, Fy = 50 ksi, KL = 14 ft about the weak axis:
  // phi_c*Pn = 471 kips. Weak-axis buckling governs (KL/ry = 66.1 > KL/rx = 38.6).
  const KL = 14 * 12; // in

  it('returns the tabulated capacity for KL = 14 ft', () => {
    expect(checkCompression(0, A992, W10x49, KL, KL).phiPn).toBeCloseTo(471, 0);
  });

  it('matches the tabulated capacity for KL = 14 ft', () => {
    // Demand set to the tabulated capacity must give a ratio of 1.0.
    const { ratio } = checkCompression(471, A992, W10x49, KL, KL);
    expect(ratio).toBeCloseTo(1.0, 2);
  });

  it('uses the inelastic branch below the 4.71*sqrt(E/Fy) limit', () => {
    // 4.71*sqrt(29000/50) = 113.4; KL/ry here is 66.1, so Eq. E3-2 applies.
    const slenderness = KL / W10x49.ry!;
    expect(slenderness).toBeLessThan(4.71 * Math.sqrt(29000 / 50));

    // Eq. E3-2 worked by hand: Fe = pi^2*E/(KL/r)^2, Fcr = 0.658^(Fy/Fe)*Fy.
    const Fe = (Math.PI ** 2 * 29000) / slenderness ** 2;
    const Fcr = 0.658 ** (50 / Fe) * 50;
    const phiPn = 0.9 * Fcr * W10x49.A;
    expect(phiPn).toBeCloseTo(471, 0);
    expect(checkCompression(0, A992, W10x49, KL, KL).phiPn).toBeCloseTo(phiPn, 12);
    expect(checkCompression(phiPn, A992, W10x49, KL, KL).ratio).toBeCloseTo(1.0, 6);
  });

  it('switches to elastic buckling for a very slender member', () => {
    // KL/ry = 480/2.54 = 189 > 113.4, so Eq. E3-3 (Fcr = 0.877*Fe) governs.
    const KLlong = 480;
    const Fe = (Math.PI ** 2 * 29000) / (KLlong / W10x49.ry!) ** 2;
    const phiPn = 0.9 * 0.877 * Fe * W10x49.A;
    expect(checkCompression(0, A992, W10x49, KLlong, KLlong).phiPn).toBeCloseTo(phiPn, 12);
    expect(checkCompression(phiPn, A992, W10x49, KLlong, KLlong).ratio).toBeCloseTo(1.0, 6);
  });

  it('takes the governing axis, not the axis it was given first', () => {
    // Bracing the weak axis at mid-height must raise capacity: strong axis governs.
    const braced = checkCompression(400, A992, W10x49, KL, KL / 2);
    const unbraced = checkCompression(400, A992, W10x49, KL, KL);
    expect(braced.ratio).toBeLessThan(unbraced.ratio);
    expect(braced.phiPn).toBeGreaterThan(unbraced.phiPn);
  });

  it('reports no demand for a tensile axial force', () => {
    expect(checkCompression(-200, A992, W10x49, KL, KL).ratio).toBe(0);
  });
});

describe('AISC 360 Chapter F — flexure', () => {
  // Manual Table 3-2, W18x50, Fy = 50 ksi: phi_b*Mp = 379 kip-ft, Lp = 5.83 ft.
  const PHI_MP = 0.9 * 50 * 101; // 4545 kip-in = 378.75 kip-ft
  const LP = 1.76 * 1.65 * Math.sqrt(29000 / 50); // 69.9 in = 5.83 ft

  it('matches the tabulated plastic moment', () => {
    expect(PHI_MP / 12).toBeCloseTo(379, 0);
  });

  it('matches the tabulated Lp', () => {
    expect(LP / 12).toBeCloseTo(5.83, 2);
  });

  it('returns the tabulated plastic moment as the capacity', () => {
    expect(checkFlexure(0, A992, W18x50, LP - 1).phiMn / 12).toBeCloseTo(379, 0);
  });

  it('yielding governs when Lb <= Lp', () => {
    expect(checkFlexure(PHI_MP, A992, W18x50, LP - 1).ratio).toBeCloseTo(1.0, 6);
  });

  it('capacity falls off once Lb exceeds Lp', () => {
    const atLp = checkFlexure(PHI_MP, A992, W18x50, LP - 1);
    const beyond = checkFlexure(PHI_MP, A992, W18x50, LP * 2);
    expect(beyond.ratio).toBeGreaterThan(atLp.ratio);
    expect(beyond.phiMn).toBeLessThan(atLp.phiMn);
  });

  it('capacity decreases monotonically with unbraced length', () => {
    const lengths = [LP, LP * 1.5, LP * 2, LP * 3, LP * 5];
    const checks = lengths.map((Lb) => checkFlexure(PHI_MP, A992, W18x50, Lb));
    for (let i = 1; i < checks.length; i++) {
      expect(checks[i].ratio).toBeGreaterThanOrEqual(checks[i - 1].ratio);
      expect(checks[i].phiMn).toBeLessThanOrEqual(checks[i - 1].phiMn);
    }
  });

  it('never reports a capacity above Mp', () => {
    // Eq. F2-2 and F2-3 are both capped at Mp, so the ratio cannot go below
    // the fully braced value no matter how short the unbraced length.
    expect(checkFlexure(PHI_MP, A992, W18x50, 1).phiMn).toBeCloseTo(PHI_MP, 6);
    expect(checkFlexure(PHI_MP, A992, W18x50, 1).ratio).toBeCloseTo(1.0, 6);
  });

  it('is sign-independent', () => {
    expect(checkFlexure(-2000, A992, W18x50, 60).ratio).toBeCloseTo(
      checkFlexure(2000, A992, W18x50, 60).ratio, 12,
    );
  });

  it('reports no demand for zero moment, but still a capacity', () => {
    const { ratio, phiMn } = checkFlexure(0, A992, W18x50, 60);
    expect(ratio).toBe(0);
    expect(phiMn).toBeGreaterThan(0);
  });
});

describe('AISC 360-16 F3 — I-shapes with noncompact or slender flanges', () => {
  // W14x90, AISC Manual Table 1-1. bf/2tf = 10.2 exceeds lambda_pf = 9.15 at
  // Fy = 50 ksi, so Table 3-2 marks it noncompact (note f) and tabulates
  // phi_b*Mpx = 574 kip-ft, below phi*Fy*Zx = 589 kip-ft.
  const W14x90: Section = {
    id: 'W14x90', name: 'W14x90', shape: 'I',
    A: 26.5, Ix: 999, Iy: 362, J: 4.06,
    Sx: 143, Sy: 49.9, Zx: 157, Zy: 75.6,
    rx: 6.14, ry: 3.70, d: 14.0, bf: 14.5, tf: 0.710, tw: 0.440,
  };

  it('classifies the W14x90 flange as noncompact per Table B4.1b', () => {
    const s = iShapeSlenderness(W14x90, 29000, 50)!;
    expect(s.lambdaF).toBeCloseTo(10.21, 2);
    expect(s.lambdaPf).toBeCloseTo(9.15, 2);  // 0.38 sqrt(E/Fy)
    expect(s.lambdaRf).toBeCloseTo(24.08, 2); // 1.0 sqrt(E/Fy)
    expect(s.flange).toBe('noncompact');
    expect(s.web).toBe('compact');
  });

  it('matches the tabulated W14x90 capacity with Eq. F3-1', () => {
    // Hand calc, Lb <= Lp so LTB does not govern:
    //   Mp = 50 * 157 = 7850 kip-in, 0.7 Fy Sx = 35 * 143 = 5005 kip-in
    //   Mn = 7850 - (7850 - 5005)(10.211 - 9.152)/(24.083 - 9.152) = 7648 kip-in
    //   phi Mn = 0.9 * 7648 = 6883 kip-in = 573.6 kip-ft (Manual: 574)
    const { phiMn } = checkFlexure(0, A992, W14x90, 12);
    expect(phiMn).toBeCloseTo(6883.3, 0);
    expect(phiMn / 12).toBeCloseTo(574, 0);
    expect(phiMn).toBeLessThan(0.9 * 50 * 157);
  });

  it('applies Eq. F3-1 to a noncompact HEA 300 in SI units', () => {
    // HEA 300, S355-class steel taken as Fy = 345 MPa, E = 200000 MPa.
    // Wpl,y = 1383 cm3, Wel,y = 1260 cm3, b/2tf = 300/28 = 10.714.
    //   lambda_pf = 0.38 sqrt(200000/345) = 9.149, lambda_rf = 24.077
    //   Mp = 345 * 1383e3 = 477.1 kN-m, 0.7 Fy Sx = 0.7 * 345 * 1260e3 = 304.3 kN-m
    //   Mn = 477.1 - (477.1 - 304.3)(10.714 - 9.149)/(24.077 - 9.149) = 459.0 kN-m
    //   phi Mn = 413.1 kN-m
    const hea300 = euroToSection(EURO_SECTIONS.find((s) => s.name === 'HEA300')!);
    const steel345: Material = {
      ...A992,
      E: 200000 / KSI_TO_MPA,
      fy: 345 / KSI_TO_MPA,
    };
    const { phiMn } = checkFlexure(0, steel345, hea300, 12);
    expect(phiMn * KIPIN_TO_KNM).toBeCloseTo(0.9 * 459.0, 0);
    // Without F3 the capacity would be phi Mp = 429.4 kN-m.
    expect(phiMn * KIPIN_TO_KNM).toBeLessThan(0.9 * 477.1);
  });

  it('leaves a compact IPE 300 at phi Mp', () => {
    const ipe300 = euroToSection(EURO_SECTIONS.find((s) => s.name === 'IPE300')!);
    expect(checkFlexure(0, A992, ipe300, 12).phiMn).toBeCloseTo(0.9 * 50 * (ipe300.Zx ?? 0), 6);
  });

  it('lets lateral-torsional buckling govern when it is lower', () => {
    const short = checkFlexure(0, A992, W14x90, 12).phiMn;
    const long = checkFlexure(0, A992, W14x90, 40 * 12).phiMn;
    expect(long).toBeLessThan(short);
  });

  it('uses Eq. F3-2 for a slender flange', () => {
    // Built-up style flange, bf/2tf = 30 > lambda_rf = 24.08; h/tw = (24 - 2 * 0.5)/0.5 = 46
    //   kc = 4 / sqrt(46) = 0.590, Mn = 0.9 * 29000 * 0.583 * Sx / 30^2
    const plate: Section = {
      id: 'P', name: 'Custom', shape: 'I',
      A: 30, Ix: 2000, Iy: 300, J: 1,
      Sx: 160, Zx: 175, ry: 3.2, d: 24, bf: 30, tf: 0.5, tw: 0.5,
    };
    const kc = 4 / Math.sqrt(46);
    const expected = 0.9 * (0.9 * 29000 * kc * 160) / 30 ** 2;
    expect(checkFlexure(0, A992, plate, 12).phiMn).toBeCloseTo(expected, 6);
  });

  it('does not apply flange local buckling to HSS', () => {
    const hss: Section = {
      id: 'H', name: 'HSS6x4x3/8', shape: 'HSS',
      A: 6.18, Ix: 26.3, Iy: 13.7, J: 30.2,
      Sx: 8.76, Zx: 10.9, ry: 1.49, d: 6, bf: 4, tf: 0.1, tw: 0.1,
    };
    expect(checkFlexure(0, A992, hss, 12).phiMn).toBeCloseTo(0.9 * 50 * 10.9, 6);
  });

  it('flags a noncompact web as indicative', () => {
    const deepWeb: Section = {
      id: 'D', name: 'Girder', shape: 'I',
      A: 40, Ix: 20000, Iy: 500, J: 5,
      Sx: 800, Zx: 900, ry: 3.5, d: 50, bf: 14, tf: 1, tw: 0.4,
    };
    const result = checkFlexure(100, A992, deepWeb, 12);
    expect(result.indicative?.reason).toBe(NONCOMPACT_WEB_REASON);
    expect(designSteelElement('G', 0, 0, 100, A992, deepWeb, 12).indicative?.reason).toBe(NONCOMPACT_WEB_REASON);
    expect(checkFlexure(100, A992, W14x90, 12).indicative).toBeUndefined();
  });

  it('finds which EN sections have noncompact flanges', () => {
    const noncompactAt = (E: number, Fy: number) =>
      EURO_SECTIONS
        .filter((s) => iShapeSlenderness(euroToSection(s), E, Fy)?.flange !== 'compact')
        .map((s) => s.name);
    const expected = ['HEA180', 'HEA200', 'HEA220', 'HEA240', 'HEA260', 'HEA280', 'HEA300', 'HEA320'];
    expect(noncompactAt(29000, 50)).toEqual(expected);
    expect(noncompactAt(200000, 345)).toEqual(expected);
    // No EN section has a slender flange or a noncompact web at these grades.
    for (const s of EURO_SECTIONS) {
      const sl = iShapeSlenderness(euroToSection(s), 29000, 50)!;
      expect(sl.flange).not.toBe('slender');
      expect(sl.web).toBe('compact');
    }
  });
});

describe('AISC 360 Chapter H — combined forces', () => {
  it('uses Eq. H1-1a when Pr/Pc >= 0.2', () => {
    // 0.5 + (8/9)(0.3 + 0.0) = 0.7667
    expect(checkCombined(0.5, 0.3, 0)).toBeCloseTo(0.5 + (8 / 9) * 0.3, 12);
  });

  it('uses Eq. H1-1b when Pr/Pc < 0.2', () => {
    // 0.1/2 + (0.5 + 0.0) = 0.55
    expect(checkCombined(0.1, 0.5, 0)).toBeCloseTo(0.55, 12);
  });

  it('switches equations exactly at Pr/Pc = 0.2', () => {
    expect(checkCombined(0.2, 0.3, 0)).toBeCloseTo(0.2 + (8 / 9) * 0.3, 12);
    expect(checkCombined(0.199999, 0.3, 0)).toBeCloseTo(0.199999 / 2 + 0.3, 6);
  });

  it('includes weak-axis bending', () => {
    expect(checkCombined(0.5, 0.2, 0.1)).toBeCloseTo(0.5 + (8 / 9) * 0.3, 12);
  });

  it('returns zero when nothing is applied', () => {
    expect(checkCombined(0, 0, 0)).toBe(0);
  });
});

describe('AISC 360 — element result', () => {
  it('is a code check, not indicative, for a compact rolled shape', () => {
    // Only a noncompact or slender web (F4/F5, not implemented) flags it.
    expect(designSteelElement('S1', 50, 0, 1200, A992, W12x26, 144).indicative).toBeUndefined();
    expect(designSteelElement('S2', 0, 50, 1200, A992, W12x26, 144).indicative).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import type { Material, Section } from '../../core/types';
import { checkTension } from '../aisc360/tension';
import { checkCompression } from '../aisc360/compression';
import { checkFlexure } from '../aisc360/flexure';
import { checkCombined } from '../aisc360/combined';

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

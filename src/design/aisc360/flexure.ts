import type { Material, Section } from '../../core/types';
import type { IndicativeNote } from '../types';

/** Why a flexure ratio is indicative. Shown wherever the ratio is. */
export const NONCOMPACT_WEB_REASON =
  'Web is noncompact or slender for flexure (h/tw > 3.76 sqrt(E/Fy)). ' +
  'AISC 360 F4/F5 are not implemented, so the capacity assumes a compact web.';

export type Compactness = 'compact' | 'noncompact' | 'slender';

export interface IShapeSlenderness {
  /** Flange width-to-thickness ratio bf / (2 tf) */
  lambdaF: number;
  /** Table B4.1b case 10: 0.38 sqrt(E/Fy) */
  lambdaPf: number;
  /** Table B4.1b case 10: 1.0 sqrt(E/Fy) */
  lambdaRf: number;
  flange: Compactness;
  /**
   * Web ratio h / tw, or undefined without d. h is taken as d - 2 tf, the
   * clear distance between flanges. The Specification deducts the fillets
   * too, so this is slightly conservative.
   */
  lambdaW?: number;
  /** Table B4.1b case 15: 3.76 sqrt(E/Fy) */
  lambdaPw: number;
  web?: Compactness;
}

/**
 * True for a doubly symmetric rolled I-shape, the scope of F2 and F3. Uses
 * `shape` when present; sections saved before it existed fall back to the
 * W name prefix.
 */
export function isIShape(section: Section): boolean {
  if (section.shape) return section.shape === 'I';
  return /^W\d/i.test(section.name);
}

/**
 * Flange and web slenderness of an I-shape in flexure, AISC 360-16 Table
 * B4.1b cases 10 and 15. Null when bf or tf is missing.
 */
export function iShapeSlenderness(section: Section, E: number, Fy: number): IShapeSlenderness | null {
  const { bf, tf, tw, d } = section;
  if (!bf || !tf) return null;
  const root = Math.sqrt(E / Fy);
  const lambdaF = bf / (2 * tf);
  const lambdaPf = 0.38 * root;
  const lambdaRf = 1.0 * root;
  const lambdaPw = 3.76 * root;
  const lambdaRw = 5.70 * root;
  const flange: Compactness =
    lambdaF <= lambdaPf ? 'compact' : lambdaF <= lambdaRf ? 'noncompact' : 'slender';
  const result: IShapeSlenderness = { lambdaF, lambdaPf, lambdaRf, flange, lambdaPw };
  if (d && tw) {
    const lambdaW = (d - 2 * tf) / tw;
    result.lambdaW = lambdaW;
    result.web = lambdaW <= lambdaPw ? 'compact' : lambdaW <= lambdaRw ? 'noncompact' : 'slender';
  }
  return result;
}

/**
 * AISC 360 Chapter F — Flexure of doubly symmetric I-shapes about the strong
 * axis.
 *
 * Considers yielding (Mp), lateral-torsional buckling (F2, simplified) and,
 * for I-shapes with noncompact or slender flanges, compression flange local
 * buckling (F3). The lower of LTB and FLB governs, as F3 requires.
 * φ = 0.90 (LRFD)
 *
 * A noncompact or slender web (F4/F5) is not implemented; such a result is
 * flagged indicative.
 *
 * Returns: { ratio, phiMn, indicative? }
 *
 * φMn depends on the section and the unbraced length, not on the demand, so it
 * is reported even when there is no moment to check.
 */
export function checkFlexure(
  Mu: number,         // Required moment (kip-in, absolute value)
  material: Material,
  section: Section,
  Lb: number           // Unbraced length (in)
): { ratio: number; phiMn: number; indicative?: IndicativeNote } {
  const E = material.E;
  const fy = material.fy || 50;
  const phi = 0.90;

  const Zx = section.Zx || (section.Sx ? section.Sx * 1.12 : section.Ix / ((section.d || 12) / 2) * 1.12);
  const Sx = section.Sx || section.Ix / ((section.d || 12) / 2);
  const Iy = section.Iy;
  const J = section.J;
  const ry = section.ry || Math.sqrt(Iy / section.A);

  // Plastic moment
  const Mp = fy * Zx;

  // Limiting laterally unbraced lengths (simplified)
  const Lp = 1.76 * ry * Math.sqrt(E / fy);

  // Approximate Lr
  const c = 1.0; // For doubly symmetric I-shapes
  const rts = Math.sqrt(Math.sqrt(Iy * c) / Sx) * 1.5; // Approximate
  const Lr = 1.95 * rts * (E / (0.7 * fy)) *
    Math.sqrt((J * c) / (Sx * (section.d || 12) / 2) +
    Math.sqrt(Math.pow((J * c) / (Sx * (section.d || 12) / 2), 2) +
    6.76 * Math.pow(0.7 * fy / E, 2)));

  let Mn: number;

  if (Lb <= Lp) {
    // Yielding governs (Eq. F2-1)
    Mn = Mp;
  } else if (Lb <= Lr) {
    // Inelastic LTB (Eq. F2-2)
    const Cb = 1.0; // Conservative
    Mn = Math.min(Cb * (Mp - (Mp - 0.7 * fy * Sx) * ((Lb - Lp) / (Lr - Lp))), Mp);
  } else {
    // Elastic LTB (Eq. F2-3)
    const Cb = 1.0;
    const Fe_ltb = (Cb * Math.PI * Math.PI * E) / Math.pow(Lb / rts, 2);
    Mn = Math.min(Fe_ltb * Sx, Mp);
  }

  let indicative: IndicativeNote | undefined;
  const slender = isIShape(section) ? iShapeSlenderness(section, E, fy) : null;
  if (slender) {
    const { lambdaF: lambda, lambdaPf, lambdaRf } = slender;
    if (slender.flange === 'noncompact') {
      // Compression flange local buckling, noncompact flange (Eq. F3-1)
      const MnFlb = Mp - (Mp - 0.7 * fy * Sx) * ((lambda - lambdaPf) / (lambdaRf - lambdaPf));
      Mn = Math.min(Mn, MnFlb);
    } else if (slender.flange === 'slender') {
      // Compression flange local buckling, slender flange (Eq. F3-2), with
      // kc = 4 / sqrt(h/tw) kept between 0.35 and 0.76. Without the web
      // ratio the lower bound 0.35 is used.
      const kc = slender.lambdaW ? Math.min(0.76, Math.max(0.35, 4 / Math.sqrt(slender.lambdaW))) : 0.35;
      const MnFlb = (0.9 * E * kc * Sx) / (lambda * lambda);
      Mn = Math.min(Mn, MnFlb);
    }
    if (slender.web && slender.web !== 'compact') {
      indicative = { reason: NONCOMPACT_WEB_REASON };
    }
  }

  const phiMn = phi * Mn;
  const ratio = Math.abs(Mu) < 1e-10 ? 0 : Math.abs(Mu) / phiMn;

  return indicative ? { ratio, phiMn, indicative } : { ratio, phiMn };
}

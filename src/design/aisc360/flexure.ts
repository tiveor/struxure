import type { Material, Section } from '../../core/types';

/**
 * AISC 360 Chapter F — Flexure (simplified for compact doubly-symmetric I-shapes)
 *
 * Considers yielding (Mp) and lateral-torsional buckling (LTB).
 * φ = 0.90 (LRFD)
 */
export function checkFlexure(
  Mu: number,         // Required moment (kip-in, absolute value)
  material: Material,
  section: Section,
  Lb: number           // Unbraced length (in)
): number {
  if (Math.abs(Mu) < 1e-10) return 0;

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

  const phiMn = phi * Mn;
  return Math.abs(Mu) / phiMn;
}

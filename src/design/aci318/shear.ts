import type { Material, Section } from '../../core/types';

/**
 * ACI 318 Shear Design for Beams
 *
 * Vc = 2 * √f'c * bw * d (simplified, Eq. 22.5.5.1)
 * φ = 0.75 for shear
 *
 * Returns: { ratio, AvRequired, phiVn }
 *
 * phiVn is the governing shear capacity: phi*Vc where the concrete alone
 * carries the demand, and phi*(Vc + Vs) once stirrups are required.
 */
export function checkShear(
  Vu: number,         // Required shear (kips, absolute)
  material: Material,
  section: Section
): { ratio: number; AvRequired: number; phiVn: number } {
  const fc = (material.fc || 4); // ksi
  const fy_stirrup = 60; // Grade 60 stirrups (ksi)
  const phi = 0.75;

  const bw = section.b || section.bf || 12; // width (in)
  const h = section.h || section.d || 24;
  const d = h - 2.5; // effective depth

  // Concrete shear capacity, ACI 318-19 Eq. 22.5.5.1: Vc = 2*lambda*sqrt(f'c)*bw*d.
  // That expression takes f'c in psi and returns pounds, so f'c is scaled up
  // from ksi and the result scaled back down to kips.
  const Vc = (2 * Math.sqrt(fc * 1000) * bw * d) / 1000; // kips

  const phiVc = phi * Vc;

  if (Math.abs(Vu) < 1e-10) return { ratio: 0, AvRequired: 0, phiVn: phiVc };

  if (Math.abs(Vu) <= phiVc) {
    // Concrete alone is sufficient
    return { ratio: Math.abs(Vu) / phiVc, AvRequired: 0, phiVn: phiVc };
  }

  // Required Vs = Vu/φ - Vc
  const Vs_required = Math.abs(Vu) / phi - Vc;

  // Maximum Vs limit, ACI 318-19 22.5.1.2: Vs_max = 8*sqrt(f'c)*bw*d, same units.
  const Vs_max = (8 * Math.sqrt(fc * 1000) * bw * d) / 1000;

  if (Vs_required > Vs_max) {
    // Past the ceiling the section can reach, so report that ceiling rather
    // than a capacity sized to a demand it cannot carry.
    return { ratio: 10, AvRequired: 999, phiVn: phi * (Vc + Vs_max) };
  }

  // Required stirrup area: Av/s = Vs / (fy * d)
  // Assuming s = d/2 (typical maximum spacing)
  const s = d / 2;
  const AvRequired = (Vs_required * s) / (fy_stirrup * d);

  const phiVn = phi * (Vc + Vs_required);
  const ratio = Math.abs(Vu) / phiVn;

  return { ratio, AvRequired, phiVn };
}

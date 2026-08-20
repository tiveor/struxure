import type { Material, Section } from '../../core/types';

/**
 * ACI 318 Shear Design for Beams
 *
 * Vc = 2 * √f'c * bw * d (simplified, Eq. 22.5.5.1)
 * φ = 0.75 for shear
 *
 * Returns: { ratio, AvRequired }
 */
export function checkShear(
  Vu: number,         // Required shear (kips, absolute)
  material: Material,
  section: Section
): { ratio: number; AvRequired: number } {
  if (Math.abs(Vu) < 1e-10) return { ratio: 0, AvRequired: 0 };

  const fc = (material.fc || 4); // ksi
  const fy_stirrup = 60; // Grade 60 stirrups (ksi)
  const phi = 0.75;

  const bw = section.b || section.bf || 12; // width (in)
  const h = section.h || section.d || 24;
  const d = h - 2.5; // effective depth

  // Concrete shear capacity: Vc = 2√f'c * bw * d (in kips, f'c in ksi)
  // Note: ACI uses f'c in psi traditionally, but we're in ksi
  // Vc = 2 * √(f'c * 1000) * bw * d / 1000 = 2 * √(f'c) * √1000 * bw * d / 1000
  const Vc = 2 * Math.sqrt(fc) * bw * d; // kips (when fc in ksi and dimensions in inches)

  const phiVc = phi * Vc;

  if (Math.abs(Vu) <= phiVc) {
    // Concrete alone is sufficient
    return { ratio: Math.abs(Vu) / phiVc, AvRequired: 0 };
  }

  // Required Vs = Vu/φ - Vc
  const Vs_required = Math.abs(Vu) / phi - Vc;

  // Maximum Vs limit: Vs_max = 8√f'c * bw * d
  const Vs_max = 8 * Math.sqrt(fc) * bw * d;

  if (Vs_required > Vs_max) {
    return { ratio: 10, AvRequired: 999 };
  }

  // Required stirrup area: Av/s = Vs / (fy * d)
  // Assuming s = d/2 (typical maximum spacing)
  const s = d / 2;
  const AvRequired = (Vs_required * s) / (fy_stirrup * d);

  const phiVn = phi * (Vc + Vs_required);
  const ratio = Math.abs(Vu) / phiVn;

  return { ratio, AvRequired };
}

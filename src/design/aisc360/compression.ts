import type { Material, Section } from '../../core/types';

/**
 * AISC 360 Chapter E — Compression Members
 *
 * Flexural buckling about both axes. Uses effective length factor K = 1.0 (conservative).
 *
 * φ = 0.90 (LRFD)
 */
export function checkCompression(
  Pu: number,         // Required axial compression (kips, positive = compression)
  material: Material,
  section: Section,
  Lx: number,         // Unbraced length about strong axis (in)
  Ly: number           // Unbraced length about weak axis (in)
): number {
  if (Pu <= 0) return 0; // No compression demand

  const E = material.E;
  const fy = material.fy || 50;
  const Ag = section.A;
  const Ix = section.Ix;
  const Iy = section.Iy;
  const phi = 0.90;

  // Radius of gyration
  const rx = section.rx || Math.sqrt(Ix / Ag);
  const ry = section.ry || Math.sqrt(Iy / Ag);

  // Effective slenderness ratios (K = 1.0)
  const KLr_x = Lx / rx;
  const KLr_y = Ly / ry;
  const KLr = Math.max(KLr_x, KLr_y);

  // Euler stress
  const Fe = (Math.PI * Math.PI * E) / (KLr * KLr);

  // Critical stress Fcr
  let Fcr: number;
  if (KLr <= 4.71 * Math.sqrt(E / fy)) {
    // Inelastic buckling (Eq. E3-2)
    Fcr = Math.pow(0.658, fy / Fe) * fy;
  } else {
    // Elastic buckling (Eq. E3-3)
    Fcr = 0.877 * Fe;
  }

  const Pn = Fcr * Ag;
  const phiPn = phi * Pn;

  return Pu / phiPn;
}

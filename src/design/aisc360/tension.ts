import type { Material, Section } from '../../core/types';

/**
 * AISC 360 Chapter D — Tension Members
 *
 * Nominal strength: Pn = Fy * Ag (yielding on gross section)
 * φ = 0.90 (LRFD)
 *
 * Returns the D/C ratio for tension.
 */
export function checkTension(
  Pu: number,   // Required axial tension (kips, positive = tension)
  material: Material,
  section: Section
): number {
  if (Pu <= 0) return 0; // No tension demand

  const fy = material.fy || 50;
  const Ag = section.A;
  const phi = 0.90;
  const Pn = fy * Ag;
  const phiPn = phi * Pn;

  return Pu / phiPn;
}

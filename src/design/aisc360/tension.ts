import type { Material, Section } from '../../core/types';

/**
 * AISC 360 Chapter D — Tension Members
 *
 * Nominal strength: Pn = Fy * Ag (yielding on gross section)
 * φ = 0.90 (LRFD)
 *
 * Returns: { ratio, phiPn }
 *
 * φPn is a property of the section and the steel grade, so it is reported
 * whatever the demand is, including when the member is in compression.
 */
export function checkTension(
  Pu: number,   // Required axial tension (kips, positive = tension)
  material: Material,
  section: Section
): { ratio: number; phiPn: number } {
  const fy = material.fy || 50;
  const Ag = section.A;
  const phi = 0.90;
  const Pn = fy * Ag;
  const phiPn = phi * Pn;

  if (Pu <= 0) return { ratio: 0, phiPn }; // No tension demand

  return { ratio: Pu / phiPn, phiPn };
}

import type { Material, Section } from '../../core/types';

/**
 * ACI 318 Flexure Design for Rectangular Beams
 *
 * Whitney stress block method.
 * φ = 0.90 for tension-controlled sections
 *
 * Returns: { ratio, AsRequired }
 */
export function checkFlexure(
  Mu: number,         // Required moment (kip-in, absolute)
  material: Material,
  section: Section
): { ratio: number; AsRequired: number } {
  if (Math.abs(Mu) < 1e-10) return { ratio: 0, AsRequired: 0 };

  const fc = (material.fc || 4); // ksi
  const fy = 60; // Grade 60 rebar (ksi)
  const phi = 0.90;

  const b = section.b || section.bf || 12; // width (in)
  const h = section.h || section.d || 24;  // total depth (in)
  const d = h - 2.5; // effective depth (in) — approximate cover

  // Required As from moment equilibrium:
  // Mu = φ * As * fy * (d - a/2), where a = As*fy / (0.85*fc*b)
  // Solving quadratic: As = (0.85*fc*b*d / fy) * (1 - sqrt(1 - 2*Mu/(phi*0.85*fc*b*d²)))
  const factored = Math.abs(Mu) / phi;
  const Rn = factored / (b * d * d);
  const discriminant = 1 - (2 * Rn) / (0.85 * fc);

  let AsRequired: number;
  if (discriminant < 0) {
    // Section is too small — needs compression steel or larger section
    AsRequired = 999;
  } else {
    AsRequired = (0.85 * fc * b * d / fy) * (1 - Math.sqrt(discriminant));
  }

  // Enforce minimum As (ACI 318-19 9.6.1.2)
  const AsMin = Math.max(
    (3 * Math.sqrt(fc * 1000) / (fy * 1000)) * b * d,
    200 / (fy * 1000) * b * d * 1000
  );
  AsRequired = Math.max(AsRequired, AsMin);

  // Actual capacity with As provided = AsRequired
  const a = AsRequired * fy / (0.85 * fc * b);
  const phiMn = phi * AsRequired * fy * (d - a / 2);

  const ratio = Math.abs(Mu) / Math.max(phiMn, 1e-10);

  return { ratio: Math.min(ratio, 10), AsRequired };
}

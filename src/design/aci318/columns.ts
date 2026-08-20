import type { Material, Section } from '../../core/types';

/**
 * ACI 318 Column Design — Simplified P-M Interaction
 *
 * Uses a simplified linear interaction diagram for uniaxial bending.
 * φ = 0.65 for tied columns (compression-controlled)
 *
 * Points on simplified diagram:
 * - Pure compression: φPn0 = 0.80 * φ * (0.85*f'c*(Ag-Ast) + fy*Ast)
 * - Balanced: approximate
 * - Pure bending: φMn (from flexure check)
 *
 * Returns D/C ratio for the column.
 */
export function checkColumn(
  Pu: number,          // Required axial load (kips, positive = compression)
  Mu: number,          // Required moment (kip-in, absolute)
  material: Material,
  section: Section
): number {
  const fc = material.fc || 4; // ksi
  const fy = 60; // Grade 60 rebar (ksi)
  const phi = 0.65; // Compression-controlled

  const b = section.b || section.bf || 16; // Column width (in)
  const h = section.h || section.d || 16;  // Column depth (in)
  const Ag = b * h;
  const d = h - 2.5;

  // Assume 1% reinforcement ratio (typical)
  const rho = 0.01;
  const Ast = rho * Ag;

  // Pure axial capacity (with 0.80 factor for tied columns)
  const Pn0 = 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast);
  const phiPn0 = phi * Pn0;

  // Balanced condition (approximate)
  // eb ≈ 0.4h for rectangular columns
  const Pb = 0.85 * fc * b * 0.375 * d * 0.85; // Approximate balanced axial
  const Mb = Pb * 0.375 * d; // Approximate balanced moment
  const phiPb = phi * Pb;
  const phiMb = phi * Mb;

  // Pure moment capacity (approximate, As in tension only)
  const a = Ast / 2 * fy / (0.85 * fc * b);
  const Mn0 = (Ast / 2) * fy * (d - a / 2);
  const phiMn0 = 0.90 * Mn0; // Tension-controlled φ for pure moment

  // Simple linear interaction check between key points
  // For Pu > phiPb: interpolate between (phiPn0, 0) and (phiPb, phiMb)
  // For Pu <= phiPb: interpolate between (phiPb, phiMb) and (0, phiMn0)

  const absP = Math.abs(Pu);
  const absM = Math.abs(Mu);

  if (absP < 1e-10 && absM < 1e-10) return 0;

  let ratio: number;

  if (absP >= phiPb) {
    // Upper region: compression governs
    const availableM = phiMb * (1 - (absP - phiPb) / (phiPn0 - phiPb));
    ratio = absP / phiPn0 + absM / Math.max(availableM, 1);
  } else {
    // Lower region: tension transition
    const availableP = phiPb * (1 - absM / phiMb);
    ratio = absP / Math.max(availableP, 1) + absM / phiMn0;
  }

  return Math.min(ratio, 10);
}

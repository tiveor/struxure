import type { ColumnReinforcement, Material, Section } from '../../core/types';
import { barLayout, DEFAULT_REBAR_FY, totalSteelArea } from './rebar';
import {
  buildInteractionDiagram,
  interactionRatio,
  neutralAxisForPn,
  sectionStrengthAt,
  type InteractionSection,
} from './interaction';

/**
 * Longitudinal steel ratio Ast/Ag that checkColumn assumes in place of the
 * section's actual bars. Exported so results can state the assumption.
 */
export const ASSUMED_COLUMN_RHO = 0.01;

/** Why a checkColumn ratio is indicative. Shown wherever the ratio is. */
export const COLUMN_INDICATIVE_REASON =
  'ACI 318 column check assumes 1% steel and a simplified linear P-M interaction, not the actual bars. Screening only. Define the section reinforcement to get a full strain-compatibility check.';

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
 * Returns: { ratio, phiPn0, phiMn0 }
 *
 * phiPn0 and phiMn0 are the two anchors of that diagram — the pure axial and
 * pure bending capacities. They depend on the section, not on the demand.
 */
export function checkColumn(
  Pu: number,          // Required axial load (kips, positive = compression)
  Mu: number,          // Required moment (kip-in, absolute)
  material: Material,
  section: Section
): { ratio: number; phiPn0: number; phiMn0: number } {
  const fc = material.fc || 4; // ksi
  const fy = 60; // Grade 60 rebar (ksi)
  const phi = 0.65; // Compression-controlled

  const b = section.b || section.bf || 16; // Column width (in)
  const h = section.h || section.d || 16;  // Column depth (in)
  const Ag = b * h;
  const d = h - 2.5;

  // Assume 1% reinforcement ratio (typical)
  const rho = ASSUMED_COLUMN_RHO;
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

  if (absP < 1e-10 && absM < 1e-10) return { ratio: 0, phiPn0, phiMn0 };

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

  return { ratio: Math.min(ratio, 10), phiPn0, phiMn0 };
}

/**
 * Factored demand at one element end. P is positive in compression. Mx bends
 * about the section's strong axis (Ix, depth h, the analysis' local z) and My
 * about the weak axis (Iy, depth b, local y).
 */
export interface ColumnDemand {
  P: number;
  Mx: number;
  My: number;
}

/**
 * The section seen in each plane of bending: about x the depth is h and the
 * compression face is the +y face; about y the depth is b. The layout is
 * symmetric, so the choice of compression face does not change the result.
 */
export function columnInteractionSections(
  b: number,
  h: number,
  reinforcement: ColumnReinforcement,
  fc: number
): { x: InteractionSection; y: InteractionSection } {
  const fy = reinforcement.fy ?? DEFAULT_REBAR_FY;
  const bars = barLayout(b, h, reinforcement);
  return {
    x: { width: b, depth: h, fc, fy, bars: bars.map((bar) => ({ d: h / 2 - bar.y, area: bar.area })) },
    y: { width: h, depth: b, fc, fy, bars: bars.map((bar) => ({ d: b / 2 - bar.x, area: bar.area })) },
  };
}

/**
 * ACI 318-19 column check from the section's actual bars, by strain
 * compatibility (see interaction.ts). Uniaxial about the strong axis, the
 * moment checkColumn uses; when a weak-axis moment is present the biaxial
 * case uses the linear load contour (alpha = 1), which is conservative.
 *
 * The D/C ratio is the radial ratio to the phi-factored surface, governing
 * over all the demands given (one per element end), capped at 10 like
 * checkColumn.
 */
export function checkReinforcedColumn(
  demands: readonly ColumnDemand[],
  material: Material,
  section: Section & { b: number; h: number; reinforcement: ColumnReinforcement }
): { ratio: number; phiPnMax: number; phiPnt: number; phiMn0: number; AsProvided: number; rhoProvided: number } {
  const fc = material.fc || 4;
  const { b, h, reinforcement } = section;
  const secs = columnInteractionSections(b, h, reinforcement, fc);
  const diagX = buildInteractionDiagram(secs.x);
  const hasWeakMoment = demands.some((d) => Math.abs(d.My) > 1e-12);
  const diagY = hasWeakMoment ? buildInteractionDiagram(secs.y) : null;

  let ratio = 0;
  for (const d of demands) {
    ratio = Math.max(ratio, interactionRatio(diagX, diagY, d.P, d.Mx, d.My));
  }

  const AsProvided = totalSteelArea(reinforcement);
  const phiMn0 = sectionStrengthAt(secs.x, neutralAxisForPn(secs.x, 0)).phiMn;
  return {
    ratio: Math.min(ratio, 10),
    phiPnMax: diagX.phiPnMax,
    phiPnt: diagX.phiPnt,
    phiMn0,
    AsProvided,
    rhoProvided: AsProvided / (b * h),
  };
}

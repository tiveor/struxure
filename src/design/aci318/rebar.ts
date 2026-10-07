import type { ColumnReinforcement, Section } from '../../core/types';

/**
 * US customary reinforcing bars (ASTM A615/A706), nominal diameter (in) and
 * area (in^2) by bar designation. Source: ACI 318-19 Appendix A / CRSI
 * Manual of Standard Practice, nominal dimensions table.
 */
export const REBAR_SIZES: Readonly<Record<number, { diameter: number; area: number }>> = {
  3: { diameter: 0.375, area: 0.11 },
  4: { diameter: 0.5, area: 0.2 },
  5: { diameter: 0.625, area: 0.31 },
  6: { diameter: 0.75, area: 0.44 },
  7: { diameter: 0.875, area: 0.6 },
  8: { diameter: 1.0, area: 0.79 },
  9: { diameter: 1.128, area: 1.0 },
  10: { diameter: 1.27, area: 1.27 },
  11: { diameter: 1.41, area: 1.56 },
};

/** Longitudinal bar designations accepted, #3 to #11. */
export const LONGITUDINAL_BAR_SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

/** Tie bar designations accepted, #3 to #5 (ACI 318-19 25.7.2.2 uses #3 or #4). */
export const TIE_BAR_SIZES = [3, 4, 5] as const;

/** Default rebar yield strength, ksi (Grade 60). */
export const DEFAULT_REBAR_FY = 60;

/** A single longitudinal bar, positioned from the section centroid (in). */
export interface BarPosition {
  /** Offset along b, from the centroid (in) */
  x: number;
  /** Offset along h, from the centroid (in) */
  y: number;
  area: number;
}

/** Distance from a concrete face to the centre of the corner bars (in). */
export function coverToBarCenter(r: ColumnReinforcement): number {
  return r.cover + REBAR_SIZES[r.tieSize].diameter + REBAR_SIZES[r.barSize].diameter / 2;
}

/** Total number of longitudinal bars: corners are shared by two faces. */
export function totalBars(r: ColumnReinforcement): number {
  return 2 * r.barsAlongB + 2 * r.barsAlongH - 4;
}

/** Total longitudinal steel area Ast (in^2). */
export function totalSteelArea(r: ColumnReinforcement): number {
  return totalBars(r) * REBAR_SIZES[r.barSize].area;
}

function evenly(n: number, half: number): number[] {
  // n >= 2 positions from -half to +half, both ends included.
  return Array.from({ length: n }, (_, i) => -half + (2 * half * i) / (n - 1));
}

/**
 * Bar layout for a rectangular b x h section.
 *
 * Perimeter scheme: `barsAlongB` bars are spaced evenly along each of the two
 * faces of width b (the top and bottom faces for bending about the strong
 * axis), and `barsAlongH` bars along each of the two faces of depth h.
 * Both counts include the corner bars, so the layout is symmetric about both
 * axes and has 2*barsAlongB + 2*barsAlongH - 4 bars in total.
 */
export function barLayout(b: number, h: number, r: ColumnReinforcement): BarPosition[] {
  const dc = coverToBarCenter(r);
  const area = REBAR_SIZES[r.barSize].area;
  const hx = b / 2 - dc;
  const hy = h / 2 - dc;
  const bars: BarPosition[] = [];
  for (const x of evenly(r.barsAlongB, hx)) {
    bars.push({ x, y: hy, area }, { x, y: -hy, area });
  }
  // Interior bars of the side faces (corners already placed above).
  const sideYs = evenly(r.barsAlongH, hy).slice(1, -1);
  for (const y of sideYs) {
    bars.push({ x: -hx, y, area }, { x: hx, y, area });
  }
  return bars;
}

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isPositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Validate a section's optional reinforcement. Returns human-readable errors,
 * empty when the reinforcement is absent or valid. Accepts unknown input so
 * the model validators can run it on unparsed JSON.
 */
export function reinforcementErrors(section: Record<string, unknown>): string[] {
  const r = section.reinforcement;
  if (r === undefined) return [];
  if (typeof r !== 'object' || r === null || Array.isArray(r)) {
    return ['"reinforcement" must be an object'];
  }
  const rec = r as Record<string, unknown>;
  const errors: string[] = [];

  if (!isPositive(section.b) || !isPositive(section.h)) {
    errors.push('reinforcement needs positive "b" and "h" (rectangular section)');
  }
  if (typeof rec.cover !== 'number' || !Number.isFinite(rec.cover) || rec.cover < 0) {
    errors.push('reinforcement "cover" must be a number >= 0');
  }
  if (!isInteger(rec.barSize) || !(LONGITUDINAL_BAR_SIZES as readonly number[]).includes(rec.barSize)) {
    errors.push('reinforcement "barSize" must be a bar designation from 3 to 11');
  }
  if (!isInteger(rec.tieSize) || !(TIE_BAR_SIZES as readonly number[]).includes(rec.tieSize)) {
    errors.push('reinforcement "tieSize" must be a bar designation from 3 to 5');
  }
  for (const key of ['barsAlongB', 'barsAlongH']) {
    if (!isInteger(rec[key]) || (rec[key] as number) < 2) {
      errors.push(`reinforcement "${key}" must be an integer >= 2 (corner bars included)`);
    }
  }
  if (rec.fy !== undefined && !isPositive(rec.fy)) {
    errors.push('reinforcement "fy" must be a positive number (ksi)');
  }
  if (errors.length > 0) return errors;

  // Geometry: the bars must fit inside the section without overlapping.
  const reinf = rec as unknown as ColumnReinforcement;
  const b = section.b as number;
  const h = section.h as number;
  const dc = coverToBarCenter(reinf);
  const db = REBAR_SIZES[reinf.barSize].diameter;
  const spanB = b - 2 * dc;
  const spanH = h - 2 * dc;
  if (spanB < db || spanH < db) {
    errors.push('reinforcement does not fit: cover, ties and bars exceed the section');
    return errors;
  }
  if (spanB / (reinf.barsAlongB - 1) < db || spanH / (reinf.barsAlongH - 1) < db) {
    errors.push('reinforcement does not fit: too many bars along a face, they would overlap');
  }
  return errors;
}

/** Narrowing helper: the section has b, h and valid reinforcement. */
export function hasValidReinforcement(
  section: Section
): section is Section & { b: number; h: number; reinforcement: ColumnReinforcement } {
  return (
    section.reinforcement !== undefined &&
    reinforcementErrors(section as unknown as Record<string, unknown>).length === 0
  );
}

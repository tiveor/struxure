/** Color mapping utilities for FEA visualization (stress heatmaps) */

export type ColorScheme = 'jet' | 'thermal' | 'blueRed';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Jet colormap (classic FEA): Blue → Cyan → Green → Yellow → Red
 * @param t - normalized value between 0 and 1
 */
export function jetColormap(t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.min(1, Math.max(0, 1.5 - Math.abs(clamped - 0.75) * 4));
  const g = Math.min(1, Math.max(0, 1.5 - Math.abs(clamped - 0.50) * 4));
  const b = Math.min(1, Math.max(0, 1.5 - Math.abs(clamped - 0.25) * 4));
  return { r, g, b };
}

/**
 * Thermal colormap: Black → Red → Yellow → White
 */
export function thermalColormap(t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.min(1, clamped * 3),
    g: Math.min(1, Math.max(0, (clamped - 0.33) * 3)),
    b: Math.min(1, Math.max(0, (clamped - 0.66) * 3)),
  };
}

/**
 * Blue-to-Red diverging colormap
 */
export function blueRedColormap(t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: clamped,
    g: 1 - Math.abs(clamped - 0.5) * 2,
    b: 1 - clamped,
  };
}

/**
 * Get color from a named color scheme.
 */
export function getSchemeColor(scheme: ColorScheme, t: number): RGB {
  switch (scheme) {
    case 'jet': return jetColormap(t);
    case 'thermal': return thermalColormap(t);
    case 'blueRed': return blueRedColormap(t);
  }
}

/**
 * Normalize a value to 0-1 range given min and max.
 * Returns 0.5 if min === max (avoid division by zero).
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (min === max) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Compute axial stress: σ = N / A
 */
export function computeAxialStress(N: number, A: number): number {
  if (A === 0) return 0;
  return Math.abs(N / A);
}

/**
 * Compute bending stress: σ = M / S
 */
export function computeBendingStress(M: number, S: number): number {
  if (S === 0) return 0;
  return Math.abs(M / S);
}

/**
 * Compute combined stress: σ_axial + σ_bending
 */
export function computeCombinedStress(N: number, A: number, M: number, S: number): number {
  return computeAxialStress(N, A) + computeBendingStress(M, S);
}

/** Heatmap variable options */
export type HeatmapVariable = 'none' | 'dc_ratio' | 'displacement' | 'axial_stress' | 'combined_stress';

/**
 * Absolute design demand/capacity (D/C) colour bands, independent of any
 * particular model's min/max range. Used both for the 3D viewport's design
 * view mode and for the PDF report's screenshot + legend, so the two never
 * drift apart.
 */
export interface DesignBand {
  /** Inclusive upper bound of the band's D/C ratio, or null for the open-ended top band */
  readonly max: number | null;
  readonly color: string;
  readonly label: string;
}

export const DESIGN_BANDS: readonly DesignBand[] = [
  { max: 0.5, color: '#22c55e', label: 'D/C ≤ 0.50' },
  { max: 0.75, color: '#eab308', label: '0.50 – 0.75' },
  { max: 1.0, color: '#f97316', label: '0.75 – 1.00' },
  { max: null, color: '#ef4444', label: '> 1.00 (fails)' },
];

/** Map a design D/C ratio to its absolute band colour. */
export function getDesignColor(ratio: number): string {
  for (const band of DESIGN_BANDS) {
    if (band.max === null || ratio <= band.max) return band.color;
  }
  return DESIGN_BANDS[DESIGN_BANDS.length - 1].color;
}

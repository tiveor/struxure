// ─── Unit System Types ──────────────────────────────────────────────

export type UnitSystem = 'imperial' | 'metric';

export type QuantityType =
  | 'length'
  | 'force'
  | 'moment'
  | 'stress'
  | 'area'
  | 'momentOfInertia'
  | 'displacement'
  | 'forcePerLength';

// ─── Labels ─────────────────────────────────────────────────────────

const IMPERIAL_LABELS: Record<QuantityType, string> = {
  length: 'in',
  force: 'kip',
  moment: 'kip-in',
  stress: 'ksi',
  area: 'in\u00B2',
  momentOfInertia: 'in\u2074',
  displacement: 'in',
  forcePerLength: 'kip/in',
};

const METRIC_LABELS: Record<QuantityType, string> = {
  length: 'mm',
  force: 'kN',
  moment: 'kN-mm',
  stress: 'MPa',
  area: 'mm\u00B2',
  momentOfInertia: 'mm\u2074',
  displacement: 'mm',
  forcePerLength: 'kN/mm',
};

// Multiply imperial value by factor to get metric value
const METRIC_FACTORS: Record<QuantityType, number> = {
  length: 25.4,
  force: 4.44822,
  moment: 112.985,
  stress: 6.89476,
  area: 645.16,
  momentOfInertia: 416_231,
  displacement: 25.4,
  forcePerLength: 4.44822 / 25.4, // kip/in → kN/mm
};

// ─── Public API ─────────────────────────────────────────────────────

export function unitLabel(qty: QuantityType, system: UnitSystem): string {
  return system === 'imperial' ? IMPERIAL_LABELS[qty] : METRIC_LABELS[qty];
}

export function systemLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'Imperial (kip-in-ksi)' : 'SI Metric (kN-mm-MPa)';
}

/** Convert internal imperial value → display value */
export function toDisplay(value: number, qty: QuantityType, system: UnitSystem): number {
  if (system === 'imperial') return value;
  return value * METRIC_FACTORS[qty];
}

/** Convert display value → internal imperial value */
export function fromDisplay(value: number, qty: QuantityType, system: UnitSystem): number {
  if (system === 'imperial') return value;
  return value / METRIC_FACTORS[qty];
}

// ─── Unit System Types ──────────────────────────────────────────────
//
// The model is stored and analysed in kip-inch-ksi. These helpers only
// convert at the display boundary: `toDisplay` for anything shown to the
// user, `fromDisplay` for anything the user types.

export type UnitSystem = 'imperial' | 'metric';

export type QuantityType =
  /** Model geometry: node coordinates, spans, element lengths. */
  | 'length'
  /** Cross-section dimensions: d, bf, tf, tw, b, h, cover. */
  | 'sectionDimension'
  /** Nodal translations. */
  | 'displacement'
  | 'force'
  | 'moment'
  /** Distributed line load. */
  | 'forcePerLength'
  /** Stresses and moduli: fy, fu, f'c, E, G. */
  | 'stress'
  | 'area'
  /** Second moments of area and the torsional constant: Ix, Iy, J. */
  | 'momentOfInertia'
  /** Elastic and plastic section moduli: Sx, Sy, Zx, Zy. */
  | 'sectionModulus'
  /** Material density. Stored internally as weight density in kip/in^3. */
  | 'density'
  /**
   * Member weight per unit length. Stored as lb/ft, the unit the AISC
   * shape tables publish, not as kip/in.
   */
  | 'weightPerLength';

export const QUANTITY_TYPES: readonly QuantityType[] = [
  'length',
  'sectionDimension',
  'displacement',
  'force',
  'moment',
  'forcePerLength',
  'stress',
  'area',
  'momentOfInertia',
  'sectionModulus',
  'density',
  'weightPerLength',
];

// ─── Exact base conversions ─────────────────────────────────────────

export const IN_TO_M = 0.0254;
export const IN_TO_MM = 25.4;
export const KIP_TO_KN = 4.4482216152605;
export const KSI_TO_MPA = 6.894757293168361;
export const LB_TO_KG = 0.45359237;
export const FT_TO_M = 0.3048;

// ─── Labels ─────────────────────────────────────────────────────────

const IMPERIAL_LABELS: Record<QuantityType, string> = {
  length: 'in',
  sectionDimension: 'in',
  displacement: 'in',
  force: 'kip',
  moment: 'kip-in',
  forcePerLength: 'kip/in',
  stress: 'ksi',
  area: 'in²',
  momentOfInertia: 'in⁴',
  sectionModulus: 'in³',
  density: 'lb/ft³',
  weightPerLength: 'lb/ft',
};

const METRIC_LABELS: Record<QuantityType, string> = {
  length: 'm',
  sectionDimension: 'mm',
  displacement: 'mm',
  force: 'kN',
  moment: 'kN-m',
  forcePerLength: 'kN/m',
  stress: 'MPa',
  area: 'mm²',
  momentOfInertia: 'mm⁴',
  sectionModulus: 'mm³',
  density: 'kg/m³',
  weightPerLength: 'kg/m',
};

// ─── Factors ────────────────────────────────────────────────────────
// Multiply the internal value by the factor to get the display value.

const IMPERIAL_FACTORS: Record<QuantityType, number> = {
  length: 1,
  sectionDimension: 1,
  displacement: 1,
  force: 1,
  moment: 1,
  forcePerLength: 1,
  stress: 1,
  area: 1,
  momentOfInertia: 1,
  sectionModulus: 1,
  // kip/in^3 -> lb/ft^3: 1000 lb per kip, 1728 in^3 per ft^3
  density: 1000 * 1728,
  weightPerLength: 1,
};

const METRIC_FACTORS: Record<QuantityType, number> = {
  length: IN_TO_M,
  sectionDimension: IN_TO_MM,
  displacement: IN_TO_MM,
  force: KIP_TO_KN,
  moment: KIP_TO_KN * IN_TO_M, // kip-in -> kN-m
  forcePerLength: KIP_TO_KN / IN_TO_M, // kip/in -> kN/m
  stress: KSI_TO_MPA,
  area: IN_TO_MM ** 2,
  momentOfInertia: IN_TO_MM ** 4,
  sectionModulus: IN_TO_MM ** 3,
  // kip/in^3 (weight) -> kg/m^3 (mass) under standard gravity, where one
  // pound-force weighs one pound-mass.
  density: (1000 * LB_TO_KG) / IN_TO_M ** 3,
  weightPerLength: LB_TO_KG / FT_TO_M, // lb/ft -> kg/m
};

/** Display decimals used by `formatQuantity` when the caller passes none. */
const DEFAULT_DECIMALS: Record<UnitSystem, Record<QuantityType, number>> = {
  imperial: {
    length: 2,
    sectionDimension: 2,
    displacement: 4,
    force: 2,
    moment: 2,
    forcePerLength: 3,
    stress: 1,
    area: 2,
    momentOfInertia: 1,
    sectionModulus: 1,
    density: 1,
    weightPerLength: 1,
  },
  metric: {
    length: 3,
    sectionDimension: 1,
    displacement: 2,
    force: 2,
    moment: 2,
    forcePerLength: 2,
    stress: 1,
    area: 0,
    momentOfInertia: 0,
    sectionModulus: 0,
    density: 0,
    weightPerLength: 1,
  },
};

// ─── Public API ─────────────────────────────────────────────────────

export interface UnitLabelOptions {
  /** Spell exponents as ^2, ^3, ^4 for CSV and other plain-text outputs. */
  ascii?: boolean;
}

const SUPERSCRIPTS: Record<string, string> = {
  '²': '^2',
  '³': '^3',
  '⁴': '^4',
};

export function unitLabel(qty: QuantityType, system: UnitSystem, options: UnitLabelOptions = {}): string {
  const label = system === 'imperial' ? IMPERIAL_LABELS[qty] : METRIC_LABELS[qty];
  if (!options.ascii) return label;
  return label.replace(/[²³⁴]/g, (c) => SUPERSCRIPTS[c]);
}

export function systemLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'Imperial (kip-in-ksi)' : 'SI Metric (kN-m-MPa)';
}

/** Factor that turns an internal value into a display value. */
export function displayFactor(qty: QuantityType, system: UnitSystem): number {
  return system === 'imperial' ? IMPERIAL_FACTORS[qty] : METRIC_FACTORS[qty];
}

/** Convert an internal (kip-in-ksi) value to the display unit. */
export function toDisplay(value: number, qty: QuantityType, system: UnitSystem): number {
  return value * displayFactor(qty, system);
}

/** Convert a value typed in the display unit back to internal units. */
export function fromDisplay(value: number, qty: QuantityType, system: UnitSystem): number {
  return value / displayFactor(qty, system);
}

/**
 * Rounds a display value for an editable field. Ten significant digits hide
 * float noise from the conversion (3.0480000000000005) while keeping every
 * digit a user could have typed, so J = 0.3 stays 0.3.
 */
export function roundForInput(displayValue: number): number {
  if (!Number.isFinite(displayValue) || displayValue === 0) return 0;
  return Number(displayValue.toPrecision(10));
}

/**
 * Engineering notation with 4 significant digits, e.g. 84.91e6. Used for
 * metric section properties, which run to tens of millions of mm^4.
 */
function formatEngineering(value: number): string {
  const exponent = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
  const mantissa = Number((value / 10 ** exponent).toPrecision(4));
  return `${mantissa}e${exponent}`;
}

export type DecimalsOption = number | Partial<Record<UnitSystem, number>>;

/**
 * Formats an internal value in the display unit, without the label. Metric
 * values of a million or more switch to engineering notation; imperial
 * output always uses fixed decimals.
 */
export function formatQuantity(
  value: number,
  qty: QuantityType,
  system: UnitSystem,
  decimals?: DecimalsOption,
): string {
  const shown = toDisplay(value, qty, system);
  if (system === 'metric' && Math.abs(shown) >= 1e6) return formatEngineering(shown);
  const digits =
    typeof decimals === 'number'
      ? decimals
      : decimals?.[system] ?? DEFAULT_DECIMALS[system][qty];
  return shown.toFixed(digits);
}

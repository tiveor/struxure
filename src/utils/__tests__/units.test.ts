import { describe, it, expect } from 'vitest';
import {
  QUANTITY_TYPES,
  unitLabel,
  systemLabel,
  toDisplay,
  fromDisplay,
  displayFactor,
  roundForInput,
  formatQuantity,
} from '../units';
import type { QuantityType } from '../units';

/**
 * Reference values: one internal unit of each quantity expressed in the
 * metric display unit, derived by hand from the exact definitions
 * 1 in = 25.4 mm, 1 lbf = 4.4482216152605 N, 1 lb = 0.45359237 kg.
 */
const METRIC_REFERENCE: Record<QuantityType, { label: string; factor: number }> = {
  length: { label: 'm', factor: 0.0254 },
  sectionDimension: { label: 'mm', factor: 25.4 },
  displacement: { label: 'mm', factor: 25.4 },
  force: { label: 'kN', factor: 4.4482216152605 },
  moment: { label: 'kN-m', factor: 0.112984829027617 },
  forcePerLength: { label: 'kN/m', factor: 175.126835246476 },
  stress: { label: 'MPa', factor: 6.894757293168361 },
  area: { label: 'mm²', factor: 645.16 },
  momentOfInertia: { label: 'mm⁴', factor: 416231.4256 },
  sectionModulus: { label: 'mm³', factor: 16387.064 },
  density: { label: 'kg/m³', factor: 27679904.710203 },
  weightPerLength: { label: 'kg/m', factor: 1.4881639435695537 },
};

const IMPERIAL_REFERENCE: Record<QuantityType, { label: string; factor: number }> = {
  length: { label: 'in', factor: 1 },
  sectionDimension: { label: 'in', factor: 1 },
  displacement: { label: 'in', factor: 1 },
  force: { label: 'kip', factor: 1 },
  moment: { label: 'kip-in', factor: 1 },
  forcePerLength: { label: 'kip/in', factor: 1 },
  stress: { label: 'ksi', factor: 1 },
  area: { label: 'in²', factor: 1 },
  momentOfInertia: { label: 'in⁴', factor: 1 },
  sectionModulus: { label: 'in³', factor: 1 },
  density: { label: 'lb/ft³', factor: 1_728_000 },
  weightPerLength: { label: 'lb/ft', factor: 1 },
};

describe('quantity vocabulary', () => {
  it('has a reference for every quantity type', () => {
    expect([...QUANTITY_TYPES].sort()).toEqual(Object.keys(METRIC_REFERENCE).sort());
  });

  it('separates model geometry from section dimensions in metric', () => {
    expect(unitLabel('length', 'metric')).toBe('m');
    expect(unitLabel('sectionDimension', 'metric')).toBe('mm');
    expect(unitLabel('length', 'imperial')).toBe(unitLabel('sectionDimension', 'imperial'));
  });
});

describe.each(QUANTITY_TYPES)('%s', (qty) => {
  it('has the expected metric factor and label', () => {
    const ref = METRIC_REFERENCE[qty];
    // Relative comparison: the factors span from 0.0254 to 2.8e7.
    expect(displayFactor(qty, 'metric') / ref.factor).toBeCloseTo(1, 12);
    expect(toDisplay(1, qty, 'metric')).toBe(displayFactor(qty, 'metric'));
    expect(unitLabel(qty, 'metric')).toBe(ref.label);
  });

  it('has the expected imperial factor and label', () => {
    const ref = IMPERIAL_REFERENCE[qty];
    expect(displayFactor(qty, 'imperial')).toBe(ref.factor);
    expect(unitLabel(qty, 'imperial')).toBe(ref.label);
  });

  it.each(['imperial', 'metric'] as const)('round-trips through %s display units', (system) => {
    for (const v of [0, 1, -3.5, 0.3, 1234.5678, 1e-6]) {
      expect(fromDisplay(toDisplay(v, qty, system), qty, system)).toBeCloseTo(v, 12);
    }
  });

  it('has an ASCII label with no superscripts', () => {
    for (const system of ['imperial', 'metric'] as const) {
      expect(unitLabel(qty, system, { ascii: true })).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});

describe('worked conversions', () => {
  it('converts a 1.5 kN/m line load without losing it to rounding', () => {
    const internal = fromDisplay(1.5, 'forcePerLength', 'metric');
    expect(internal).toBeCloseTo(0.0085652, 6); // kip/in
    expect(formatQuantity(internal, 'forcePerLength', 'metric')).toBe('1.50');
  });

  it('converts a 20 ft span to 6.096 m', () => {
    expect(toDisplay(240, 'length', 'metric')).toBeCloseTo(6.096, 12);
  });

  it('converts 100 kip-ft to 135.58 kN-m', () => {
    expect(toDisplay(1200, 'moment', 'metric')).toBeCloseTo(135.582, 3);
  });

  it('converts 50 ksi to 344.74 MPa', () => {
    expect(toDisplay(50, 'stress', 'metric')).toBeCloseTo(344.738, 3);
  });

  it('converts steel density to about 7850 kg/m^3 and 490 pcf', () => {
    expect(toDisplay(0.000284, 'density', 'metric')).toBeCloseTo(7861, 0);
    expect(toDisplay(0.000284, 'density', 'imperial')).toBeCloseTo(490.75, 2);
  });

  it('converts a W12x26 to 38.7 kg/m', () => {
    expect(toDisplay(26, 'weightPerLength', 'metric')).toBeCloseTo(38.69, 2);
  });
});

describe('unitLabel ascii option', () => {
  it('spells exponents with a caret', () => {
    expect(unitLabel('area', 'imperial', { ascii: true })).toBe('in^2');
    expect(unitLabel('sectionModulus', 'metric', { ascii: true })).toBe('mm^3');
    expect(unitLabel('momentOfInertia', 'metric', { ascii: true })).toBe('mm^4');
    expect(unitLabel('density', 'metric', { ascii: true })).toBe('kg/m^3');
    expect(unitLabel('force', 'metric', { ascii: true })).toBe('kN');
  });
});

describe('systemLabel', () => {
  it('names each system', () => {
    expect(systemLabel('imperial')).toBe('Imperial (kip-in-ksi)');
    expect(systemLabel('metric')).toBe('SI Metric (kN-m-MPa)');
  });
});

describe('roundForInput', () => {
  it('hides conversion noise', () => {
    expect(roundForInput(toDisplay(120, 'length', 'metric'))).toBe(3.048);
  });

  it('keeps small values that a fixed 0-decimal rounding would drop', () => {
    expect(roundForInput(0.3)).toBe(0.3);
  });

  it('returns typed metric values unchanged after a round trip', () => {
    const internal = fromDisplay(124869, 'momentOfInertia', 'metric');
    expect(roundForInput(toDisplay(internal, 'momentOfInertia', 'metric'))).toBe(124869);
  });

  it('maps non-finite input to 0', () => {
    expect(roundForInput(Number.NaN)).toBe(0);
  });
});

describe('formatQuantity', () => {
  it('leaves imperial values unconverted', () => {
    expect(formatQuantity(204, 'momentOfInertia', 'imperial', 0)).toBe('204');
    expect(formatQuantity(7.65, 'area', 'imperial')).toBe('7.65');
  });

  it('applies per-system decimals', () => {
    expect(formatQuantity(120, 'length', 'imperial', { imperial: 1 })).toBe('120.0');
    expect(formatQuantity(120, 'length', 'metric', { imperial: 1 })).toBe('3.048');
  });

  it('switches metric values of a million or more to engineering notation', () => {
    expect(formatQuantity(204, 'momentOfInertia', 'metric')).toBe('84.91e6');
    expect(formatQuantity(-204, 'momentOfInertia', 'metric')).toBe('-84.91e6');
    expect(formatQuantity(7.65, 'area', 'metric')).toBe('4935');
  });

  it('never uses engineering notation for imperial', () => {
    expect(formatQuantity(31100, 'momentOfInertia', 'imperial', 0)).toBe('31100');
    expect(formatQuantity(0.000284, 'density', 'imperial')).toBe('490.8');
  });
});

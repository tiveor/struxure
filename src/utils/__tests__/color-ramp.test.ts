import { describe, it, expect } from 'vitest';
import {
  DESIGN_BANDS,
  getDesignColor,
  jetColormap,
  thermalColormap,
  blueRedColormap,
  getSchemeColor,
  normalizeValue,
  computeAxialStress,
  computeBendingStress,
  computeCombinedStress,
} from '../color-ramp';

describe('jetColormap', () => {
  it('should return blue-ish at t=0', () => {
    const c = jetColormap(0);
    expect(c.b).toBeGreaterThan(c.r);
    expect(c.b).toBeGreaterThan(c.g);
  });

  it('should return red-ish at t=1', () => {
    const c = jetColormap(1);
    expect(c.r).toBeGreaterThan(c.b);
    expect(c.r).toBeGreaterThan(c.g);
  });

  it('should return green-ish at t=0.5', () => {
    const c = jetColormap(0.5);
    expect(c.g).toBeGreaterThanOrEqual(c.r);
    expect(c.g).toBeGreaterThanOrEqual(c.b);
  });

  it('should clamp values below 0', () => {
    const c = jetColormap(-1);
    const c0 = jetColormap(0);
    expect(c.r).toBe(c0.r);
    expect(c.g).toBe(c0.g);
    expect(c.b).toBe(c0.b);
  });

  it('should clamp values above 1', () => {
    const c = jetColormap(2);
    const c1 = jetColormap(1);
    expect(c.r).toBe(c1.r);
    expect(c.g).toBe(c1.g);
    expect(c.b).toBe(c1.b);
  });

  it('should return RGB values in [0,1] range', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const c = jetColormap(t);
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(1);
      expect(c.g).toBeGreaterThanOrEqual(0);
      expect(c.g).toBeLessThanOrEqual(1);
      expect(c.b).toBeGreaterThanOrEqual(0);
      expect(c.b).toBeLessThanOrEqual(1);
    }
  });
});

describe('thermalColormap', () => {
  it('should return black at t=0', () => {
    const c = thermalColormap(0);
    expect(c.r).toBeCloseTo(0);
    expect(c.g).toBeCloseTo(0);
    expect(c.b).toBeCloseTo(0);
  });

  it('should return white at t=1', () => {
    const c = thermalColormap(1);
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(1);
    expect(c.b).toBeCloseTo(1);
  });

  it('should have r > g > b at midpoint', () => {
    const c = thermalColormap(0.5);
    expect(c.r).toBeGreaterThan(c.g);
    expect(c.g).toBeGreaterThan(c.b);
  });

  it('should return RGB values in [0,1] range', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const c = thermalColormap(t);
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(1);
      expect(c.g).toBeGreaterThanOrEqual(0);
      expect(c.g).toBeLessThanOrEqual(1);
      expect(c.b).toBeGreaterThanOrEqual(0);
      expect(c.b).toBeLessThanOrEqual(1);
    }
  });
});

describe('blueRedColormap', () => {
  it('should return blue at t=0', () => {
    const c = blueRedColormap(0);
    expect(c.b).toBe(1);
    expect(c.r).toBe(0);
  });

  it('should return red at t=1', () => {
    const c = blueRedColormap(1);
    expect(c.r).toBe(1);
    expect(c.b).toBe(0);
  });

  it('should have peak green at midpoint', () => {
    const c = blueRedColormap(0.5);
    expect(c.g).toBe(1);
    expect(c.r).toBe(0.5);
    expect(c.b).toBe(0.5);
  });

  it('should be symmetric around midpoint', () => {
    const c1 = blueRedColormap(0.25);
    const c2 = blueRedColormap(0.75);
    expect(c1.r).toBeCloseTo(c2.b);
    expect(c1.b).toBeCloseTo(c2.r);
    expect(c1.g).toBeCloseTo(c2.g);
  });
});

describe('getSchemeColor', () => {
  it('should dispatch to jetColormap', () => {
    const c1 = getSchemeColor('jet', 0.5);
    const c2 = jetColormap(0.5);
    expect(c1).toEqual(c2);
  });

  it('should dispatch to thermalColormap', () => {
    const c1 = getSchemeColor('thermal', 0.3);
    const c2 = thermalColormap(0.3);
    expect(c1).toEqual(c2);
  });

  it('should dispatch to blueRedColormap', () => {
    const c1 = getSchemeColor('blueRed', 0.7);
    const c2 = blueRedColormap(0.7);
    expect(c1).toEqual(c2);
  });
});

describe('normalizeValue', () => {
  it('should return 0 for value = min', () => {
    expect(normalizeValue(10, 10, 100)).toBe(0);
  });

  it('should return 1 for value = max', () => {
    expect(normalizeValue(100, 10, 100)).toBe(1);
  });

  it('should return 0.5 for midpoint', () => {
    expect(normalizeValue(55, 10, 100)).toBeCloseTo(0.5);
  });

  it('should return 0.5 when min === max', () => {
    expect(normalizeValue(50, 50, 50)).toBe(0.5);
  });

  it('should clamp below min to 0', () => {
    expect(normalizeValue(0, 10, 100)).toBe(0);
  });

  it('should clamp above max to 1', () => {
    expect(normalizeValue(200, 10, 100)).toBe(1);
  });
});

describe('computeAxialStress', () => {
  it('should compute |N/A|', () => {
    expect(computeAxialStress(100, 10)).toBe(10);
  });

  it('should return absolute value for compression', () => {
    expect(computeAxialStress(-100, 10)).toBe(10);
  });

  it('should return 0 when area is 0', () => {
    expect(computeAxialStress(100, 0)).toBe(0);
  });
});

describe('computeBendingStress', () => {
  it('should compute |M/S|', () => {
    expect(computeBendingStress(500, 25)).toBe(20);
  });

  it('should return absolute value for negative moment', () => {
    expect(computeBendingStress(-500, 25)).toBe(20);
  });

  it('should return 0 when S is 0', () => {
    expect(computeBendingStress(500, 0)).toBe(0);
  });
});

describe('computeCombinedStress', () => {
  it('should add axial + bending stresses', () => {
    // N/A + M/S = 100/10 + 500/25 = 10 + 20 = 30
    expect(computeCombinedStress(100, 10, 500, 25)).toBe(30);
  });

  it('should handle zero area gracefully', () => {
    expect(computeCombinedStress(100, 0, 500, 25)).toBe(20);
  });

  it('should handle zero section modulus gracefully', () => {
    expect(computeCombinedStress(100, 10, 500, 0)).toBe(10);
  });
});

describe('getDesignColor', () => {
  const GREEN = '#22c55e';
  const YELLOW = '#eab308';
  const ORANGE = '#f97316';
  const RED = '#ef4444';

  it('colours a comfortable margin green', () => {
    expect(getDesignColor(0)).toBe(GREEN);
    expect(getDesignColor(0.25)).toBe(GREEN);
  });

  it('treats each boundary as belonging to the lower band', () => {
    // The bands are documented as inclusive upper bounds, and the PDF legend
    // prints them that way, so an element exactly at 0.50 must read green.
    expect(getDesignColor(0.5)).toBe(GREEN);
    expect(getDesignColor(0.75)).toBe(YELLOW);
    expect(getDesignColor(1.0)).toBe(ORANGE);
  });

  it('colours the band above each boundary correctly', () => {
    expect(getDesignColor(0.5001)).toBe(YELLOW);
    expect(getDesignColor(0.7501)).toBe(ORANGE);
    expect(getDesignColor(1.0001)).toBe(RED);
  });

  it('colours anything over capacity red, however far over', () => {
    expect(getDesignColor(1.5)).toBe(RED);
    expect(getDesignColor(99)).toBe(RED);
  });

  it('keeps the legend in step with the rendering', () => {
    // The PDF legend is drawn from DESIGN_BANDS, so a band whose colour does
    // not match what getDesignColor returns would print a misleading key.
    expect(DESIGN_BANDS.map((b) => b.color)).toEqual([GREEN, YELLOW, ORANGE, RED]);
    for (const band of DESIGN_BANDS) {
      if (band.max !== null) expect(getDesignColor(band.max)).toBe(band.color);
    }
  });
});

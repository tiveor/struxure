import { describe, it, expect } from 'vitest';
import {
  computeInterpolation,
  getAnimationFactor,
  interpolatePosition,
  getDeformationColor,
} from '../animation';

describe('computeInterpolation', () => {
  it('should return 0.5 at t=0 (sin(0)=0 → (0+1)/2=0.5)', () => {
    const t = computeInterpolation(0, 1.0);
    expect(t).toBeCloseTo(0.5);
  });

  it('should return 1 at peak (sin(π/2)=1 → (1+1)/2=1)', () => {
    const t = computeInterpolation(Math.PI / 2, 1.0);
    expect(t).toBeCloseTo(1);
  });

  it('should return 0 at trough (sin(3π/2)=-1 → (-1+1)/2=0)', () => {
    const t = computeInterpolation((3 * Math.PI) / 2, 1.0);
    expect(t).toBeCloseTo(0);
  });

  it('should always be between 0 and 1', () => {
    for (let i = 0; i < 100; i++) {
      const t = computeInterpolation(Math.random() * 100, 2.0);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it('should respect speed multiplier', () => {
    // At speed=2, half the period reaches the same value
    const t1 = computeInterpolation(Math.PI / 4, 2.0); // sin(π/2)=1
    expect(t1).toBeCloseTo(1);
  });
});

describe('interpolatePosition', () => {
  it('should return original position when t=0', () => {
    const pos = interpolatePosition(
      { x: 10, y: 20, z: 30 },
      { x: 1, y: 2, z: 3 },
      100,
      0,
    );
    expect(pos).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('should return fully deformed position when t=1', () => {
    const pos = interpolatePosition(
      { x: 10, y: 20, z: 30 },
      { x: 1, y: 2, z: 3 },
      100,
      1,
    );
    expect(pos).toEqual({ x: 110, y: 220, z: 330 });
  });

  it('should interpolate linearly at t=0.5', () => {
    const pos = interpolatePosition(
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 4, z: 6 },
      10,
      0.5,
    );
    expect(pos).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('should handle zero displacement', () => {
    const pos = interpolatePosition(
      { x: 5, y: 5, z: 5 },
      { x: 0, y: 0, z: 0 },
      100,
      1,
    );
    expect(pos).toEqual({ x: 5, y: 5, z: 5 });
  });

  it('should handle zero scale', () => {
    const pos = interpolatePosition(
      { x: 5, y: 5, z: 5 },
      { x: 1, y: 1, z: 1 },
      0,
      1,
    );
    expect(pos).toEqual({ x: 5, y: 5, z: 5 });
  });
});

describe('getAnimationFactor', () => {
  describe('oscillate mode', () => {
    it('should be periodic', () => {
      const v1 = getAnimationFactor('oscillate', 0, 1);
      const v2 = getAnimationFactor('oscillate', 2 * Math.PI, 1);
      expect(v1).toBeCloseTo(v2, 5);
    });

    it('should return values between 0 and 1', () => {
      for (let t = 0; t < 10; t += 0.1) {
        const v = getAnimationFactor('oscillate', t, 1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('pulse mode', () => {
    it('should return 0 at start of cycle', () => {
      const v = getAnimationFactor('pulse', 0, 1);
      expect(v).toBeCloseTo(0, 1);
    });

    it('should reach 1 at peak', () => {
      const v = getAnimationFactor('pulse', Math.PI / 2, 1);
      expect(v).toBeCloseTo(1);
    });

    it('should return to 0 at end of half-cycle', () => {
      const v = getAnimationFactor('pulse', Math.PI, 1);
      expect(v).toBeCloseTo(0, 1);
    });

    it('should never be negative', () => {
      for (let t = 0; t < 10; t += 0.1) {
        const v = getAnimationFactor('pulse', t, 1);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('progressive mode', () => {
    it('should start at 0', () => {
      const v = getAnimationFactor('progressive', 0, 1);
      expect(v).toBeCloseTo(0);
    });

    it('should clamp at 1', () => {
      const v = getAnimationFactor('progressive', 100, 1);
      expect(v).toBe(1);
    });

    it('should increase monotonically', () => {
      let prev = 0;
      for (let t = 0; t < 5; t += 0.1) {
        const v = getAnimationFactor('progressive', t, 1);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });
});

describe('getDeformationColor', () => {
  it('should return green when ratio is 0 (min displacement)', () => {
    const color = getDeformationColor(0, 0, 10);
    expect(color.r).toBeCloseTo(0);
    expect(color.g).toBeCloseTo(1);
    expect(color.b).toBeCloseTo(0);
  });

  it('should return red when ratio is 1 (max displacement)', () => {
    const color = getDeformationColor(10, 0, 10);
    expect(color.r).toBeCloseTo(1);
    expect(color.g).toBeCloseTo(0);
    expect(color.b).toBeCloseTo(0);
  });

  it('should return yellow-ish at midpoint', () => {
    const color = getDeformationColor(5, 0, 10);
    expect(color.r).toBeCloseTo(0.5);
    expect(color.g).toBeCloseTo(0.5);
    expect(color.b).toBeCloseTo(0);
  });

  it('should handle min === max (no range)', () => {
    const color = getDeformationColor(5, 5, 5);
    // Should return green (default safe color)
    expect(color.r).toBeCloseTo(0);
    expect(color.g).toBeCloseTo(1);
    expect(color.b).toBeCloseTo(0);
  });

  it('should clamp values outside range', () => {
    const color = getDeformationColor(15, 0, 10);
    expect(color.r).toBeLessThanOrEqual(1);
    expect(color.g).toBeGreaterThanOrEqual(0);
  });

  it('blue component should always be 0', () => {
    for (let v = 0; v <= 10; v++) {
      const color = getDeformationColor(v, 0, 10);
      expect(color.b).toBe(0);
    }
  });
});

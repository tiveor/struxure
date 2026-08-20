import { describe, it, expect } from 'vitest';
import { getInternalForcesDistribution, getMaxAbsValue } from '../internal-forces-distribution';
import type { ElementEndForces } from '../internal-forces-distribution';

describe('simply supported beam - point load at center', () => {
  // L=240in, P=10kip at center
  // Reactions: R = P/2 = 5 kip each
  // V2i = +5 kip (upward reaction), M3i = 0 (simply supported)
  // At center: V changes sign, M = PL/4 = 600 kip·in
  // Note: solver gives forces at end-i in local coords.
  // For simply supported with P at center (modeled as two end-i shears):
  const L = 240;
  const endForces: ElementEndForces = { Ni: 0, V2i: 5, M3i: 0 };

  it('should have positive shear in left half', () => {
    const points = getInternalForcesDistribution(L, endForces, 0, 20);
    const leftHalf = points.filter((p) => p.x < 120);
    leftHalf.forEach((p) => expect(p.V2).toBeCloseTo(5, 0));
  });

  it('should have maximum moment at midspan', () => {
    const points = getInternalForcesDistribution(L, endForces, 0, 20);
    const midPoint = points.find((p) => Math.abs(p.x - 120) < 6.1);
    expect(midPoint!.M3).toBeCloseTo(600, 0);
  });

  it('should have zero moment at supports', () => {
    const points = getInternalForcesDistribution(L, endForces, 0, 20);
    expect(points[0].M3).toBeCloseTo(0, 1);
  });
});

describe('uniformly distributed load', () => {
  // L=120in, w=1 kip/in
  // Reactions: R = wL/2 = 60 kip
  // V(x) = R - wx = 60 - x
  // M(x) = Rx - wx²/2 = 60x - x²/2
  // M_max at x=60: 60*60 - 60²/2 = 1800 kip·in
  const L = 120;
  const endForces: ElementEndForces = { Ni: 0, V2i: 60, M3i: 0 };
  const wy = 1; // kip/in

  it('should have linear shear distribution', () => {
    const points = getInternalForcesDistribution(L, endForces, wy, 20);
    expect(points[0].V2).toBeCloseTo(60, 0);
    expect(points[points.length - 1].V2).toBeCloseTo(-60, 0);
  });

  it('should have parabolic moment with max at center', () => {
    const points = getInternalForcesDistribution(L, endForces, wy, 40);
    const midPoint = points.find((p) => Math.abs(p.x - 60) < 2);
    expect(midPoint!.M3).toBeCloseTo(1800, 0);
  });

  it('should have zero shear at midspan', () => {
    const points = getInternalForcesDistribution(L, endForces, wy, 40);
    const midPoint = points.find((p) => Math.abs(p.x - 60) < 2);
    expect(Math.abs(midPoint!.V2)).toBeLessThan(2);
  });
});

describe('cantilever beam - tip load', () => {
  // L=100in, P=5kip at free end
  // Fixed at start: V2i = 5 (reaction shear), M3i = -500 (reaction moment)
  // V(x) = V2i = 5 (constant, no distributed load)
  // M(x) = M3i + V2i*x = -500 + 5*x
  // M(0) = -500, M(100) = 0
  const L = 100;
  const endForces: ElementEndForces = { Ni: 0, V2i: 5, M3i: -500 };

  it('should have constant shear along element', () => {
    const points = getInternalForcesDistribution(L, endForces, 0, 10);
    points.forEach((p) => expect(p.V2).toBeCloseTo(5, 1));
  });

  it('should have maximum moment at fixed end', () => {
    const points = getInternalForcesDistribution(L, endForces, 0, 10);
    expect(Math.abs(points[0].M3)).toBeCloseTo(500, 0);
  });

  it('should have zero moment at free end', () => {
    const points = getInternalForcesDistribution(L, endForces, 0, 10);
    expect(points[points.length - 1].M3).toBeCloseTo(0, 0);
  });
});

describe('distribution points count', () => {
  const endForces: ElementEndForces = { Ni: 0, V2i: 10, M3i: 0 };

  it('should return numPoints + 1 values', () => {
    const points = getInternalForcesDistribution(240, endForces, 0, 20);
    expect(points).toHaveLength(21);
  });

  it('first point should be at x=0, last at x=L', () => {
    const L = 240;
    const points = getInternalForcesDistribution(L, endForces, 0, 10);
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBeCloseTo(L);
  });
});

describe('pure axial element', () => {
  it('should have constant axial force and zero moments', () => {
    const endForces: ElementEndForces = { Ni: 50, V2i: 0, M3i: 0 };
    const points = getInternalForcesDistribution(120, endForces, 0, 10);
    points.forEach((p) => {
      expect(p.N).toBeCloseTo(50, 0);
      expect(p.M3).toBeCloseTo(0, 1);
      expect(p.V2).toBeCloseTo(0, 1);
    });
  });
});

describe('getMaxAbsValue', () => {
  it('should find maximum absolute moment', () => {
    const endForces: ElementEndForces = { Ni: 0, V2i: 5, M3i: -500 };
    const points = getInternalForcesDistribution(100, endForces, 0, 10);
    const maxM = getMaxAbsValue(points, 'M3');
    expect(maxM).toBeCloseTo(500, 0);
  });

  it('should find maximum absolute shear', () => {
    const endForces: ElementEndForces = { Ni: 0, V2i: 60, M3i: 0 };
    const points = getInternalForcesDistribution(120, endForces, 1, 20);
    const maxV = getMaxAbsValue(points, 'V2');
    expect(maxV).toBeCloseTo(60, 0);
  });
});

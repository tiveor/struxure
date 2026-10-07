import { describe, it, expect } from 'vitest';
import { getElementHeatmapValue } from '../heatmap-value';
import type { AnalysisResults } from '../../../core/types';

describe('combined_stress heatmap', () => {
  it('uses the strong-axis moment M3 (index 5) with Sx', () => {
    // Local z is the strong axis in the stiffness matrix (Ix), so the moment
    // about it is startForces[5]. Index 4 is the weak-axis moment (#66).
    // N / A + M3 / Sx = 10 / 7.65 + 500 / 33.4 = 1.30719 + 14.97006 = 16.27725
    const results = {
      nodeDisplacements: new Map(),
      reactions: new Map(),
      elementForces: new Map([
        ['E1', { startForces: [10, 0, 0, 0, 999, 500], endForces: [-10, 0, 0, 0, 0, 0] }],
      ]),
    } as unknown as AnalysisResults;
    const value = getElementHeatmapValue('E1', 'combined_stress', results, [], 'A', 'B', 7.65, 33.4);
    expect(value).toBeCloseTo(10 / 7.65 + 500 / 33.4, 6);
  });
});

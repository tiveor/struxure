import { describe, it, expect } from 'vitest';
import { diagramQuantity, formatDiagramPeak } from '../diagram-labels';

describe('force diagram peak label', () => {
  it('treats N and V2 as forces and M3 as a moment', () => {
    expect(diagramQuantity('N')).toBe('force');
    expect(diagramQuantity('V2')).toBe('force');
    expect(diagramQuantity('M3')).toBe('moment');
  });

  it('labels imperial peaks without converting them', () => {
    expect(formatDiagramPeak(-12.34, 'V2', 'imperial')).toBe('-12.3 kip');
    expect(formatDiagramPeak(1200, 'M3', 'imperial')).toBe('1200.0 kip-in');
  });

  it('converts metric peaks to kN and kN-m', () => {
    expect(formatDiagramPeak(10, 'N', 'metric')).toBe('44.5 kN');
    expect(formatDiagramPeak(1200, 'M3', 'metric')).toBe('135.6 kN-m');
  });
});

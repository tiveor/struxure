import { describe, it, expect } from 'vitest';
import { AISC_SECTIONS, searchSections, filterSectionsByType, aiscToSection } from '../aisc-sections';

describe('AISC sections database', () => {
  it('should contain W-shapes', () => {
    const wShapes = AISC_SECTIONS.filter((s) => s.type === 'W');
    expect(wShapes.length).toBeGreaterThan(70);
  });

  it('should contain HSS sections', () => {
    const hss = AISC_SECTIONS.filter((s) => s.type === 'HSS');
    expect(hss.length).toBeGreaterThan(5);
  });

  it('should have no duplicate names', () => {
    const names = AISC_SECTIONS.map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all sections should have positive area', () => {
    AISC_SECTIONS.forEach((s) => {
      expect(s.A).toBeGreaterThan(0);
    });
  });

  it('all sections should have positive moment of inertia', () => {
    AISC_SECTIONS.forEach((s) => {
      expect(s.Ix).toBeGreaterThan(0);
      expect(s.Iy).toBeGreaterThan(0);
    });
  });

  it('all sections should have positive weight', () => {
    AISC_SECTIONS.forEach((s) => {
      expect(s.weight).toBeGreaterThan(0);
    });
  });
});

describe('known section values', () => {
  it('W14x22 should match AISC Manual values', () => {
    const w14x22 = AISC_SECTIONS.find((s) => s.name === 'W14x22');
    expect(w14x22).toBeDefined();
    expect(w14x22!.A).toBeCloseTo(6.49, 1);
    expect(w14x22!.d).toBeCloseTo(13.7, 0);
    expect(w14x22!.Ix).toBeCloseTo(199, 0);
    expect(w14x22!.weight).toBeCloseTo(22, 0);
  });

  it('W12x26 should match AISC Manual values', () => {
    const w12x26 = AISC_SECTIONS.find((s) => s.name === 'W12x26');
    expect(w12x26).toBeDefined();
    expect(w12x26!.A).toBeCloseTo(7.65, 1);
    expect(w12x26!.Ix).toBeCloseTo(204, 0);
  });

  it('W21x44 should match AISC Manual values', () => {
    const w21x44 = AISC_SECTIONS.find((s) => s.name === 'W21x44');
    expect(w21x44).toBeDefined();
    expect(w21x44!.d).toBeCloseTo(20.7, 0);
  });

  it('W8x31 should match AISC Manual values', () => {
    const w8x31 = AISC_SECTIONS.find((s) => s.name === 'W8x31');
    expect(w8x31).toBeDefined();
    expect(w8x31!.A).toBeCloseTo(9.13, 1);
    expect(w8x31!.d).toBeCloseTo(8.0, 0);
  });
});

describe('geometric consistency', () => {
  it('Ix should always be >= Iy for W-shapes', () => {
    const wShapes = AISC_SECTIONS.filter((s) => s.type === 'W');
    wShapes.forEach((s) => {
      expect(s.Ix).toBeGreaterThanOrEqual(s.Iy);
    });
  });

  it('Zx should always be >= Sx for W-shapes', () => {
    const wShapes = AISC_SECTIONS.filter((s) => s.type === 'W');
    wShapes.forEach((s) => {
      expect(s.Zx).toBeGreaterThanOrEqual(s.Sx * 0.99);
    });
  });

  it('weight should correlate with area (within 15%)', () => {
    const wShapes = AISC_SECTIONS.filter((s) => s.type === 'W');
    wShapes.forEach((s) => {
      const estimatedWeight = s.A * 3.4;
      const error = Math.abs(estimatedWeight - s.weight) / s.weight;
      expect(error).toBeLessThan(0.15);
    });
  });
});

describe('searchSections', () => {
  it('should find sections by prefix', () => {
    const results = searchSections('W14');
    expect(results.every((s) => s.name.includes('W14'))).toBe(true);
    expect(results.length).toBeGreaterThan(5);
  });

  it('should be case-insensitive', () => {
    const results = searchSections('w12x26');
    expect(results.some((s) => s.name === 'W12x26')).toBe(true);
  });

  it('should return all sections for empty query', () => {
    const results = searchSections('');
    expect(results.length).toBe(AISC_SECTIONS.length);
  });

  it('should return empty for non-existent section', () => {
    const results = searchSections('ZZZZZ');
    expect(results).toHaveLength(0);
  });
});

describe('filterSectionsByType', () => {
  it('should filter W-shapes only', () => {
    const wShapes = filterSectionsByType('W');
    expect(wShapes.every((s) => s.type === 'W')).toBe(true);
  });

  it('should filter HSS only', () => {
    const hss = filterSectionsByType('HSS');
    expect(hss.every((s) => s.type === 'HSS')).toBe(true);
    expect(hss.length).toBeGreaterThan(0);
  });
});

describe('aiscToSection', () => {
  it('should convert AISC section to app Section format', () => {
    const aisc = AISC_SECTIONS.find((s) => s.name === 'W12x26')!;
    const section = aiscToSection(aisc);

    expect(section.id).toBe('W12x26');
    expect(section.name).toBe('W12x26');
    expect(section.A).toBe(aisc.A);
    expect(section.Ix).toBe(aisc.Ix);
    expect(section.Iy).toBe(aisc.Iy);
    expect(section.d).toBe(aisc.d);
    expect(section.bf).toBe(aisc.bf);
    expect(section.tf).toBe(aisc.tf);
    expect(section.tw).toBe(aisc.tw);
  });
});

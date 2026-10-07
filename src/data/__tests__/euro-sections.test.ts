import { describe, it, expect } from 'vitest';
import {
  EURO_SECTIONS,
  euroToSection,
  euroWeightLbPerFt,
  rolledIProperties,
  searchEuroSections,
} from '../euro-sections';
import type { EuroSection } from '../euro-sections';
import { toDisplay } from '../../utils/units';

function get(name: string): EuroSection {
  const s = EURO_SECTIONS.find((x) => x.name === name);
  if (!s) throw new Error(`missing ${name}`);
  return s;
}

/** Relative difference, for checks against values rounded to 4 figures. */
function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(b);
}

const IN = 25.4;

describe('Euronorm section library', () => {
  it('holds IPE 80-600, HEA 100-600 and HEB 100-600', () => {
    const count = (f: string) => EURO_SECTIONS.filter((s) => s.family === f).length;
    expect(count('IPE')).toBe(18);
    expect(count('HEA')).toBe(19);
    expect(count('HEB')).toBe(19);
    expect(new Set(EURO_SECTIONS.map((s) => s.name)).size).toBe(EURO_SECTIONS.length);
    expect(EURO_SECTIONS[0].name).toBe('IPE80');
    expect(get('IPE600').h).toBe(600);
    expect(get('HEA600').h).toBe(590);
    expect(get('HEB600').h).toBe(600);
  });

  it('has the published Euronorm dimensions for the reference sections', () => {
    expect(get('IPE300')).toMatchObject({ h: 300, b: 150, tw: 7.1, tf: 10.7, r: 15 });
    expect(get('HEA200')).toMatchObject({ h: 190, b: 200, tw: 6.5, tf: 10, r: 18 });
    expect(get('HEB200')).toMatchObject({ h: 200, b: 200, tw: 9, tf: 15, r: 18 });
  });

  it('matches published section properties (ArcelorMittal tables)', () => {
    const ipe = get('IPE300');
    expect(ipe.A).toBe(53.81);
    expect(ipe.Iy).toBe(8356);
    expect(ipe.Wply).toBe(628.4);
    expect(ipe.Wely).toBe(557.1);
    expect(ipe.mass).toBe(42.2);
    expect(get('HEB200').A).toBe(78.08);
    expect(get('HEB200').Iy).toBe(5696);
    expect(get('HEA200').A).toBe(53.83);
    expect(get('HEA200').Iy).toBe(3692);
  });

  it('matches the published torsion constants', () => {
    expect(get('IPE300').It).toBe(20.12);
    expect(get('HEA200').It).toBe(20.98);
    expect(get('HEB200').It).toBe(59.28);
  });

  it('stores every property as derived from h, b, tw, tf and r', () => {
    for (const s of EURO_SECTIONS) {
      const p = rolledIProperties(s.h, s.b, s.tw, s.tf, s.r);
      expect(Math.abs(s.A - p.A), `${s.name} A`).toBeLessThanOrEqual(0.005 + 1e-9);
      for (const k of ['Iy', 'Iz', 'Wely', 'Welz', 'Wply', 'Wplz', 'It'] as const) {
        // Four significant figures: within half a unit in the fourth digit.
        expect(rel(s[k], p[k]), `${s.name} ${k}`).toBeLessThan(5e-4);
      }
      expect(Math.abs(s.mass - p.mass), `${s.name} mass`).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it('derives the properties of a plain I-section exactly when r = 0', () => {
    // 2 flanges 100 x 10 and a 180 x 6 web, by hand.
    const p = rolledIProperties(200, 100, 6, 10, 0);
    expect(p.A).toBeCloseTo((2 * 100 * 10 + 180 * 6) / 100, 10);
    expect(p.Iy).toBeCloseTo((100 * 200 ** 3 - 94 * 180 ** 3) / 12 / 1e4, 10);
    expect(p.Wply).toBeCloseTo((2 * 100 * 10 * 95 + (6 * 180 ** 2) / 4) / 1e3, 10);
  });

  it('finds sections ignoring case and spaces', () => {
    expect(searchEuroSections('ipe 300').map((s) => s.name)).toEqual(['IPE300']);
    expect(searchEuroSections('HEB').length).toBe(19);
    expect(searchEuroSections('')).toBe(EURO_SECTIONS);
  });
});

describe('euroToSection', () => {
  const ipe300 = euroToSection(get('IPE300'));

  it('converts IPE 300 to inches', () => {
    expect(ipe300.id).toBe('IPE300');
    expect(ipe300.shape).toBe('I');
    expect(ipe300.d).toBeCloseTo(300 / IN, 10);       // 11.811 in
    expect(ipe300.bf).toBeCloseTo(150 / IN, 10);
    expect(ipe300.tf).toBeCloseTo(10.7 / IN, 10);
    expect(ipe300.tw).toBeCloseTo(7.1 / IN, 10);
    expect(ipe300.A).toBeCloseTo(5381 / IN ** 2, 10);  // 8.341 in²
    expect(ipe300.A).toBeCloseTo(8.341, 3);
    expect(ipe300.Ix).toBeCloseTo(8356e4 / IN ** 4, 8); // 200.8 in⁴
    expect(ipe300.Ix).toBeCloseTo(200.75, 2);
    expect(ipe300.Zx).toBeCloseTo(628.4e3 / IN ** 3, 8); // 38.35 in³
    expect(ipe300.Zx).toBeCloseTo(38.35, 2);
  });

  it('maps the Eurocode strong axis y-y to x and weak axis z-z to y', () => {
    const s = get('IPE300');
    expect(ipe300.Ix).toBeCloseTo((s.Iy * 1e4) / IN ** 4, 8);
    expect(ipe300.Iy).toBeCloseTo((s.Iz * 1e4) / IN ** 4, 8);
    expect(ipe300.Sx).toBeCloseTo((s.Wely * 1e3) / IN ** 3, 8);
    expect(ipe300.Sy).toBeCloseTo((s.Welz * 1e3) / IN ** 3, 8);
    expect(ipe300.Zx).toBeCloseTo((s.Wply * 1e3) / IN ** 3, 8);
    expect(ipe300.Zy).toBeCloseTo((s.Wplz * 1e3) / IN ** 3, 8);
    expect(ipe300.J).toBeCloseTo((s.It * 1e4) / IN ** 4, 8);
    expect(ipe300.Ix).toBeGreaterThan(ipe300.Iy);
    expect(ipe300.rx).toBeCloseTo(Math.sqrt(ipe300.Ix / ipe300.A), 12);
    // Published iz of IPE 300 is 3.35 cm.
    expect((ipe300.ry ?? 0) * 2.54).toBeCloseTo(3.35, 2);
  });

  it('converts HEB 200 and HEA 200', () => {
    const heb = euroToSection(get('HEB200'));
    expect(heb.A).toBeCloseTo(7808 / IN ** 2, 10);
    expect(heb.Ix).toBeCloseTo(5696e4 / IN ** 4, 8);
    const hea = euroToSection(get('HEA200'));
    expect(hea.A).toBeCloseTo(5383 / IN ** 2, 10);
    expect(hea.Ix).toBeCloseTo(3692e4 / IN ** 4, 8);
  });

  it('round-trips through the metric display units', () => {
    for (const s of EURO_SECTIONS) {
      const sec = euroToSection(s);
      expect(toDisplay(sec.d ?? 0, 'sectionDimension', 'metric')).toBeCloseTo(s.h, 9);
      expect(toDisplay(sec.A, 'area', 'metric') / 1e2).toBeCloseTo(s.A, 9);
      expect(toDisplay(sec.Ix, 'momentOfInertia', 'metric') / 1e4).toBeCloseTo(s.Iy, 6);
      expect(toDisplay(sec.Zx ?? 0, 'sectionModulus', 'metric') / 1e3).toBeCloseTo(s.Wply, 6);
      expect(toDisplay(euroWeightLbPerFt(s), 'weightPerLength', 'metric')).toBeCloseTo(s.mass, 9);
    }
  });

  it('gives the weight in lb/ft', () => {
    // 42.2 kg/m = 28.36 lb/ft
    expect(euroWeightLbPerFt(get('IPE300'))).toBeCloseTo(28.36, 2);
  });
});

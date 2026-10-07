import { describe, it, expect } from 'vitest';
import { MATERIAL_LIBRARY } from '../material-library';
import { toDisplay } from '../units';

const byName = (list: typeof MATERIAL_LIBRARY.steel, name: string) => {
  const found = list.find((m) => m.name === name);
  if (!found) throw new Error(`${name} not in library`);
  return found;
};

describe('metric material library', () => {
  it.each([
    ['S235 (MPa)', 235, 360],
    ['S275 (MPa)', 275, 430],
    ['S355 (MPa)', 355, 510],
  ])('stores %s in internal units and shows its native MPa values', (name, fy, fu) => {
    const m = byName(MATERIAL_LIBRARY.steel, name);
    expect(m.group).toBe('EN 10025 (MPa)');
    expect(m.nativeUnits).toBe('kN-m-MPa');
    expect(m.fy).toBeCloseTo(fy / 6.894757293168361, 9);
    expect(toDisplay(m.fy!, 'stress', 'metric')).toBeCloseTo(fy, 9);
    expect(toDisplay(m.fu!, 'stress', 'metric')).toBeCloseTo(fu, 9);
    expect(toDisplay(m.E, 'stress', 'metric')).toBeCloseTo(210000, 6);
    expect(toDisplay(m.G, 'stress', 'metric')).toBeCloseTo(81000, 6);
    expect(toDisplay(m.density, 'density', 'metric')).toBeCloseTo(7850, 6);
  });

  it.each([[21], [25], [28], [35]])("derives Ec = 4700 sqrt(f'c) for f'c %i MPa", (fc) => {
    const m = byName(MATERIAL_LIBRARY.concrete, `f'c ${fc} MPa`);
    expect(m.group).toBe('ACI 318M (MPa)');
    expect(toDisplay(m.fc!, 'stress', 'metric')).toBeCloseTo(fc, 9);
    expect(toDisplay(m.E, 'stress', 'metric')).toBeCloseTo(Math.round(4700 * Math.sqrt(fc)), 6);
    expect(toDisplay(m.density, 'density', 'metric')).toBeCloseTo(2400, 6);
  });

  it('keeps the ASTM and ACI 318 grades in ksi, unchanged', () => {
    const a992 = byName(MATERIAL_LIBRARY.steel, 'A992 Gr.50');
    expect(a992).toMatchObject({ fy: 50, fu: 65, E: 29000, group: 'ASTM (ksi)', nativeUnits: 'kip-in-ksi' });
    const c4 = byName(MATERIAL_LIBRARY.concrete, "f'c 4 ksi");
    expect(c4).toMatchObject({ fc: 4, E: 3605, group: 'ACI 318 (psi)' });
  });

  it('has unique names', () => {
    const names = [...MATERIAL_LIBRARY.steel, ...MATERIAL_LIBRARY.concrete].map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

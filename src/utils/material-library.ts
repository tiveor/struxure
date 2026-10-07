import type { Material } from '../core/types';
import { INTERNAL_UNIT_TAG, convertMaterial } from './model-units';
import type { ModelUnitTag } from './model-units';

/**
 * A library entry is a Material without `id` (the id is generated on add).
 * `group` names the standard family the editor lists it under, and
 * `nativeUnits` the units its source publishes it in. MATERIAL_LIBRARY holds
 * every entry in internal units.
 */
export type LibraryMaterial = Omit<Material, 'id'> & {
  category: string;
  group: string;
  nativeUnits: ModelUnitTag;
};

/** An entry as written below, in its native units. */
type NativeEntry = Omit<LibraryMaterial, 'group' | 'nativeUnits'>;

function inGroup(entries: NativeEntry[], group: string, nativeUnits: ModelUnitTag): LibraryMaterial[] {
  return entries.map((e) => ({
    ...convertMaterial(e, nativeUnits, INTERNAL_UNIT_TAG),
    group,
    nativeUnits,
  }));
}

// ─── Steel grades (ASTM) ────────────────────────────────────────────
// All values in kip-inch (E, G in ksi; fy, fu in ksi; density in kip/in³)

export const STEEL_DENSITY = 0.000284; // 490 pcf

const astmSteels: NativeEntry[] = [
  {
    name: 'A36 Steel',
    category: 'Structural',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 36, fu: 58,
  },
  {
    name: 'A992 Gr.50',
    category: 'W-Shapes',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 50, fu: 65,
  },
  {
    name: 'A572 Gr.50',
    category: 'Structural',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 50, fu: 65,
  },
  {
    name: 'A572 Gr.60',
    category: 'High-Strength',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 60, fu: 75,
  },
  {
    name: 'A500 Gr.B',
    category: 'HSS / Tubes',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 46, fu: 58,
  },
  {
    name: 'A500 Gr.C',
    category: 'HSS / Tubes',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 50, fu: 62,
  },
  {
    name: 'A53 Gr.B',
    category: 'Pipe',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 35, fu: 60,
  },
  {
    name: 'A514 Gr.B',
    category: 'High-Strength',
    type: 'steel', E: 29000, G: 11200, density: STEEL_DENSITY,
    fy: 100, fu: 110,
  },
];

// ─── Concrete grades (ACI 318) ──────────────────────────────────────
// E = 57000 * sqrt(f'c in psi) → converted to ksi
// G = E / (2 * (1 + ν)), ν = 0.2 for concrete

export const CONCRETE_DENSITY = 0.0000868; // 150 pcf

function concreteGrade(fcKsi: number): NativeEntry {
  const fcPsi = fcKsi * 1000;
  const E = Math.round(57 * Math.sqrt(fcPsi)); // ksi
  const G = Math.round(E / 2.4);
  return {
    name: `f'c ${fcKsi} ksi`,
    category: `${fcPsi} psi`,
    type: 'concrete', E, G, density: CONCRETE_DENSITY,
    fc: fcKsi,
  };
}

const aciConcretes: NativeEntry[] = [
  concreteGrade(3),
  concreteGrade(4),
  concreteGrade(5),
  concreteGrade(6),
  concreteGrade(8),
  concreteGrade(10),
];

// ─── Steel grades (EN 10025, metric) ────────────────────────────────
// Stored in MPa and kg/m³, converted to internal units at load.
// fy and fu are the nominal values for EN 10025-2 grades with thickness
// t <= 40 mm, as EN 1993-1-1 tabulates them for design: 235/360, 275/430
// and 355/490 MPa. EN 1993-1-1:2005 Table 3.1 lists fu = 510 MPa for S355;
// 490 MPa is the lower, conservative value. Check the edition your project
// uses. fu does not enter the current AISC checks.
// E = 210000 MPa, G = 81000 MPa per EN 1993-1-1:2005 3.2.6(1).
// Density 7850 kg/m³ per EN 1991-1-1:2002 Table A.4.

const EN_STEEL = { type: 'steel' as const, E: 210000, G: 81000, density: 7850 };

const enSteels: NativeEntry[] = [
  { name: 'S235 (MPa)', category: 't ≤ 40 mm', ...EN_STEEL, fy: 235, fu: 360 },
  { name: 'S275 (MPa)', category: 't ≤ 40 mm', ...EN_STEEL, fy: 275, fu: 430 },
  { name: 'S355 (MPa)', category: 't ≤ 40 mm', ...EN_STEEL, fy: 355, fu: 490 },
];

// ─── Concrete grades (ACI 318M, metric) ─────────────────────────────
// Stored in MPa and kg/m³, converted to internal units at load.
// Ec = 4700 * sqrt(f'c) MPa per ACI 318M-19 19.2.2.1(b), normalweight.
// G = Ec / 2.4 (ν = 0.2), as for the imperial grades.
// Density 2400 kg/m³: normal weight concrete, 24 kN/m³ per
// EN 1991-1-1:2002 Table A.1.

function metricConcreteGrade(fcMpa: number): NativeEntry {
  const E = Math.round(4700 * Math.sqrt(fcMpa)); // MPa
  const G = Math.round(E / 2.4);
  return {
    name: `f'c ${fcMpa} MPa`,
    category: 'ACI 318M',
    type: 'concrete', E, G, density: 2400,
    fc: fcMpa,
  };
}

const metricConcretes: NativeEntry[] = [
  metricConcreteGrade(21),
  metricConcreteGrade(25),
  metricConcreteGrade(28),
  metricConcreteGrade(35),
];

// ─── Exports ─────────────────────────────────────────────────────────

/** Library entries in internal units, listed in editor order by group. */
export const MATERIAL_LIBRARY: { steel: LibraryMaterial[]; concrete: LibraryMaterial[] } = {
  steel: [
    ...inGroup(astmSteels, 'ASTM (ksi)', 'kip-in-ksi'),
    ...inGroup(enSteels, 'EN 10025 (MPa)', 'kN-m-MPa'),
  ],
  concrete: [
    ...inGroup(aciConcretes, 'ACI 318 (psi)', 'kip-in-ksi'),
    ...inGroup(metricConcretes, 'ACI 318M (MPa)', 'kN-m-MPa'),
  ],
};

import type { Material } from '../core/types';

/** A library entry is a Material without `id` — the id is generated on add */
export type LibraryMaterial = Omit<Material, 'id'> & { category: string };

// ─── Steel grades (ASTM) ────────────────────────────────────────────
// All values in kip-inch (E, G in ksi; fy, fu in ksi; density in kip/in³)

const STEEL_DENSITY = 0.000284; // 490 pcf

const steels: LibraryMaterial[] = [
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

const CONCRETE_DENSITY = 0.0000868; // 150 pcf

function concreteGrade(fcKsi: number): LibraryMaterial {
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

const concretes: LibraryMaterial[] = [
  concreteGrade(3),
  concreteGrade(4),
  concreteGrade(5),
  concreteGrade(6),
  concreteGrade(8),
  concreteGrade(10),
];

// ─── Exports ─────────────────────────────────────────────────────────

export const MATERIAL_LIBRARY = {
  steel: steels,
  concrete: concretes,
};

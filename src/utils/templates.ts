import type {
  StructuralModel,
  StructuralNode,
  FrameElement,
  Material,
  Section,
  Support,
  NodalLoad,
} from '../core/types';

// ─── Template interface ──────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  featured?: boolean;
  load: () => StructuralModel;
}

// ─── Shared materials ────────────────────────────────────────────────

const steelA992: Material = {
  id: 'steel-A992',
  name: 'A992 Steel',
  type: 'steel',
  E: 29000,
  G: 11200,
  density: 0.000284,
  fy: 50,
  fu: 65,
};

// ─── Support helpers ─────────────────────────────────────────────────

const pinSupport = (nodeId: string): Support => ({
  nodeId,
  dx: true, dy: true, dz: true,
  rx: true, ry: true, rz: false,
});

const rollerSupport = (nodeId: string): Support => ({
  nodeId,
  dx: false, dy: true, dz: true,
  rx: true, ry: true, rz: false,
});

const fixedSupport = (nodeId: string): Support => ({
  nodeId,
  dx: true, dy: true, dz: true,
  rx: true, ry: true, rz: true,
});

// ─── Load helper ─────────────────────────────────────────────────────

const pLoad = (id: string, nodeId: string, fy: number, fx = 0, fz = 0): NodalLoad => ({
  id, nodeId, fx, fy, fz, mx: 0, my: 0, mz: 0,
});

// ─── Section definitions ─────────────────────────────────────────────

const W12x26: Section = {
  id: 'W12x26', name: 'W12x26',
  A: 7.65, Ix: 204, Iy: 17.3, J: 0.3,
  Sx: 33.4, Sy: 5.48, Zx: 37.2, Zy: 8.17,
  rx: 5.17, ry: 1.51, d: 12.2, bf: 6.49, tf: 0.38, tw: 0.23,
};

const W10x49: Section = {
  id: 'W10x49', name: 'W10x49',
  A: 14.4, Ix: 272, Iy: 93.4, J: 1.39,
  Sx: 54.6, Sy: 18.7, Zx: 60.4, Zy: 28.3,
  rx: 4.35, ry: 2.54, d: 10.0, bf: 10.0, tf: 0.56, tw: 0.34,
};

const W14x22: Section = {
  id: 'W14x22', name: 'W14x22',
  A: 6.49, Ix: 199, Iy: 7.0, J: 0.208,
  Sx: 29.0, Sy: 3.0, Zx: 33.2, Zy: 4.39,
  rx: 5.54, ry: 1.04, d: 13.7, bf: 5.0, tf: 0.335, tw: 0.23,
};

const HSS6x6: Section = {
  id: 'HSS6x6x3/8', name: 'HSS6x6x3/8',
  A: 7.58, Ix: 43.1, Iy: 43.1, J: 70.4,
};

const HSS4x4: Section = {
  id: 'HSS4x4x1/4', name: 'HSS4x4x1/4',
  A: 3.37, Ix: 11.9, Iy: 11.9, J: 20,
};

const HSS8x8: Section = {
  id: 'HSS8x8x1/2', name: 'HSS8x8x1/2',
  A: 13.5, Ix: 146, Iy: 146, J: 237,
};

const HSS12x12: Section = {
  id: 'HSS12x12x1/2', name: 'HSS12x12x1/2',
  A: 20.4, Ix: 473, Iy: 473, J: 761,
};

const HSS3x3: Section = {
  id: 'HSS3x3x3/16', name: 'HSS3x3x3/16',
  A: 1.89, Ix: 3.78, Iy: 3.78, J: 6.35,
};

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════

export const TEMPLATES: Template[] = [
  {
    id: 'simple-beam',
    name: 'Simple Beam',
    description: 'Simply supported beam with center load',
    icon: 'straighten',
    load: loadSimpleBeam,
  },
  {
    id: 'cantilever',
    name: 'Cantilever',
    description: 'Fixed-free beam with tip load',
    icon: 'vertical_align_bottom',
    load: loadCantilever,
  },
  {
    id: 'portal-frame',
    name: 'Portal Frame',
    description: '3-bay, 2-story moment frame',
    icon: 'grid_on',
    load: loadPortalFrame,
  },
  {
    id: 'warren-truss',
    name: 'Truss Bridge',
    description: 'Warren truss with vertical loads',
    icon: 'change_history',
    load: loadWarrenTruss,
  },
  {
    id: 'arch',
    name: 'Parabolic Arch',
    description: 'Two-hinged arch under gravity',
    icon: 'filter_hdr',
    load: loadArch,
  },
  {
    id: '3d-building',
    name: '3D Building',
    description: '2×2 bay, 3-story space frame',
    icon: 'domain',
    load: load3DBuilding,
  },
  {
    id: 'eiffel-tower',
    name: 'Eiffel Tower',
    description: '3D lattice tower with 88 elements - Paris, France',
    icon: 'cell_tower',
    featured: true,
    load: loadEiffelTower,
  },
  {
    id: 'cristo-concordia',
    name: 'Cristo de la Concordia',
    description: '3D statue frame — Cochabamba, Bolivia',
    icon: 'person',
    featured: true,
    load: loadCristoConcordia,
  },
];

/** Read ?template= or ?t= from the current URL */
export function getTemplateFromURL(): Template | undefined {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('template') || params.get('t');
  if (!id) return undefined;
  return TEMPLATES.find((t) => t.id === id);
}

// Backward compatibility
export const loadTemplatePortico = loadPortalFrame;

// ═══════════════════════════════════════════════════════════════════════
// 1. SIMPLE BEAM
// ═══════════════════════════════════════════════════════════════════════
//
//  N1 ──────── N2 ──────── N3
//  △ (pin)     ↓ -20k      ○ (roller)
//  |←── 180 ──→|←── 180 ──→|

function loadSimpleBeam(): StructuralModel {
  return {
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0 },
      { id: 'N2', x: 180, y: 0, z: 0 },
      { id: 'N3', x: 360, y: 0, z: 0 },
    ],
    materials: [steelA992],
    sections: [W14x22],
    elements: [
      { id: 'B1', nodeI: 'N1', nodeJ: 'N2', materialId: 'steel-A992', sectionId: 'W14x22', betaAngle: 0 },
      { id: 'B2', nodeI: 'N2', nodeJ: 'N3', materialId: 'steel-A992', sectionId: 'W14x22', betaAngle: 0 },
    ],
    supports: [pinSupport('N1'), rollerSupport('N3')],
    nodalLoads: [pLoad('L1', 'N2', -20)],
    distributedLoads: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CANTILEVER
// ═══════════════════════════════════════════════════════════════════════
//
//  [Fixed] N1 ──────── N2 ──────── N3
//                                   ↓ -10k
//                                   → 2k
//  |←──── 120 ────→|←──── 120 ───→|

function loadCantilever(): StructuralModel {
  return {
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0 },
      { id: 'N2', x: 120, y: 0, z: 0 },
      { id: 'N3', x: 240, y: 0, z: 0 },
    ],
    materials: [steelA992],
    sections: [W12x26],
    elements: [
      { id: 'B1', nodeI: 'N1', nodeJ: 'N2', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'B2', nodeI: 'N2', nodeJ: 'N3', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
    ],
    supports: [fixedSupport('N1')],
    nodalLoads: [
      pLoad('L1', 'N3', -10, 2),
      pLoad('L2', 'N2', -5),
    ],
    distributedLoads: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 3. PORTAL FRAME (3-bay, 2-story)
// ═══════════════════════════════════════════════════════════════════════
//
//   N5────N6────N7────N8   (Y = 288)
//   |     |     |     |
//   N1────N2────N3────N4   (Y = 144)
//   |     |     |     |
//   S1    S2    S3    S4   (Y = 0)

function loadPortalFrame(): StructuralModel {
  const bay = 240;
  const story = 144;

  return {
    nodes: [
      { id: 'S1', x: 0, y: 0, z: 0 },
      { id: 'S2', x: bay, y: 0, z: 0 },
      { id: 'S3', x: bay * 2, y: 0, z: 0 },
      { id: 'S4', x: bay * 3, y: 0, z: 0 },
      { id: 'N1', x: 0, y: story, z: 0 },
      { id: 'N2', x: bay, y: story, z: 0 },
      { id: 'N3', x: bay * 2, y: story, z: 0 },
      { id: 'N4', x: bay * 3, y: story, z: 0 },
      { id: 'N5', x: 0, y: story * 2, z: 0 },
      { id: 'N6', x: bay, y: story * 2, z: 0 },
      { id: 'N7', x: bay * 2, y: story * 2, z: 0 },
      { id: 'N8', x: bay * 3, y: story * 2, z: 0 },
    ],
    materials: [steelA992],
    sections: [W12x26, W10x49],
    elements: [
      // Columns story 1
      { id: 'C1', nodeI: 'S1', nodeJ: 'N1', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      { id: 'C2', nodeI: 'S2', nodeJ: 'N2', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      { id: 'C3', nodeI: 'S3', nodeJ: 'N3', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      { id: 'C4', nodeI: 'S4', nodeJ: 'N4', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      // Columns story 2
      { id: 'C5', nodeI: 'N1', nodeJ: 'N5', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      { id: 'C6', nodeI: 'N2', nodeJ: 'N6', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      { id: 'C7', nodeI: 'N3', nodeJ: 'N7', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      { id: 'C8', nodeI: 'N4', nodeJ: 'N8', materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0 },
      // Beams floor 1
      { id: 'B1', nodeI: 'N1', nodeJ: 'N2', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'B2', nodeI: 'N2', nodeJ: 'N3', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'B3', nodeI: 'N3', nodeJ: 'N4', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      // Beams roof
      { id: 'B4', nodeI: 'N5', nodeJ: 'N6', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'B5', nodeI: 'N6', nodeJ: 'N7', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'B6', nodeI: 'N7', nodeJ: 'N8', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
    ],
    supports: [fixedSupport('S1'), fixedSupport('S2'), fixedSupport('S3'), fixedSupport('S4')],
    nodalLoads: [
      pLoad('L1', 'N1', -15), pLoad('L2', 'N2', -30),
      pLoad('L3', 'N3', -30), pLoad('L4', 'N4', -15),
      pLoad('L5', 'N5', -10), pLoad('L6', 'N6', -20),
      pLoad('L7', 'N7', -20), pLoad('L8', 'N8', -10),
      pLoad('L9', 'N1', 0, 5), pLoad('L10', 'N5', 0, 8),
    ],
    distributedLoads: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 4. WARREN TRUSS BRIDGE
// ═══════════════════════════════════════════════════════════════════════
//
//      T1────T2────T3────T4────T5
//     / \  / \  / \  / \  / \
//    /   \/   \/   \/   \/   \
//   B1────B2────B3────B4────B5────B6
//   △                              ○

function loadWarrenTruss(): StructuralModel {
  const panel = 120; // 10 ft panels
  const depth = 100; // 8.3 ft depth

  const nodes: StructuralNode[] = [
    // Bottom chord
    { id: 'B1', x: 0, y: 0, z: 0 },
    { id: 'B2', x: panel, y: 0, z: 0 },
    { id: 'B3', x: panel * 2, y: 0, z: 0 },
    { id: 'B4', x: panel * 3, y: 0, z: 0 },
    { id: 'B5', x: panel * 4, y: 0, z: 0 },
    { id: 'B6', x: panel * 5, y: 0, z: 0 },
    // Top chord (offset half-panel)
    { id: 'T1', x: panel * 0.5, y: depth, z: 0 },
    { id: 'T2', x: panel * 1.5, y: depth, z: 0 },
    { id: 'T3', x: panel * 2.5, y: depth, z: 0 },
    { id: 'T4', x: panel * 3.5, y: depth, z: 0 },
    { id: 'T5', x: panel * 4.5, y: depth, z: 0 },
  ];

  const elem = (id: string, nI: string, nJ: string, sec: string): FrameElement => ({
    id, nodeI: nI, nodeJ: nJ, materialId: 'steel-A992', sectionId: sec, betaAngle: 0,
  });

  return {
    nodes,
    materials: [steelA992],
    sections: [HSS6x6, HSS4x4],
    elements: [
      // Bottom chord
      elem('BC1', 'B1', 'B2', 'HSS6x6x3/8'), elem('BC2', 'B2', 'B3', 'HSS6x6x3/8'),
      elem('BC3', 'B3', 'B4', 'HSS6x6x3/8'), elem('BC4', 'B4', 'B5', 'HSS6x6x3/8'),
      elem('BC5', 'B5', 'B6', 'HSS6x6x3/8'),
      // Top chord
      elem('TC1', 'T1', 'T2', 'HSS6x6x3/8'), elem('TC2', 'T2', 'T3', 'HSS6x6x3/8'),
      elem('TC3', 'T3', 'T4', 'HSS6x6x3/8'), elem('TC4', 'T4', 'T5', 'HSS6x6x3/8'),
      // Diagonals (Warren pattern)
      elem('D1', 'B1', 'T1', 'HSS4x4x1/4'), elem('D2', 'T1', 'B2', 'HSS4x4x1/4'),
      elem('D3', 'B2', 'T2', 'HSS4x4x1/4'), elem('D4', 'T2', 'B3', 'HSS4x4x1/4'),
      elem('D5', 'B3', 'T3', 'HSS4x4x1/4'), elem('D6', 'T3', 'B4', 'HSS4x4x1/4'),
      elem('D7', 'B4', 'T4', 'HSS4x4x1/4'), elem('D8', 'T4', 'B5', 'HSS4x4x1/4'),
      elem('D9', 'B5', 'T5', 'HSS4x4x1/4'), elem('D10', 'T5', 'B6', 'HSS4x4x1/4'),
    ],
    supports: [pinSupport('B1'), rollerSupport('B6')],
    nodalLoads: [
      pLoad('L1', 'T1', -10), pLoad('L2', 'T2', -10),
      pLoad('L3', 'T3', -10), pLoad('L4', 'T4', -10),
      pLoad('L5', 'T5', -10),
    ],
    distributedLoads: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 5. PARABOLIC ARCH
// ═══════════════════════════════════════════════════════════════════════
//
//            N5
//          /    \
//        N4      N6
//       /          \
//     N3            N7
//    /                \
//   N2                N8
//  /                    \
// N1                    N9
// △                      △

function loadArch(): StructuralModel {
  const span = 600; // 50 ft
  const rise = 200; // ~16.7 ft
  const nSegments = 8;

  const nodes: StructuralNode[] = [];
  for (let i = 0; i <= nSegments; i++) {
    const x = (span / nSegments) * i;
    const t = (x - span / 2) / (span / 2); // -1 to 1
    const y = rise * (1 - t * t);
    nodes.push({ id: `N${i + 1}`, x, y, z: 0 });
  }

  const elements: FrameElement[] = [];
  for (let i = 0; i < nSegments; i++) {
    elements.push({
      id: `A${i + 1}`,
      nodeI: `N${i + 1}`,
      nodeJ: `N${i + 2}`,
      materialId: 'steel-A992',
      sectionId: 'HSS8x8x1/2',
      betaAngle: 0,
    });
  }

  const nodalLoads: NodalLoad[] = [];
  for (let i = 1; i < nSegments; i++) {
    nodalLoads.push(pLoad(`L${i}`, `N${i + 1}`, -8));
  }

  return {
    nodes,
    materials: [steelA992],
    sections: [HSS8x8],
    elements,
    supports: [pinSupport('N1'), pinSupport(`N${nSegments + 1}`)],
    nodalLoads,
    distributedLoads: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 6. 3D BUILDING (2×2 bay, 3-story space frame)
// ═══════════════════════════════════════════════════════════════════════
//
//  Plan view (each floor):
//
//    (0,z1) ─── (1,z1) ─── (2,z1)
//      |          |          |
//    (0,z0) ─── (1,z0) ─── (2,z0)
//
//  3 stories at Y = 144, 288, 432

function load3DBuilding(): StructuralModel {
  const bay = 240; // 20 ft
  const story = 144; // 12 ft
  const nBaysX = 2;
  const nBaysZ = 2;
  const nStories = 3;

  const nodes: StructuralNode[] = [];
  const elements: FrameElement[] = [];
  const supports: Support[] = [];
  const nodalLoads: NodalLoad[] = [];
  let eId = 1;
  let lId = 1;

  // Node naming: L{level}_R{row}_C{col}
  const nid = (level: number, row: number, col: number) => `L${level}R${row}C${col}`;

  // Generate nodes at all levels (0 = ground)
  for (let lvl = 0; lvl <= nStories; lvl++) {
    for (let r = 0; r <= nBaysZ; r++) {
      for (let c = 0; c <= nBaysX; c++) {
        nodes.push({ id: nid(lvl, r, c), x: c * bay, y: lvl * story, z: r * bay });
      }
    }
  }

  // Ground level supports
  for (let r = 0; r <= nBaysZ; r++) {
    for (let c = 0; c <= nBaysX; c++) {
      supports.push(fixedSupport(nid(0, r, c)));
    }
  }

  // Columns: connect level to level+1
  for (let lvl = 0; lvl < nStories; lvl++) {
    for (let r = 0; r <= nBaysZ; r++) {
      for (let c = 0; c <= nBaysX; c++) {
        elements.push({
          id: `E${eId++}`, nodeI: nid(lvl, r, c), nodeJ: nid(lvl + 1, r, c),
          materialId: 'steel-A992', sectionId: 'W10x49', betaAngle: 0,
        });
      }
    }
  }

  // Beams in X direction (same row, adjacent columns)
  for (let lvl = 1; lvl <= nStories; lvl++) {
    for (let r = 0; r <= nBaysZ; r++) {
      for (let c = 0; c < nBaysX; c++) {
        elements.push({
          id: `E${eId++}`, nodeI: nid(lvl, r, c), nodeJ: nid(lvl, r, c + 1),
          materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0,
        });
      }
    }
  }

  // Beams in Z direction (same column, adjacent rows)
  for (let lvl = 1; lvl <= nStories; lvl++) {
    for (let c = 0; c <= nBaysX; c++) {
      for (let r = 0; r < nBaysZ; r++) {
        elements.push({
          id: `E${eId++}`, nodeI: nid(lvl, r, c), nodeJ: nid(lvl, r + 1, c),
          materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0,
        });
      }
    }
  }

  // Gravity loads at each floor
  for (let lvl = 1; lvl <= nStories; lvl++) {
    const isRoof = lvl === nStories;
    for (let r = 0; r <= nBaysZ; r++) {
      for (let c = 0; c <= nBaysX; c++) {
        const isEdge = r === 0 || r === nBaysZ || c === 0 || c === nBaysX;
        const isCorner = (r === 0 || r === nBaysZ) && (c === 0 || c === nBaysX);
        const base = isRoof ? -8 : -15;
        const fy = isCorner ? base * 0.5 : isEdge ? base * 0.75 : base;
        nodalLoads.push(pLoad(`L${lId++}`, nid(lvl, r, c), fy));
      }
    }
  }

  // Wind load in X at each floor edge
  for (let lvl = 1; lvl <= nStories; lvl++) {
    for (let r = 0; r <= nBaysZ; r++) {
      nodalLoads.push(pLoad(`W${lId++}`, nid(lvl, r, 0), 0, lvl * 2));
    }
  }

  return {
    nodes,
    materials: [steelA992],
    sections: [W12x26, W10x49],
    elements,
    supports,
    nodalLoads,
    distributedLoads: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 7. EIFFEL TOWER (3D lattice tower)
// ═══════════════════════════════════════════════════════════════════════
//
//        TOP (0, 2400, 0)
//         |
//     ┌───┼───┐  Level 5 (Y=2000, hw=12)
//     │   │   │
//     ├───┼───┤  Level 4 (Y=1600, hw=30)
//     │   │   │
//     ├───┼───┤  Level 3 (Y=1200, hw=70)
//     │   │   │
//     ├───┼───┤  Level 2 (Y=800, hw=130)
//     │   │   │
//     ├───┼───┤  Level 1 (Y=400, hw=210)
//    /    │    \
//   /     │     \
//  └──────┴──────┘ Level 0 (Y=0, hw=300)
//
//  4 corners: A(+x,+z) B(-x,+z) C(-x,-z) D(+x,-z)

function loadEiffelTower(): StructuralModel {
  const levels = [
    { y: 0, hw: 300 },     // base
    { y: 400, hw: 210 },   // lower section
    { y: 800, hw: 130 },   // first platform
    { y: 1200, hw: 70 },   // mid section
    { y: 1600, hw: 30 },   // second platform
    { y: 2000, hw: 12 },   // upper section
  ];
  const topY = 2400;

  const corners = ['A', 'B', 'C', 'D'] as const;
  const signs: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

  const nodes: StructuralNode[] = [];
  const elements: FrameElement[] = [];
  const supports: Support[] = [];
  const nodalLoads: NodalLoad[] = [];
  let eId = 1;
  let lIdCounter = 1;

  // ── Corner nodes at each level ──
  for (let lvl = 0; lvl < levels.length; lvl++) {
    const { y, hw } = levels[lvl];
    for (let c = 0; c < 4; c++) {
      nodes.push({
        id: `${corners[c]}${lvl}`,
        x: signs[c][0] * hw,
        y,
        z: signs[c][1] * hw,
      });
    }
  }
  nodes.push({ id: 'TOP', x: 0, y: topY, z: 0 });

  const mkElem = (nI: string, nJ: string, sec: string) => {
    elements.push({
      id: `E${eId++}`, nodeI: nI, nodeJ: nJ,
      materialId: 'steel-A992', sectionId: sec, betaAngle: 0,
    });
  };

  // ── Leg elements (4 corners, each level to next) ──
  for (let c = 0; c < 4; c++) {
    for (let lvl = 0; lvl < levels.length - 1; lvl++) {
      const sec = lvl < 2 ? 'HSS12x12x1/2' : 'HSS8x8x1/2';
      mkElem(`${corners[c]}${lvl}`, `${corners[c]}${lvl + 1}`, sec);
    }
    // Level 5 → TOP
    mkElem(`${corners[c]}${levels.length - 1}`, 'TOP', 'HSS8x8x1/2');
  }

  // ── Horizontal ring bracing at each level ──
  for (let lvl = 0; lvl < levels.length; lvl++) {
    for (let c = 0; c < 4; c++) {
      const next = (c + 1) % 4;
      mkElem(`${corners[c]}${lvl}`, `${corners[next]}${lvl}`, 'HSS6x6x3/8');
    }
  }

  // ── X-bracing on each face between levels ──
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    for (let c = 0; c < 4; c++) {
      const next = (c + 1) % 4;
      mkElem(`${corners[c]}${lvl}`, `${corners[next]}${lvl + 1}`, 'HSS3x3x3/16');
      mkElem(`${corners[next]}${lvl}`, `${corners[c]}${lvl + 1}`, 'HSS3x3x3/16');
    }
  }

  // ── Supports (fixed at 4 base corners) ──
  for (let c = 0; c < 4; c++) {
    supports.push(fixedSupport(`${corners[c]}0`));
  }

  // ── Loads ──
  // Gravity at each intermediate level
  for (let lvl = 1; lvl < levels.length; lvl++) {
    const fy = lvl <= 2 ? -8 : -4;
    for (let c = 0; c < 4; c++) {
      nodalLoads.push(pLoad(`G${lIdCounter++}`, `${corners[c]}${lvl}`, fy));
    }
  }
  nodalLoads.push(pLoad(`G${lIdCounter++}`, 'TOP', -2));

  // Wind (lateral in X at upper levels)
  for (let lvl = 3; lvl < levels.length; lvl++) {
    for (let c = 0; c < 4; c++) {
      nodalLoads.push(pLoad(`W${lIdCounter++}`, `${corners[c]}${lvl}`, 0, 3));
    }
  }
  nodalLoads.push(pLoad(`W${lIdCounter++}`, 'TOP', 0, 5));

  return {
    nodes,
    materials: [steelA992],
    sections: [HSS12x12, HSS8x8, HSS6x6, HSS3x3],
    elements,
    supports,
    nodalLoads,
    distributedLoads: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 8. CRISTO DE LA CONCORDIA (Cochabamba, Bolivia)
// ═══════════════════════════════════════════════════════════════════════
//
//  Real structure: 34.2m statue on 6.24m pedestal, 27.2m arm span
//  Internal steel frame modeled as 3D lattice
//
//                  TOP (crown)
//                   │
//              ┌────┼────┐  L5 (head)
//              │    │    │
//              ├────┼────┤  L4 (shoulders)
//    LA2─LA1─LA0────┼────RA0─RA1─RA2   ← arms
//              │    │    │
//              ├────┼────┤  L3 (waist)
//              │    │    │
//              ├────┼────┤  L2 (robe)
//              │    │    │
//              ├────┼────┤  L1 (pedestal top)
//             /     │     \
//            └──────┴──────┘ L0 (base)
//
//  4 corners per level: A(+x,+z) B(-x,+z) C(-x,-z) D(+x,-z)
//  Arms extend in ±X with Z-depth pairs for stability

function loadCristoConcordia(): StructuralModel {
  const levels = [
    { y: 0,   hw: 140 },   // L0 — pedestal base
    { y: 200, hw: 120 },   // L1 — pedestal top
    { y: 400, hw: 80 },    // L2 — robe / feet
    { y: 600, hw: 55 },    // L3 — waist
    { y: 800, hw: 40 },    // L4 — chest / shoulders
    { y: 950, hw: 15 },    // L5 — neck / head
  ];
  const topY = 1100;

  const corners = ['A', 'B', 'C', 'D'] as const;
  const signs: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

  const nodes: StructuralNode[] = [];
  const elements: FrameElement[] = [];
  const supports: Support[] = [];
  const nodalLoads: NodalLoad[] = [];
  let eId = 1;
  let lId = 1;

  const mkElem = (nI: string, nJ: string, sec: string) => {
    elements.push({
      id: `E${eId++}`, nodeI: nI, nodeJ: nJ,
      materialId: 'steel-A992', sectionId: sec, betaAngle: 0,
    });
  };

  // ── Body corner nodes at each level ──
  for (let lvl = 0; lvl < levels.length; lvl++) {
    const { y, hw } = levels[lvl];
    for (let c = 0; c < 4; c++) {
      nodes.push({
        id: `${corners[c]}${lvl}`,
        x: signs[c][0] * hw,
        y,
        z: signs[c][1] * hw,
      });
    }
  }
  nodes.push({ id: 'TOP', x: 0, y: topY, z: 0 });

  // ── Vertical legs (corner-to-corner between levels) ──
  for (let c = 0; c < 4; c++) {
    for (let lvl = 0; lvl < levels.length - 1; lvl++) {
      const sec = lvl < 2 ? 'HSS12x12x1/2' : 'HSS8x8x1/2';
      mkElem(`${corners[c]}${lvl}`, `${corners[c]}${lvl + 1}`, sec);
    }
    mkElem(`${corners[c]}${levels.length - 1}`, 'TOP', 'HSS6x6x3/8');
  }

  // ── Horizontal ring bracing at each level ──
  for (let lvl = 0; lvl < levels.length; lvl++) {
    for (let c = 0; c < 4; c++) {
      const next = (c + 1) % 4;
      mkElem(`${corners[c]}${lvl}`, `${corners[next]}${lvl}`, 'HSS6x6x3/8');
    }
  }

  // ── X-bracing on each face (pedestal + lower body: L0-L3) ──
  for (let lvl = 0; lvl < 4; lvl++) {
    for (let c = 0; c < 4; c++) {
      const next = (c + 1) % 4;
      mkElem(`${corners[c]}${lvl}`, `${corners[next]}${lvl + 1}`, 'HSS4x4x1/4');
      mkElem(`${corners[next]}${lvl}`, `${corners[c]}${lvl + 1}`, 'HSS4x4x1/4');
    }
  }

  // ── Arms from shoulder level L4 (Y=800) ──
  // Each arm has front/back node pairs for Z-depth, converging to a single tip
  // Right arm: starts from A4(+40,800,+40) and D4(+40,800,-40)
  // Left arm:  starts from B4(-40,800,+40) and C4(-40,800,-40)
  const armPoints = [
    { x: 180, dy: -10, dz: 25 },   // inner arm
    { x: 340, dy: -20, dz: 15 },   // mid arm
    { x: 500, dy: -30, dz: 0 },    // hand (single tip)
  ];

  // Right arm nodes
  for (let i = 0; i < armPoints.length; i++) {
    const { x, dy, dz } = armPoints[i];
    if (dz > 0) {
      nodes.push({ id: `RA${i}f`, x, y: 800 + dy, z: dz });
      nodes.push({ id: `RA${i}b`, x, y: 800 + dy, z: -dz });
    } else {
      nodes.push({ id: `RA${i}`, x, y: 800 + dy, z: 0 });
    }
  }

  // Left arm nodes (mirror in X)
  for (let i = 0; i < armPoints.length; i++) {
    const { x, dy, dz } = armPoints[i];
    if (dz > 0) {
      nodes.push({ id: `LA${i}f`, x: -x, y: 800 + dy, z: dz });
      nodes.push({ id: `LA${i}b`, x: -x, y: 800 + dy, z: -dz });
    } else {
      nodes.push({ id: `LA${i}`, x: -x, y: 800 + dy, z: 0 });
    }
  }

  // Right arm elements
  mkElem('A4', 'RA0f', 'HSS8x8x1/2');        // shoulder → inner front
  mkElem('RA0f', 'RA1f', 'HSS6x6x3/8');       // inner → mid front
  mkElem('RA1f', 'RA2', 'HSS4x4x1/4');        // mid → hand front
  mkElem('D4', 'RA0b', 'HSS8x8x1/2');         // shoulder → inner back
  mkElem('RA0b', 'RA1b', 'HSS6x6x3/8');       // inner → mid back
  mkElem('RA1b', 'RA2', 'HSS4x4x1/4');        // mid → hand back
  mkElem('RA0f', 'RA0b', 'HSS3x3x3/16');      // cross brace inner
  mkElem('RA1f', 'RA1b', 'HSS3x3x3/16');      // cross brace mid
  mkElem('A4', 'RA0b', 'HSS3x3x3/16');        // X-brace shoulder
  mkElem('D4', 'RA0f', 'HSS3x3x3/16');
  mkElem('RA0f', 'RA1b', 'HSS3x3x3/16');      // X-brace arm
  mkElem('RA0b', 'RA1f', 'HSS3x3x3/16');

  // Left arm elements (mirror)
  mkElem('B4', 'LA0f', 'HSS8x8x1/2');
  mkElem('LA0f', 'LA1f', 'HSS6x6x3/8');
  mkElem('LA1f', 'LA2', 'HSS4x4x1/4');
  mkElem('C4', 'LA0b', 'HSS8x8x1/2');
  mkElem('LA0b', 'LA1b', 'HSS6x6x3/8');
  mkElem('LA1b', 'LA2', 'HSS4x4x1/4');
  mkElem('LA0f', 'LA0b', 'HSS3x3x3/16');
  mkElem('LA1f', 'LA1b', 'HSS3x3x3/16');
  mkElem('B4', 'LA0b', 'HSS3x3x3/16');
  mkElem('C4', 'LA0f', 'HSS3x3x3/16');
  mkElem('LA0f', 'LA1b', 'HSS3x3x3/16');
  mkElem('LA0b', 'LA1f', 'HSS3x3x3/16');

  // ── Supports (fixed at 4 base corners) ──
  for (let c = 0; c < 4; c++) {
    supports.push(fixedSupport(`${corners[c]}0`));
  }

  // ── Loads ──
  // Gravity at each level
  for (let lvl = 1; lvl < levels.length; lvl++) {
    const fy = lvl <= 2 ? -10 : -5;
    for (let c = 0; c < 4; c++) {
      nodalLoads.push(pLoad(`G${lId++}`, `${corners[c]}${lvl}`, fy));
    }
  }
  nodalLoads.push(pLoad(`G${lId++}`, 'TOP', -3));

  // Arm self-weight (heavier near shoulders, lighter at tips)
  const armGravity: [string, number][] = [
    ['RA0f', -4], ['RA0b', -4], ['RA1f', -3], ['RA1b', -3], ['RA2', -2],
    ['LA0f', -4], ['LA0b', -4], ['LA1f', -3], ['LA1b', -3], ['LA2', -2],
  ];
  for (const [nId, fy] of armGravity) {
    nodalLoads.push(pLoad(`G${lId++}`, nId, fy));
  }

  // Wind load (lateral in +X at upper body and arms)
  for (let lvl = 3; lvl < levels.length; lvl++) {
    for (let c = 0; c < 4; c++) {
      nodalLoads.push(pLoad(`W${lId++}`, `${corners[c]}${lvl}`, 0, 2));
    }
  }
  nodalLoads.push(pLoad(`W${lId++}`, 'TOP', 0, 4));

  return {
    nodes,
    materials: [steelA992],
    sections: [HSS12x12, HSS8x8, HSS6x6, HSS4x4, HSS3x3],
    elements,
    supports,
    nodalLoads,
    distributedLoads: [],
  };
}

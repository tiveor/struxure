import { describe, it, expect } from 'vitest';
import { solveModel } from '../solver';
import type {
  StructuralModel,
  Support,
  DistributedLoad,
  NodalLoad,
  AnalysisResults,
} from '../types';

/**
 * Validation of support reactions under member (distributed) loads, end to
 * end through solveModel.
 *
 * Reference for the beam cases: AISC Steel Construction Manual (15th ed.),
 * Table 3-23 "Shears, Moments and Deflections", beam diagrams for a simple
 * beam, a cantilever and a beam fixed at one end and supported at the other,
 * each under a uniformly distributed load. The inclined, axial, weak-axis and
 * mixed cases are statically determinate and are worked by hand from the
 * free-body diagram in the comment above each block.
 *
 * Every case also checks global equilibrium, sum F = 0 and sum M = 0 about
 * the origin, with the member loads included as their hand-computed
 * resultants (never read back from the engine).
 *
 * W12x26, A992: E = 29000 ksi, Ix = 204 in^4. Units: kips, inches.
 * Sign convention: reaction moments are positive counter-clockwise (right
 * hand rule about the global axis).
 */

const fixed = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
});
const pin = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: false, rz: false,
});
const rollerX = (nodeId: string): Support => ({
  nodeId, dx: false, dy: true, dz: true, rx: true, ry: false, rz: false,
});

const base = {
  materials: [{ id: 'steel', name: 'A992', type: 'steel' as const, E: 29000, G: 11200, density: 0 }],
  sections: [{ id: 'W12x26', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 }],
};

const element = (id: string, nodeI: string, nodeJ: string) => ({
  id, nodeI, nodeJ, materialId: 'steel', sectionId: 'W12x26', betaAngle: 0,
});

const udl = (id: string, elementId: string, wx: number, wy: number, wz: number): DistributedLoad => ({
  id, elementId, wx, wy, wz,
});

const nodal = (id: string, nodeId: string, f: Partial<Omit<NodalLoad, 'id' | 'nodeId'>>): NodalLoad => ({
  id, nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...f,
});

type Vec3 = [number, number, number];

/** An applied load resultant: a force through a point plus a couple. */
interface Applied {
  at: Vec3;
  force: Vec3;
  moment?: Vec3;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Sum F and sum M about the origin over every support reaction and every
 * applied resultant. Both must vanish for the structure to be in equilibrium.
 */
function residual(model: StructuralModel, results: AnalysisResults, applied: Applied[]) {
  const F: Vec3 = [0, 0, 0];
  const M: Vec3 = [0, 0, 0];
  const add = (at: Vec3, force: Vec3, moment: Vec3) => {
    const rxF = cross(at, force);
    for (let i = 0; i < 3; i++) {
      F[i] += force[i];
      M[i] += rxF[i] + moment[i];
    }
  };
  for (const [nodeId, r] of results.reactions) {
    const n = model.nodes.find((node) => node.id === nodeId)!;
    add([n.x, n.y, n.z], [r[0], r[1], r[2]], [r[3], r[4], r[5]]);
  }
  for (const a of applied) {
    add(a.at, a.force, a.moment ?? [0, 0, 0]);
  }
  return { F, M };
}

function expectEquilibrium(model: StructuralModel, results: AnalysisResults, applied: Applied[]) {
  const { F, M } = residual(model, results, applied);
  for (let i = 0; i < 3; i++) {
    expect(F[i]).toBeCloseTo(0, 6);
    expect(M[i]).toBeCloseTo(0, 4);
  }
}

/**
 * Simple beam, uniformly distributed load (AISC Table 3-23, simple beam,
 * uniformly distributed load): R = V = w l / 2.
 *
 * L = 120 in, w = 1 kip/in down (wy = -1), pin at A, roller at B.
 *   R_A = R_B = 1 * 120 / 2 = 60 kips.
 */
describe('Reactions - simple beam with a uniform load', () => {
  const L = 120;
  const w = 1;
  const model: StructuralModel = {
    ...base,
    nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: L, y: 0, z: 0 }],
    elements: [element('E1', 'A', 'B')],
    supports: [pin('A'), rollerX('B')],
    nodalLoads: [],
    distributedLoads: [udl('w', 'E1', 0, -w, 0)],
  };
  const results = solveModel(model);

  it('gives R_A = R_B = w L / 2 = 60 kips', () => {
    expect(results.reactions.get('A')![1]).toBeCloseTo(60, 6);
    expect(results.reactions.get('B')![1]).toBeCloseTo(60, 6);
    expect(results.reactions.get('A')![0]).toBeCloseTo(0, 6);
  });

  it('satisfies sum F = 0 and sum M = 0 with the member load', () => {
    expectEquilibrium(model, results, [{ at: [L / 2, 0, 0], force: [0, -w * L, 0] }]);
  });
});

/**
 * Cantilever, uniformly distributed load (AISC Table 3-23, cantilever beam,
 * uniformly distributed load): R = V = w l, M_max (at the fixed end) = w l^2 / 2.
 *
 * L = 120 in, w = 1 kip/in down (wy = -1), fixed at A, free at B.
 *   R_Ay = 120 kips, M_A = 1 * 120^2 / 2 = 7200 kip-in (counter-clockwise).
 */
describe('Reactions - cantilever with a uniform load', () => {
  const L = 120;
  const w = 1;
  const model: StructuralModel = {
    ...base,
    nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: L, y: 0, z: 0 }],
    elements: [element('E1', 'A', 'B')],
    supports: [fixed('A')],
    nodalLoads: [],
    distributedLoads: [udl('w', 'E1', 0, -w, 0)],
  };
  const results = solveModel(model);

  it('gives R = w L = 120 kips and M = w L^2 / 2 = 7200 kip-in', () => {
    const r = results.reactions.get('A')!;
    expect(r[1]).toBeCloseTo(120, 6);
    expect(r[5]).toBeCloseTo(7200, 4);
    for (const d of [0, 2, 3, 4]) {
      expect(r[d]).toBeCloseTo(0, 6);
    }
  });

  it('satisfies sum F = 0 and sum M = 0 with the member load', () => {
    expectEquilibrium(model, results, [{ at: [L / 2, 0, 0], force: [0, -w * L, 0] }]);
  });
});

/**
 * Beam fixed at one end, supported at the other, uniformly distributed load
 * (AISC Table 3-23, propped cantilever): R1 = 5 w l / 8, R2 = 3 w l / 8,
 * M at the fixed end = w l^2 / 8.
 *
 * L = 120 in, w = 1 kip/in down, fixed at A, roller at B.
 *   R_A = 75 kips, R_B = 45 kips, M_A = 1800 kip-in (counter-clockwise).
 * Check about A: 1800 + 120 * 45 - 120 * 60 = 0.
 */
describe('Reactions - propped cantilever with a uniform load', () => {
  const L = 120;
  const w = 1;
  const model: StructuralModel = {
    ...base,
    nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: L, y: 0, z: 0 }],
    elements: [element('E1', 'A', 'B')],
    supports: [fixed('A'), rollerX('B')],
    nodalLoads: [],
    distributedLoads: [udl('w', 'E1', 0, -w, 0)],
  };
  const results = solveModel(model);

  it('gives R_fixed = 5wL/8, R_prop = 3wL/8 and M = wL^2/8', () => {
    expect(results.reactions.get('A')![1]).toBeCloseTo((5 * w * L) / 8, 6);
    expect(results.reactions.get('B')![1]).toBeCloseTo((3 * w * L) / 8, 6);
    expect(results.reactions.get('A')![5]).toBeCloseTo((w * L * L) / 8, 4);
  });

  it('satisfies sum F = 0 and sum M = 0 with the member load', () => {
    expectEquilibrium(model, results, [{ at: [L / 2, 0, 0], force: [0, -w * L, 0] }]);
  });
});

/**
 * Inclined simple beam, load perpendicular to the member (local y).
 *
 * A = (0, 0), B = (96, 72), so L = 120 in, cos = 0.8, sin = 0.6.
 * Local y for this member is (-sin, cos, 0), so wy = -1 kip/in is a load of
 * 1 kip/in along (0.6, -0.8): resultant w L = 120 kips at the midpoint
 * (48, 36), components Fx = +72, Fy = -96.
 * Pin at A, roller at B that restrains global Y only.
 *
 *   Sum Mz about A: 96 R_By + (48 * -96 - 36 * 72) = 0
 *                   -> R_By = 7200 / 96 = 75 kips
 *   Sum Fy: R_Ay + 75 - 96 = 0 -> R_Ay = 21 kips
 *   Sum Fx: R_Ax + 72 = 0      -> R_Ax = -72 kips
 *
 * The same member with an axial load wx = +0.5 kip/in adds a resultant of
 * 60 kips along (0.8, 0.6), i.e. (48, 36), whose line of action passes
 * through A, so R_By stays 75 and
 *   R_Ay = 96 - 36 - 75 = -15 kips, R_Ax = -72 - 48 = -120 kips.
 */
describe('Reactions - inclined beam with perpendicular and axial member loads', () => {
  const nodes = [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 96, y: 72, z: 0 }];
  const supports = [pin('A'), rollerX('B')];

  describe('perpendicular load only', () => {
    const model: StructuralModel = {
      ...base,
      nodes,
      elements: [element('E1', 'A', 'B')],
      supports,
      nodalLoads: [],
      distributedLoads: [udl('w', 'E1', 0, -1, 0)],
    };
    const results = solveModel(model);

    it('gives R_Ax = -72, R_Ay = 21 and R_By = 75 kips', () => {
      expect(results.reactions.get('A')![0]).toBeCloseTo(-72, 6);
      expect(results.reactions.get('A')![1]).toBeCloseTo(21, 6);
      expect(results.reactions.get('B')![1]).toBeCloseTo(75, 6);
      expect(results.reactions.get('B')![0]).toBe(0);
    });

    it('satisfies sum F = 0 and sum M = 0 with the member load', () => {
      expectEquilibrium(model, results, [{ at: [48, 36, 0], force: [72, -96, 0] }]);
    });
  });

  describe('perpendicular plus axial load', () => {
    const model: StructuralModel = {
      ...base,
      nodes,
      elements: [element('E1', 'A', 'B')],
      supports,
      nodalLoads: [],
      distributedLoads: [udl('w', 'E1', 0, -1, 0), udl('a', 'E1', 0.5, 0, 0)],
    };
    const results = solveModel(model);

    it('gives R_Ax = -120, R_Ay = -15 and R_By = 75 kips', () => {
      expect(results.reactions.get('A')![0]).toBeCloseTo(-120, 6);
      expect(results.reactions.get('A')![1]).toBeCloseTo(-15, 6);
      expect(results.reactions.get('B')![1]).toBeCloseTo(75, 6);
    });

    it('satisfies sum F = 0 and sum M = 0 with both member loads', () => {
      expectEquilibrium(model, results, [
        { at: [48, 36, 0], force: [72, -96, 0] },
        { at: [48, 36, 0], force: [48, 36, 0] },
      ]);
    });
  });
});

/**
 * Cantilever along +X, fixed at A, L = 120 in, with an axial load
 * wx = +0.5 kip/in and a weak-axis load wz = -1 kip/in (local z is global Z
 * for this member, so the load points along -Z).
 *
 *   Sum Fx: R_Ax + 0.5 * 120 = 0       -> R_Ax = -60 kips
 *   Sum Fz: R_Az - 1 * 120 = 0         -> R_Az = 120 kips
 *   Sum My about A: M_Ay + (r x F)_y = 0, with r = (60, 0, 0) and
 *     F = (0, 0, -120): (r x F)_y = -(60 * -120) = 7200
 *                                    -> M_Ay = -7200 kip-in
 * This is the AISC cantilever case (R = w l, M = w l^2 / 2) about the weak
 * axis, and it exercises the weak-axis fixed-end moment signs.
 */
describe('Reactions - cantilever with axial and weak-axis member loads', () => {
  const L = 120;
  const model: StructuralModel = {
    ...base,
    nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: L, y: 0, z: 0 }],
    elements: [element('E1', 'A', 'B')],
    supports: [fixed('A')],
    nodalLoads: [],
    distributedLoads: [udl('w', 'E1', 0.5, 0, -1)],
  };
  const results = solveModel(model);

  it('gives R_Ax = -60, R_Az = 120 kips and M_Ay = -7200 kip-in', () => {
    const r = results.reactions.get('A')!;
    expect(r[0]).toBeCloseTo(-60, 6);
    expect(r[2]).toBeCloseTo(120, 6);
    expect(r[4]).toBeCloseTo(-7200, 4);
    for (const d of [1, 3, 5]) {
      expect(r[d]).toBeCloseTo(0, 6);
    }
  });

  it('satisfies sum F = 0 and sum M = 0 with the member load', () => {
    expectEquilibrium(model, results, [{ at: [L / 2, 0, 0], force: [0.5 * L, 0, -L] }]);
  });
});

/**
 * Mixed nodal and member loads on a simple beam A-B-C, L = 120 in, pin at A,
 * roller at C, two 60 in elements.
 *   - w = 1 kip/in down on E1 (A to B) only: 60 kips at x = 30
 *   - P = 10 kips down at B (nodal, free node)
 *   - Q = 3 kips down at A (nodal, straight into the support)
 *   - M0 = +240 kip-in (counter-clockwise) at C (nodal moment)
 *
 *   Sum Mz about A: 120 R_C + 240 - 60 * 30 - 10 * 60 = 0
 *                   -> R_C = 2160 / 120 = 18 kips
 *   Sum Fy: R_A + 18 - 60 - 10 - 3 = 0 -> R_A = 55 kips
 */
describe('Reactions - simple beam with mixed nodal and member loads', () => {
  const model: StructuralModel = {
    ...base,
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 60, y: 0, z: 0 },
      { id: 'C', x: 120, y: 0, z: 0 },
    ],
    elements: [element('E1', 'A', 'B'), element('E2', 'B', 'C')],
    supports: [pin('A'), rollerX('C')],
    nodalLoads: [
      nodal('P', 'B', { fy: -10 }),
      nodal('Q', 'A', { fy: -3 }),
      nodal('M0', 'C', { mz: 240 }),
    ],
    distributedLoads: [udl('w', 'E1', 0, -1, 0)],
  };
  const results = solveModel(model);

  it('gives R_A = 55 and R_C = 18 kips', () => {
    expect(results.reactions.get('A')![1]).toBeCloseTo(55, 6);
    expect(results.reactions.get('C')![1]).toBeCloseTo(18, 6);
    expect(results.reactions.get('A')![0]).toBeCloseTo(0, 6);
  });

  it('satisfies sum F = 0 and sum M = 0 with nodal and member loads', () => {
    expectEquilibrium(model, results, [
      { at: [30, 0, 0], force: [0, -60, 0] },
      { at: [60, 0, 0], force: [0, -10, 0] },
      { at: [0, 0, 0], force: [0, -3, 0] },
      { at: [120, 0, 0], force: [0, 0, 0], moment: [0, 0, 240] },
    ]);
  });
});

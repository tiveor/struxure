import { describe, it, expect } from 'vitest';
import { solveModel } from '../solver';
import type { StructuralModel, Support, NodalLoad } from '../types';

/**
 * Validation of vertical and nearly vertical members, end to end through
 * solveModel (#66).
 *
 * Reference: AISC Steel Construction Manual (15th ed.), Table 3-23, case 22
 * (cantilever with a concentrated load at the free end): tip deflection
 * delta = P L^3 / (3 E I). For the portal frame, each fixed-base column under
 * a rigid beam is a fixed-guided member with lateral stiffness 12 E I / h^3,
 * so two columns give delta = P h^3 / (24 E I) (Kassimali, Structural
 * Analysis, 6th ed., the sway of a fixed-base frame with a rigid girder).
 *
 * W12x26, A992: E = 29000 ksi, Ix = 204 in^4 (strong), Iy = 17.3 in^4 (weak).
 * Units: kips, inches. Every model lies in the global XY plane, Y up, which is
 * how 2D frames are drawn in Struxure.
 */

const E = 29000;
const IX = 204;
const IY = 17.3;

const fixed = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
});

const nodal = (id: string, nodeId: string, f: Partial<Omit<NodalLoad, 'id' | 'nodeId'>>): NodalLoad => ({
  id, nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...f,
});

const materials = [{ id: 'steel', name: 'A992', type: 'steel' as const, E, G: 11200, density: 0 }];

/**
 * W12x26 with a very large area, so axial shortening is negligible and the
 * closed-form flexural deflections apply directly.
 */
const column = { id: 'col', name: 'W12x26', A: 1e6, Ix: IX, Iy: IY, J: 0.3 };
/** A girder stiff enough to act as rigid next to the columns. */
const rigid = { id: 'rigid', name: 'rigid', A: 1e6, Ix: 1e9, Iy: 1e9, J: 1e9 };

/** Cantilever from the origin along (cos t, sin t, 0) in the XY plane. */
function cantilever(deg: number, L: number, betaAngle: number, load: Partial<NodalLoad>): StructuralModel {
  const t = (deg * Math.PI) / 180;
  return {
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: L * Math.cos(t), y: L * Math.sin(t), z: 0 },
    ],
    elements: [{ id: 'C', nodeI: 'A', nodeJ: 'B', materialId: 'steel', sectionId: 'col', betaAngle }],
    materials,
    sections: [column],
    supports: [fixed('A')],
    nodalLoads: [nodal('P', 'B', load)],
    distributedLoads: [],
  };
}

describe('vertical cantilever column', () => {
  const L = 144;
  const P = 1;

  it('bends in the XY plane about its strong axis: delta = P L^3 / (3 E Ix)', () => {
    // delta = 1 * 144^3 / (3 * 29000 * 204) = 2985984 / 17748000 = 0.168243 in
    const delta = (P * L ** 3) / (3 * E * IX);
    const r = solveModel(cantilever(90, L, 0, { fx: P }));
    expect(r.nodeDisplacements.get('B')![0]).toBeCloseTo(delta, 6);
    expect(delta).toBeCloseTo(0.168243, 6);
  });

  it('bends out of plane (global Z) about its weak axis: delta = P L^3 / (3 E Iy)', () => {
    // delta = 2985984 / (3 * 29000 * 17.3) = 2985984 / 1505100 = 1.983910 in
    const delta = (P * L ** 3) / (3 * E * IY);
    const r = solveModel(cantilever(90, L, 0, { fz: P }));
    expect(r.nodeDisplacements.get('B')![2]).toBeCloseTo(delta, 6);
  });

  it('bends in plane about its weak axis when beta = 90', () => {
    // beta = 90 turns the section a quarter turn, the standard way to model a
    // weak-axis column: delta = P L^3 / (3 E Iy) in X.
    const delta = (P * L ** 3) / (3 * E * IY);
    const r = solveModel(cantilever(90, L, 90, { fx: P }));
    expect(r.nodeDisplacements.get('B')![0]).toBeCloseTo(delta, 6);
  });

  it('gives the same in-plane stiffness pointing down (-Y)', () => {
    const delta = (P * L ** 3) / (3 * E * IX);
    const r = solveModel(cantilever(-90, L, 0, { fx: P }));
    expect(r.nodeDisplacements.get('B')![0]).toBeCloseTo(delta, 6);
  });
});

describe('nearly vertical members', () => {
  // A load perpendicular to the member, in the XY plane, gives a deflection
  // along that same perpendicular of P L^3 / (3 E Ix) at every tilt. Before
  // #66, members within about 2.56 deg of vertical used Iy instead, so 87 and
  // 88 deg differed by a factor of Ix / Iy = 11.8.
  const L = 144;
  const P = 1;
  const delta = (P * L ** 3) / (3 * E * IX);

  for (const deg of [80, 87, 88, 89.5, 89.99, 90]) {
    it(`a member tilted ${deg} deg bends in plane about Ix`, () => {
      const t = (deg * Math.PI) / 180;
      // Unit vector perpendicular to the member in the XY plane.
      const px = -Math.sin(t);
      const py = Math.cos(t);
      const r = solveModel(cantilever(deg, L, 0, { fx: P * px, fy: P * py }));
      const u = r.nodeDisplacements.get('B')!;
      expect(u[0] * px + u[1] * py).toBeCloseTo(delta, 6);
    });
  }
});

describe('fixed-base portal frame with a rigid girder', () => {
  // Columns h = 144 in at x = 0 and x = 240, girder at y = 144, lateral load
  // P = 10 kips at the girder level. delta = P h^3 / (24 E Ix):
  //   10 * 144^3 / (24 * 29000 * 204) = 29859840 / 141984000 = 0.210304 in
  // With the columns on their weak axis it would be 0.210304 * 204 / 17.3 =
  // 2.48 in, which is what the old vertical convention produced.
  const h = 144;
  const P = 10;
  const model: StructuralModel = {
    nodes: [
      { id: 'S1', x: 0, y: 0, z: 0 },
      { id: 'S2', x: 240, y: 0, z: 0 },
      { id: 'N1', x: 0, y: h, z: 0 },
      { id: 'N2', x: 240, y: h, z: 0 },
    ],
    elements: [
      { id: 'C1', nodeI: 'S1', nodeJ: 'N1', materialId: 'steel', sectionId: 'col', betaAngle: 0 },
      { id: 'C2', nodeI: 'S2', nodeJ: 'N2', materialId: 'steel', sectionId: 'col', betaAngle: 0 },
      { id: 'G', nodeI: 'N1', nodeJ: 'N2', materialId: 'steel', sectionId: 'rigid', betaAngle: 0 },
    ],
    materials,
    sections: [column, rigid],
    supports: [fixed('S1'), fixed('S2')],
    nodalLoads: [nodal('P', 'N1', { fx: P })],
    distributedLoads: [],
  };

  it('sways delta = P h^3 / (24 E Ix)', () => {
    const delta = (P * h ** 3) / (24 * E * IX);
    expect(delta).toBeCloseTo(0.210304, 6);
    const r = solveModel(model);
    // The girder is stiff but not infinitely so; 4 decimals is a relative
    // tolerance of about 0.02%.
    expect(r.nodeDisplacements.get('N1')![0]).toBeCloseTo(delta, 4);
    expect(r.nodeDisplacements.get('N2')![0]).toBeCloseTo(delta, 4);
  });

  it('splits the base shear and moment equally: V = P/2, M = P h / 4', () => {
    // Each fixed-guided column carries V = 5 kips and end moments
    // V h / 2 = 5 * 144 / 2 = 360 kip-in at top and bottom.
    const r = solveModel(model);
    for (const id of ['S1', 'S2']) {
      const R = r.reactions.get(id)!;
      expect(R[0]).toBeCloseTo(-P / 2, 4);
      expect(Math.abs(R[5])).toBeCloseTo((P * h) / 4, 2);
    }
  });
});

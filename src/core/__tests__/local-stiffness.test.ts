import { describe, it, expect } from 'vitest';
import type { Matrix } from 'ml-matrix';
import type { FrameElement, Material, Section, StructuralNode } from '../types';
import { elementLength, fixedEndForces, localStiffnessMatrix } from '../local-stiffness';

/**
 * Validation tests for the local element stiffness matrix.
 *
 * The 12x12 space-frame element matrix has a closed form, so the reference
 * below is written out from that closed form rather than obtained by calling
 * the implementation. Every non-zero term is one of six quantities from
 * Euler-Bernoulli beam theory, with no shear deformation:
 *
 *   axial        EA/L
 *   bending      12EI/L^3, 6EI/L^2, 4EI/L, 2EI/L
 *   torsion      GJ/L
 *
 * Local DOF order is [ux, uy, uz, rx, ry, rz] at node I then at node J, so
 * bending about the local z axis couples uy with rz, and bending about the
 * local y axis couples uz with ry.
 *
 * The module maps section.Ix (strong axis) onto bending about local z and
 * section.Iy (weak axis) onto bending about local y.
 */

const A992: Material = {
  id: 'steel', name: 'A992 Steel', type: 'steel',
  E: 29000, G: 11200, density: 0.000284, fy: 50,
};

const W12x26: Section = {
  id: 'W12x26', name: 'W12x26',
  A: 7.65, Ix: 204, Iy: 17.3, J: 0.3,
};

const NODE_I: StructuralNode = { id: 'I', x: 0, y: 0, z: 0 };
const NODE_J: StructuralNode = { id: 'J', x: 120, y: 0, z: 0 };

const ELEMENT: FrameElement = {
  id: 'E1', nodeI: 'I', nodeJ: 'J',
  materialId: 'steel', sectionId: 'W12x26', betaAngle: 0,
};

const L = 120;

/** The six closed-form terms, worked here from E, G, A, Ix, Iy, J and L. */
const EA_L = (29000 * 7.65) / L;              // 1848.75
const GJ_L = (11200 * 0.3) / L;               // 28
const Z1 = (12 * 29000 * 204) / L ** 3;       // 41.0833  strong axis
const Z2 = (6 * 29000 * 204) / L ** 2;        // 2465
const Z3 = (4 * 29000 * 204) / L;             // 197200
const Z4 = (2 * 29000 * 204) / L;             // 98600
const Y1 = (12 * 29000 * 17.3) / L ** 3;      // weak axis
const Y2 = (6 * 29000 * 17.3) / L ** 2;
const Y3 = (4 * 29000 * 17.3) / L;
const Y4 = (2 * 29000 * 17.3) / L;

/**
 * The tabulated space-frame element matrix, transcribed from the closed form
 * above. Columns follow the same DOF order as the rows.
 */
const REFERENCE: number[][] = [
  [EA_L,   0,     0,    0,     0,    0,  -EA_L,   0,     0,    0,     0,    0],
  [  0,   Z1,     0,    0,     0,   Z2,     0,  -Z1,     0,    0,     0,   Z2],
  [  0,    0,    Y1,    0,   -Y2,    0,     0,    0,   -Y1,    0,   -Y2,    0],
  [  0,    0,     0, GJ_L,     0,    0,     0,    0,     0, -GJ_L,    0,    0],
  [  0,    0,   -Y2,    0,    Y3,    0,     0,    0,    Y2,    0,    Y4,    0],
  [  0,   Z2,     0,    0,     0,   Z3,     0,  -Z2,     0,    0,     0,   Z4],
  [-EA_L,  0,     0,    0,     0,    0,   EA_L,   0,     0,    0,     0,    0],
  [  0,  -Z1,     0,    0,     0,  -Z2,     0,   Z1,     0,    0,     0,  -Z2],
  [  0,    0,   -Y1,    0,    Y2,    0,     0,    0,    Y1,    0,    Y2,    0],
  [  0,    0,     0, -GJ_L,    0,    0,     0,    0,     0,  GJ_L,    0,    0],
  [  0,    0,   -Y2,    0,    Y4,    0,     0,    0,    Y2,    0,    Y3,    0],
  [  0,   Z2,     0,    0,     0,   Z4,     0,  -Z2,     0,    0,     0,   Z3],
];

const k = (): Matrix => localStiffnessMatrix(ELEMENT, A992, W12x26, NODE_I, NODE_J);

/** Multiply the 12x12 matrix by a 12-vector. */
function apply(m: Matrix, v: number[]): number[] {
  return Array.from({ length: 12 }, (_, i) =>
    v.reduce((sum, vj, j) => sum + m.get(i, j) * vj, 0),
  );
}

describe('elementLength', () => {
  it('is the 3D distance between the two nodes', () => {
    // 3-4-12 is a Pythagorean quadruple: sqrt(9 + 16 + 144) = 13.
    expect(elementLength(
      { id: 'a', x: 1, y: 2, z: 3 },
      { id: 'b', x: 4, y: 6, z: 15 },
    )).toBeCloseTo(13, 12);
  });

  it('is independent of direction', () => {
    expect(elementLength(NODE_J, NODE_I)).toBeCloseTo(L, 12);
  });
});

describe('localStiffnessMatrix', () => {
  it('matches the tabulated space-frame element matrix entry by entry', () => {
    const m = k();
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        expect(
          m.get(i, j),
          `entry (${i}, ${j}) differs from the closed form`,
        ).toBeCloseTo(REFERENCE[i][j], 9);
      }
    }
  });

  it('pins the six terms to their hand-worked magnitudes', () => {
    // W12x26, A992, L = 120 in:
    //   EA/L      = 29000*7.65/120            = 1848.75
    //   12EIz/L^3 = 12*29000*204/120^3        = 41.0833
    //   6EIz/L^2  = 6*29000*204/120^2         = 2465
    //   4EIz/L    = 4*29000*204/120           = 197200
    //   2EIz/L    = 2*29000*204/120           = 98600
    //   GJ/L      = 11200*0.3/120             = 28
    const m = k();
    expect(m.get(0, 0)).toBeCloseTo(1848.75, 9);   // axial
    expect(m.get(1, 1)).toBeCloseTo(41.0833, 4);   // shear, strong axis
    expect(m.get(1, 5)).toBeCloseTo(2465, 9);      // shear-moment coupling
    expect(m.get(5, 5)).toBeCloseTo(197200, 9);    // near-end rotation
    expect(m.get(5, 11)).toBeCloseTo(98600, 9);    // carry-over to the far end
    expect(m.get(3, 3)).toBeCloseTo(28, 9);        // torsion
  });

  it('carries over exactly half the near-end moment', () => {
    // 2EI/L is half of 4EI/L on both axes. A wrong factor here is the classic
    // way a matrix stays symmetric while being wrong.
    const m = k();
    expect(m.get(5, 11)).toBeCloseTo(m.get(5, 5) / 2, 9);
    expect(m.get(4, 10)).toBeCloseTo(m.get(4, 4) / 2, 9);
  });

  it('is symmetric', () => {
    // Maxwell-Betti reciprocity: the matrix of any linear elastic element is
    // symmetric, whatever the section.
    const m = k();
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        expect(m.get(i, j), `(${i}, ${j}) vs (${j}, ${i})`).toBeCloseTo(m.get(j, i), 12);
      }
    }
  });

  it('separates the strong and weak axes', () => {
    // Ix = 204 and Iy = 17.3, so the strong-axis terms must be larger in that
    // ratio. A transposed Ix/Iy would keep the matrix symmetric and valid.
    const m = k();
    expect(m.get(1, 1) / m.get(2, 2)).toBeCloseTo(204 / 17.3, 9);
    expect(m.get(5, 5) / m.get(4, 4)).toBeCloseTo(204 / 17.3, 9);
  });

  it('produces no force under a rigid-body translation', () => {
    // A free-free element matrix is singular: the six rigid-body modes are in
    // its null space. Applying them directly is the well-conditioned form of
    // the determinant check.
    const m = k();
    for (const axis of [0, 1, 2]) {
      const v = new Array(12).fill(0);
      v[axis] = 1;
      v[axis + 6] = 1;
      for (const f of apply(m, v)) {
        expect(f).toBeCloseTo(0, 6);
      }
    }
  });

  it('produces no force under a rigid-body rotation about local z', () => {
    // Rotating the element by theta about z moves node J transversely by
    // theta*L and rotates both nodes by theta.
    const theta = 0.001;
    const v = new Array(12).fill(0);
    v[5] = theta;          // rz at I
    v[7] = theta * L;      // uy at J
    v[11] = theta;         // rz at J
    for (const f of apply(k(), v)) {
      expect(f).toBeCloseTo(0, 6);
    }
  });

  it('produces no force under a rigid-body rotation about local y', () => {
    // Positive rotation about y moves a point on +x in the -z direction.
    const theta = 0.001;
    const v = new Array(12).fill(0);
    v[4] = theta;          // ry at I
    v[8] = -theta * L;     // uz at J
    v[10] = theta;         // ry at J
    for (const f of apply(k(), v)) {
      expect(f).toBeCloseTo(0, 6);
    }
  });

  it('produces no force under a rigid-body twist', () => {
    const v = new Array(12).fill(0);
    v[3] = 0.001;
    v[9] = 0.001;
    for (const f of apply(k(), v)) {
      expect(f).toBeCloseTo(0, 9);
    }
  });

  it('gives the axial force of a bar under a unit stretch', () => {
    // Holding I and pushing J out by 1 in must take EA/L, and the reaction at
    // I must balance it.
    const v = new Array(12).fill(0);
    v[6] = 1;
    const f = apply(k(), v);
    expect(f[6]).toBeCloseTo(EA_L, 9);
    expect(f[0]).toBeCloseTo(-EA_L, 9);
  });

  it('scales the bending terms with the cube, square and first power of L', () => {
    // Doubling the length divides 12EI/L^3 by 8, 6EI/L^2 by 4 and 4EI/L by 2.
    const long = localStiffnessMatrix(
      ELEMENT, A992, W12x26, NODE_I, { id: 'J', x: 2 * L, y: 0, z: 0 },
    );
    const m = k();
    expect(long.get(1, 1)).toBeCloseTo(m.get(1, 1) / 8, 9);
    expect(long.get(1, 5)).toBeCloseTo(m.get(1, 5) / 4, 9);
    expect(long.get(5, 5)).toBeCloseTo(m.get(5, 5) / 2, 9);
    expect(long.get(0, 0)).toBeCloseTo(m.get(0, 0) / 2, 9);
  });
});

describe('fixedEndForces', () => {
  // Fixed-fixed beam under a uniform load w:
  //   end shears  = wL/2
  //   end moments = wL^2/12, opposite in sign at the two ends
  const w = -2;              // kip/in, acting in -y
  const SHEAR = (w * L) / 2; // -120 kips
  const MOMENT = (w * L * L) / 12; // -2400 kip-in

  it('splits a transverse load in local y into wL/2 and wL^2/12', () => {
    const f = fixedEndForces(L, 0, w, 0);
    expect(f[1]).toBeCloseTo(SHEAR, 9);
    expect(f[7]).toBeCloseTo(SHEAR, 9);
    expect(f[5]).toBeCloseTo(MOMENT, 9);
    expect(f[11]).toBeCloseTo(-MOMENT, 9);
  });

  it('flips the moment signs for a load in local z', () => {
    // Bending about y has the opposite sign convention to bending about z.
    const f = fixedEndForces(L, 0, 0, w);
    expect(f[2]).toBeCloseTo(SHEAR, 9);
    expect(f[8]).toBeCloseTo(SHEAR, 9);
    expect(f[4]).toBeCloseTo(-MOMENT, 9);
    expect(f[10]).toBeCloseTo(MOMENT, 9);
  });

  it('splits an axial load evenly and conserves the total', () => {
    const f = fixedEndForces(L, w, 0, 0);
    expect(f[0]).toBeCloseTo((w * L) / 2, 9);
    expect(f[6]).toBeCloseTo((w * L) / 2, 9);
    expect(f[0] + f[6]).toBeCloseTo(w * L, 9);
  });

  it('leaves every other entry at zero', () => {
    // Zero is asserted with a tolerance because the unloaded moment entries
    // come out as negative zero, which Object.is separates from +0.
    const f = fixedEndForces(L, 0, w, 0);
    const loaded = new Set([1, 5, 7, 11]);
    f.forEach((value, i) => {
      if (!loaded.has(i)) expect(value, `entry ${i}`).toBeCloseTo(0, 12);
    });
  });

  it('returns no forces for no load', () => {
    for (const value of fixedEndForces(L, 0, 0, 0)) {
      expect(value).toBeCloseTo(0, 12);
    }
  });
});

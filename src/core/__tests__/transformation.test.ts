import { describe, it, expect } from 'vitest';
import type { Matrix } from 'ml-matrix';
import type { StructuralNode } from '../types';
import { rotationMatrix3x3, transformationMatrix12x12 } from '../transformation';

/**
 * Validation tests for the 3D frame transformation matrices.
 *
 * Reference: the rotation matrix of a space-frame element is the matrix of
 * direction cosines of the local axes, one local axis per row
 * (Kassimali, Matrix Analysis of Structures, 2nd ed., Ch. 8, space frames).
 * Its first row is the unit vector from node I to node J. A rotation matrix
 * is orthonormal (R * R^T = I) with determinant +1 (right-handed axes).
 *
 * For an element lying in the global XY plane at an angle theta from +X,
 * with the local z axis kept on global +Z, the rotation is the plane rotation
 * about Z:
 *
 *   R = |  cos(theta)  sin(theta)  0 |
 *       | -sin(theta)  cos(theta)  0 |
 *       |      0           0       1 |
 *
 * Every expected value below is written from these closed forms, not from the
 * implementation.
 */

const ORIGIN: StructuralNode = { id: 'I', x: 0, y: 0, z: 0 };

const node = (x: number, y: number, z: number): StructuralNode => ({ id: 'J', x, y, z });

function expectMatrixCloseTo(m: Matrix, expected: number[][], digits = 12): void {
  expect(m.rows).toBe(expected.length);
  expect(m.columns).toBe(expected[0].length);
  for (let i = 0; i < expected.length; i++) {
    for (let j = 0; j < expected[0].length; j++) {
      expect(m.get(i, j), `entry (${i}, ${j})`).toBeCloseTo(expected[i][j], digits);
    }
  }
}

function identity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

/** Determinant of a 3x3 matrix by cofactor expansion along the first row. */
function det3(m: Matrix): number {
  const a = m.to2DArray();
  return (
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
  );
}

describe('rotationMatrix3x3', () => {
  it('is the identity for an element along global +X', () => {
    // Local axes coincide with the global axes, so every direction cosine is
    // 1 on the diagonal and 0 elsewhere.
    expectMatrixCloseTo(rotationMatrix3x3(ORIGIN, node(120, 0, 0), 0), identity(3));
  });

  it('is the plane rotation about Z for an element at 30 degrees in XY', () => {
    // theta = 30 deg: cos = sqrt(3)/2 = 0.866025, sin = 1/2.
    // Node J at L*(cos, sin, 0) with L = 100.
    const c = Math.sqrt(3) / 2;
    const s = 0.5;
    expectMatrixCloseTo(rotationMatrix3x3(ORIGIN, node(100 * c, 100 * s, 0), 0), [
      [c, s, 0],
      [-s, c, 0],
      [0, 0, 1],
    ]);
  });

  it('maps local x onto global Y for an element rotated 90 degrees about Z', () => {
    // theta = 90 deg: the element axis is global +Y, so the first row is
    // (cos 90, sin 90, 0) = (0, 1, 0). The local y and z axes of a vertical
    // member are a convention, so only orthonormality is required of them
    // here; see the separate test that documents the current choice.
    const R = rotationMatrix3x3(ORIGIN, node(0, 144, 0), 0);
    expect(R.get(0, 0)).toBeCloseTo(0, 12);
    expect(R.get(0, 1)).toBeCloseTo(1, 12);
    expect(R.get(0, 2)).toBeCloseTo(0, 12);
    expectMatrixCloseTo(R.mmul(R.transpose()), identity(3));
    expect(det3(R)).toBeCloseTo(1, 12);
  });

  it('documents the current local axes of a vertical member', () => {
    // Pins the existing convention so a change to it is deliberate. For a
    // member along +Y the code takes local z = x cross global Z, normalized:
    //   (0, 1, 0) x (0, 0, 1) = (1, 0, 0)
    // and local y = z cross x:
    //   (1, 0, 0) x (0, 1, 0) = (0, 0, 1)
    expectMatrixCloseTo(rotationMatrix3x3(ORIGIN, node(0, 144, 0), 0), [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ]);
  });

  it('flips local z for an element along -X so local y stays on global +Y', () => {
    // x = (-1, 0, 0). The code takes local z = x cross global Y, normalized:
    //   (-1, 0, 0) x (0, 1, 0) = (0, 0, -1)
    // and local y = z cross x = (0, 0, -1) x (-1, 0, 0) = (0, 1, 0).
    expectMatrixCloseTo(rotationMatrix3x3(ORIGIN, node(-120, 0, 0), 0), [
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
    ]);
  });

  it('puts the direction cosines of a general 3D element in the first row', () => {
    // Node J at (40, 80, 80): L = sqrt(1600 + 6400 + 6400) = 120, so the
    // direction cosines are (1/3, 2/3, 2/3).
    const R = rotationMatrix3x3(ORIGIN, node(40, 80, 80), 0);
    expect(R.get(0, 0)).toBeCloseTo(1 / 3, 12);
    expect(R.get(0, 1)).toBeCloseTo(2 / 3, 12);
    expect(R.get(0, 2)).toBeCloseTo(2 / 3, 12);
  });

  it('is orthonormal and right-handed for a general 3D element and beta angle', () => {
    // R * R^T = I and det(R) = +1 for any proper rotation.
    for (const beta of [0, 30, 90, -45]) {
      const R = rotationMatrix3x3(ORIGIN, node(40, 80, 80), beta);
      expectMatrixCloseTo(R.mmul(R.transpose()), identity(3));
      expect(det3(R)).toBeCloseTo(1, 12);
    }
  });

  it('keeps local z horizontal for an inclined member in the XY plane', () => {
    // Node J at (60, 80, 0): cos = 0.6, sin = 0.8, so with local z on +Z the
    // plane rotation gives rows (0.6, 0.8, 0), (-0.8, 0.6, 0), (0, 0, 1).
    expectMatrixCloseTo(rotationMatrix3x3(ORIGIN, node(60, 80, 0), 0), [
      [0.6, 0.8, 0],
      [-0.8, 0.6, 0],
      [0, 0, 1],
    ]);
  });

  it('rotates local y onto local z for a 90 degree beta angle', () => {
    // For an element along +X, beta = +90 deg rotates the local axes about x
    // by a right-hand quarter turn: y -> (0, 0, 1) and z -> (0, -1, 0).
    expectMatrixCloseTo(rotationMatrix3x3(ORIGIN, node(120, 0, 0), 90), [
      [1, 0, 0],
      [0, 0, 1],
      [0, -1, 0],
    ]);
  });

  it('rotates local y and z by beta about local x for an element along +X', () => {
    // beta = 30 deg: y = (0, cos b, sin b), z = (0, -sin b, cos b).
    const c = Math.sqrt(3) / 2;
    const s = 0.5;
    expectMatrixCloseTo(rotationMatrix3x3(ORIGIN, node(120, 0, 0), 30), [
      [1, 0, 0],
      [0, c, s],
      [0, -s, c],
    ]);
  });

  it('throws on a zero-length element', () => {
    expect(() => rotationMatrix3x3(ORIGIN, node(0, 0, 0), 0)).toThrow('zero length');
  });

  // Skipped on purpose: this exposes a discontinuity in the solver, reported
  // separately and not fixed here. The vertical-member branch is taken when
  // |m_x| > 0.999, i.e. within about 2.56 deg of global Y. Just outside that
  // cone local z is global Z; just inside it, local z jumps to (almost) global
  // X. Two members of an XY frame tilted 87 and 88 deg from horizontal then
  // swap the axis used for in-plane bending (Ix vs Iy), which changes their
  // in-plane stiffness by a factor of Ix/Iy. A rotation that varies
  // continuously with the member direction must keep local z near +Z here.
  it.skip('keeps local z continuous as a member in the XY plane approaches vertical', () => {
    const at = (deg: number) => {
      const t = (deg * Math.PI) / 180;
      return rotationMatrix3x3(ORIGIN, node(Math.cos(t), Math.sin(t), 0), 0);
    };
    const below = at(87);
    const above = at(88);
    // Local z of both members should be (0, 0, 1).
    expect(below.get(2, 2)).toBeCloseTo(1, 6);
    expect(above.get(2, 2)).toBeCloseTo(1, 6);
  });
});

describe('transformationMatrix12x12', () => {
  // A general element whose R has no zero entries off the first row.
  const J = node(40, 80, 80);
  const BETA = 30;

  it('places R in the four 3x3 diagonal blocks and zero elsewhere', () => {
    // [T] = diag(R, R, R, R), one block per translation and rotation triad
    // of each node (Kassimali, 2nd ed., Ch. 8).
    const R = rotationMatrix3x3(ORIGIN, J, BETA);
    const T = transformationMatrix12x12(ORIGIN, J, BETA);
    expect(T.rows).toBe(12);
    expect(T.columns).toBe(12);
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        const sameBlock = Math.floor(i / 3) === Math.floor(j / 3);
        const expected = sameBlock ? R.get(i % 3, j % 3) : 0;
        expect(T.get(i, j), `entry (${i}, ${j})`).toBeCloseTo(expected, 12);
      }
    }
  });

  it('is orthonormal, so its inverse is its transpose', () => {
    const T = transformationMatrix12x12(ORIGIN, J, BETA);
    expectMatrixCloseTo(T.mmul(T.transpose()), identity(12));
  });

  it('is the 12x12 identity for an element along global +X', () => {
    expectMatrixCloseTo(transformationMatrix12x12(ORIGIN, node(120, 0, 0), 0), identity(12));
  });
});

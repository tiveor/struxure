import { describe, it, expect } from 'vitest';
import { Matrix } from 'ml-matrix';
import {
  addSubMatrix,
  columnVector,
  eye,
  multiply,
  subMatrix,
  toArray,
  transformMatrix,
  zeros,
} from '../matrix-utils';

/**
 * Validation tests for the matrix helpers used by the assembler and solver.
 *
 * Every expected value is a small product or sum worked by hand in the
 * comment above it. The congruence transform is checked against the
 * closed-form global stiffness of a plane truss bar:
 *
 *   k_global = (EA/L) * | c^2  cs  |
 *                       | cs   s^2 |
 *
 * (Kassimali, Matrix Analysis of Structures, 2nd ed., Ch. 3, plane trusses).
 */

function expectMatrixCloseTo(m: Matrix, expected: number[][], digits = 12): void {
  expect(m.rows).toBe(expected.length);
  expect(m.columns).toBe(expected[0].length);
  for (let i = 0; i < expected.length; i++) {
    for (let j = 0; j < expected[0].length; j++) {
      expect(m.get(i, j), `entry (${i}, ${j})`).toBeCloseTo(expected[i][j], digits);
    }
  }
}

describe('zeros and eye', () => {
  it('builds a zero matrix of the requested shape', () => {
    expectMatrixCloseTo(zeros(2, 3), [
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('builds the identity', () => {
    expectMatrixCloseTo(eye(3), [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
});

describe('multiply', () => {
  it('computes a 2x2 product', () => {
    // | 1 2 | | 5 6 |   | 1*5+2*7  1*6+2*8 |   | 19 22 |
    // | 3 4 | | 7 8 | = | 3*5+4*7  3*6+4*8 | = | 43 50 |
    const a = new Matrix([[1, 2], [3, 4]]);
    const b = new Matrix([[5, 6], [7, 8]]);
    expectMatrixCloseTo(multiply(a, b), [[19, 22], [43, 50]]);
  });

  it('computes a non-square product', () => {
    // | 1 0 2 |   | 1 |   | 1 + 0 + 6 |   | 7 |
    // | 0 3 1 | * | 2 | = | 0 + 6 + 3 | = | 9 |
    //             | 3 |
    const a = new Matrix([[1, 0, 2], [0, 3, 1]]);
    expectMatrixCloseTo(multiply(a, columnVector([1, 2, 3])), [[7], [9]]);
  });
});

describe('transformMatrix', () => {
  it('reproduces the global stiffness of an inclined plane truss bar', () => {
    // A bar at cos = 0.6, sin = 0.8 with EA/L = 100. In local coordinates
    // only the axial term is non-zero: k_local = diag(100, 0). With
    // T = | c  s |, T^T * k_local * T = 100 * | c^2 cs  | = | 36 48 |
    //     |-s  c |                            | cs  s^2 |   | 48 64 |
    const T = new Matrix([[0.6, 0.8], [-0.8, 0.6]]);
    const k = new Matrix([[100, 0], [0, 0]]);
    expectMatrixCloseTo(transformMatrix(T, k), [[36, 48], [48, 64]]);
  });

  it('leaves a matrix unchanged under the identity', () => {
    const k = new Matrix([[4, -2], [-2, 3]]);
    expectMatrixCloseTo(transformMatrix(eye(2), k), k.to2DArray());
  });
});

describe('subMatrix', () => {
  it('extracts the rows and columns at the given indices', () => {
    // From m[i][j] = 10*i + j pick rows {0, 2} and columns {1, 3}:
    //   | 01 03 |
    //   | 21 23 |
    const m = new Matrix(Array.from({ length: 4 }, (_, i) =>
      Array.from({ length: 4 }, (_, j) => 10 * i + j)));
    expectMatrixCloseTo(subMatrix(m, [0, 2], [1, 3]), [[1, 3], [21, 23]]);
  });
});

describe('addSubMatrix', () => {
  it('scatters a 2x2 block into the given global rows and columns', () => {
    // Adding | 1 2 | at rows/cols {0, 2} of a 3x3 zero matrix puts each
    //        | 3 4 |
    // entry (i, j) at (idx[i], idx[j]) and leaves row and column 1 empty.
    const target = zeros(3, 3);
    addSubMatrix(target, new Matrix([[1, 2], [3, 4]]), [0, 2], [0, 2]);
    expectMatrixCloseTo(target, [
      [1, 0, 2],
      [0, 0, 0],
      [3, 0, 4],
    ]);
  });

  it('accumulates overlapping contributions instead of overwriting', () => {
    // Two spring elements of stiffness 5 and 7 in series, sharing DOF 1:
    //   spring 1 on DOFs {0, 1}: 5 * | 1 -1 |
    //                                |-1  1 |
    //   spring 2 on DOFs {1, 2}: 7 * | 1 -1 |
    //                                |-1  1 |
    // The shared diagonal is 5 + 7 = 12 (direct stiffness method).
    const K = zeros(3, 3);
    addSubMatrix(K, new Matrix([[5, -5], [-5, 5]]), [0, 1], [0, 1]);
    addSubMatrix(K, new Matrix([[7, -7], [-7, 7]]), [1, 2], [1, 2]);
    expectMatrixCloseTo(K, [
      [5, -5, 0],
      [-5, 12, -7],
      [0, -7, 7],
    ]);
  });
});

describe('columnVector and toArray', () => {
  it('round-trip a plain array through a column vector', () => {
    const v = columnVector([1.5, -2, 3]);
    expect(v.rows).toBe(3);
    expect(v.columns).toBe(1);
    const back = toArray(v);
    expect(back).toHaveLength(3);
    [1.5, -2, 3].forEach((x, i) => expect(back[i]).toBeCloseTo(x, 12));
  });
});

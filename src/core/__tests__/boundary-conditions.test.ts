import { describe, it, expect } from 'vitest';
import { Matrix, inverse } from 'ml-matrix';
import type { StructuralModel, Support } from '../types';
import {
  applyBoundaryConditions,
  getFreeDofs,
  getRestrainedDofs,
} from '../boundary-conditions';
import { assembleGlobalSystem } from '../assembler';

/**
 * Validation tests for boundary condition handling.
 *
 * Each node carries six DOFs in the order [ux, uy, uz, rx, ry, rz], so node
 * index n owns global DOFs 6n .. 6n+5. Restraining a DOF removes its row and
 * column from the system (partitioning K into free and restrained parts,
 * Kassimali, Matrix Analysis of Structures, 2nd ed., Ch. 3 and 6).
 *
 * The closed-form check at the end solves the reduced system of a cantilever
 * and compares it with Euler-Bernoulli beam theory:
 *   tip deflection  v = P L^3 / (3 E I)
 *   tip rotation    theta = P L^2 / (2 E I)
 */

const pin = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: false, rz: false,
});

const fixed = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
});

const NODE_INDEX = new Map([['A', 0], ['B', 1], ['C', 2]]);

describe('getRestrainedDofs', () => {
  it('maps each restrained flag to 6 * nodeIndex + dofOffset', () => {
    // Pin at B (index 1): ux, uy, uz, rx -> 6, 7, 8, 9.
    // Fixed at C (index 2): all six -> 12 .. 17.
    const restrained = getRestrainedDofs([pin('B'), fixed('C')], NODE_INDEX);
    expect([...restrained].sort((a, b) => a - b)).toEqual(
      [6, 7, 8, 9, 12, 13, 14, 15, 16, 17],
    );
  });

  it('maps a single rotational restraint to its own DOF', () => {
    // Only rz at A (index 0): DOF 5.
    const restrained = getRestrainedDofs(
      [{ nodeId: 'A', dx: false, dy: false, dz: false, rx: false, ry: false, rz: true }],
      NODE_INDEX,
    );
    expect([...restrained]).toEqual([5]);
  });

  it('ignores a support on a node that is not in the model', () => {
    expect(getRestrainedDofs([pin('missing')], NODE_INDEX).size).toBe(0);
  });
});

describe('getFreeDofs', () => {
  it('returns the complement of the restrained set, in order', () => {
    expect(getFreeDofs(8, new Set([0, 3, 7]))).toEqual([1, 2, 4, 5, 6]);
  });
});

describe('applyBoundaryConditions', () => {
  it('extracts the free rows and columns of K and F', () => {
    // 12 DOFs (two nodes). K[i][j] = 100*i + j and F[i] = i make every entry
    // identify its own position. Fixing node A leaves DOFs 6 .. 11, so
    // K_ff[a][b] = 100*(6+a) + (6+b) and F_f[a] = 6 + a.
    const K = new Matrix(Array.from({ length: 12 }, (_, i) =>
      Array.from({ length: 12 }, (_, j) => 100 * i + j)));
    const F = Matrix.columnVector(Array.from({ length: 12 }, (_, i) => i));
    const { K_ff, F_f, freeDofs, restrainedDofs } = applyBoundaryConditions(
      K, F, [fixed('A')], new Map([['A', 0], ['B', 1]]), 12,
    );
    expect(freeDofs).toEqual([6, 7, 8, 9, 10, 11]);
    expect(restrainedDofs.size).toBe(6);
    expect(K_ff.rows).toBe(6);
    expect(K_ff.columns).toBe(6);
    for (let a = 0; a < 6; a++) {
      expect(F_f.get(a, 0)).toBeCloseTo(6 + a, 12);
      for (let b = 0; b < 6; b++) {
        expect(K_ff.get(a, b)).toBeCloseTo(100 * (6 + a) + (6 + b), 12);
      }
    }
  });

  it('gives the closed-form cantilever tip deflection and rotation', () => {
    // W12x26 cantilever, A992, L = 100 in, P = 5 kips down at the tip.
    //   v     = -P L^3 / (3 E I) = -5 * 100^3 / (3 * 29000 * 204)  = -0.28172 in
    //   theta = -P L^2 / (2 E I) = -5 * 100^2 / (2 * 29000 * 204)  = -0.00422583 rad
    const model: StructuralModel = {
      nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 100, y: 0, z: 0 }],
      materials: [{ id: 'steel', name: 'A992', type: 'steel', E: 29000, G: 11200, density: 0 }],
      sections: [{ id: 'W12x26', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 }],
      elements: [{ id: 'E1', nodeI: 'A', nodeJ: 'B', materialId: 'steel', sectionId: 'W12x26', betaAngle: 0 }],
      supports: [fixed('A')],
      nodalLoads: [{ id: 'P', nodeId: 'B', fx: 0, fy: -5, fz: 0, mx: 0, my: 0, mz: 0 }],
      distributedLoads: [],
    };
    const { K, F, nodeIndexMap, totalDof } = assembleGlobalSystem(model);
    const { K_ff, F_f, freeDofs } = applyBoundaryConditions(
      K, F, model.supports, nodeIndexMap, totalDof,
    );
    expect(freeDofs).toEqual([6, 7, 8, 9, 10, 11]);

    const u = inverse(K_ff).mmul(F_f);
    const EI = 29000 * 204;
    expect(u.get(1, 0)).toBeCloseTo((-5 * 100 ** 3) / (3 * EI), 8); // uy at B
    expect(u.get(5, 0)).toBeCloseTo((-5 * 100 ** 2) / (2 * EI), 10); // rz at B
    // No load in the other directions, so nothing else moves.
    for (const d of [0, 2, 3, 4]) {
      expect(u.get(d, 0)).toBeCloseTo(0, 12);
    }
  });
});

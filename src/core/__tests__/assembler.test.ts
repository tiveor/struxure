import { describe, it, expect } from 'vitest';
import type { FrameElement, Material, Section, StructuralModel } from '../types';
import {
  assembleGlobalSystem,
  buildNodeIndexMap,
  elementDofIndices,
} from '../assembler';

/**
 * Validation tests for the global stiffness assembly.
 *
 * Direct stiffness method (Kassimali, Matrix Analysis of Structures, 2nd ed.,
 * Ch. 3 and 6): each element's global matrix T^T k T is added into K at the
 * DOFs of its two nodes, so a DOF shared by several elements carries the sum
 * of their contributions. Node index n owns global DOFs 6n .. 6n+5 in the
 * order [ux, uy, uz, rx, ry, rz].
 *
 * Expected values come from the closed-form element terms of Euler-Bernoulli
 * beam theory (EA/L, 12EI/L^3, 6EI/L^2, 4EI/L, 2EI/L, GJ/L), worked by hand
 * for the section and lengths below, never from the implementation.
 */

const E = 29000;
const G = 11200;
const A = 7.65;
const Ix = 204;
const Iy = 17.3;
const J = 0.3;

const A992: Material = { id: 'steel', name: 'A992', type: 'steel', E, G, density: 0 };
const W12x26: Section = { id: 'W12x26', name: 'W12x26', A, Ix, Iy, J };

const element = (id: string, nodeI: string, nodeJ: string): FrameElement => ({
  id, nodeI, nodeJ, materialId: 'steel', sectionId: 'W12x26', betaAngle: 0,
});

/** Global DOF index of `dof` (0..5) at node index `n`. */
const dof = (n: number, d: number) => 6 * n + d;
const UX = 0, UY = 1, UZ = 2, RX = 3, RY = 4, RZ = 5;

describe('buildNodeIndexMap and elementDofIndices', () => {
  it('numbers nodes in model order and gives each element its 12 DOFs', () => {
    const map = buildNodeIndexMap([
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 1, y: 0, z: 0 },
      { id: 'C', x: 2, y: 0, z: 0 },
    ]);
    expect(map.get('A')).toBe(0);
    expect(map.get('B')).toBe(1);
    expect(map.get('C')).toBe(2);
    // Element from C (index 2) to A (index 0): node I DOFs first.
    expect(elementDofIndices(element('E', 'C', 'A'), map)).toEqual(
      [12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5],
    );
  });
});

/**
 * Two collinear elements along global X, of different lengths so that the
 * shared-node terms do not cancel by symmetry:
 *
 *   A ---- E1 (L1 = 40) ---- B ---------- E2 (L2 = 80) ---------- C
 *   x = 0                    x = 40                               x = 120
 *
 * Both elements lie along +X, so T = I and the global matrix equals the
 * local one. At the shared node B the stiffness is the sum of the node-J
 * block of E1 and the node-I block of E2.
 */
describe('assembleGlobalSystem - two collinear elements', () => {
  const L1 = 40;
  const L2 = 80;
  const model: StructuralModel = {
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: L1, y: 0, z: 0 },
      { id: 'C', x: L1 + L2, y: 0, z: 0 },
    ],
    materials: [A992],
    sections: [W12x26],
    elements: [element('E1', 'A', 'B'), element('E2', 'B', 'C')],
    supports: [],
    nodalLoads: [{ id: 'P', nodeId: 'B', fx: 1, fy: -10, fz: 2, mx: 3, my: 4, mz: 5 }],
    distributedLoads: [{ id: 'w', elementId: 'E2', wx: 0, wy: -0.5, wz: 0 }],
  };
  const { K, F, totalDof } = assembleGlobalSystem(model);
  const A_ = 0, B = 1, C = 2;

  it('sizes the system at six DOFs per node', () => {
    expect(totalDof).toBe(18);
    expect(K.rows).toBe(18);
    expect(K.columns).toBe(18);
    expect(F.rows).toBe(18);
  });

  it('sums both element contributions on the diagonal of the shared node', () => {
    // EA/L1 + EA/L2           = 29000*7.65*(1/40 + 1/80)             = 8319.375
    // 12EIx/L1^3 + 12EIx/L2^3 = 12*29000*204*(1/40^3 + 1/80^3)       = 1247.90625
    // 12EIy/L1^3 + 12EIy/L2^3 = 12*29000*17.3*(1/40^3 + 1/80^3)      = 105.8273
    // GJ/L1 + GJ/L2           = 11200*0.3*(1/40 + 1/80)              = 126
    // 4EIy/L1 + 4EIy/L2       = 4*29000*17.3*(1/40 + 1/80)           = 75255
    // 4EIx/L1 + 4EIx/L2       = 4*29000*204*(1/40 + 1/80)            = 887400
    const sum = (f: (L: number) => number) => f(L1) + f(L2);
    expect(K.get(dof(B, UX), dof(B, UX))).toBeCloseTo(sum((L) => (E * A) / L), 8);
    expect(K.get(dof(B, UX), dof(B, UX))).toBeCloseTo(8319.375, 8);
    expect(K.get(dof(B, UY), dof(B, UY))).toBeCloseTo(sum((L) => (12 * E * Ix) / L ** 3), 8);
    expect(K.get(dof(B, UY), dof(B, UY))).toBeCloseTo(1247.90625, 8);
    expect(K.get(dof(B, UZ), dof(B, UZ))).toBeCloseTo(sum((L) => (12 * E * Iy) / L ** 3), 8);
    expect(K.get(dof(B, RX), dof(B, RX))).toBeCloseTo(126, 8);
    expect(K.get(dof(B, RY), dof(B, RY))).toBeCloseTo(75255, 6);
    expect(K.get(dof(B, RZ), dof(B, RZ))).toBeCloseTo(887400, 6);
  });

  it('nets the shear-moment coupling at the shared node', () => {
    // Node J of E1 contributes -6EI/L1^2 to (uy, rz); node I of E2
    // contributes +6EI/L2^2. With Ix:
    //   6*29000*204*(1/80^2 - 1/40^2) = 35496000*(-0.000468750) = -16638.75
    expect(K.get(dof(B, UY), dof(B, RZ))).toBeCloseTo(
      (6 * E * Ix) / L2 ** 2 - (6 * E * Ix) / L1 ** 2, 6,
    );
    expect(K.get(dof(B, UY), dof(B, RZ))).toBeCloseTo(-16638.75, 6);
  });

  it('keeps single-element terms at the end nodes', () => {
    // Only E1 reaches A and only E2 reaches C.
    expect(K.get(dof(A_, UX), dof(A_, UX))).toBeCloseTo((E * A) / L1, 8);
    expect(K.get(dof(C, RZ), dof(C, RZ))).toBeCloseTo((4 * E * Ix) / L2, 6);
    // Off-diagonal coupling between A and B comes from E1 alone.
    expect(K.get(dof(A_, UX), dof(B, UX))).toBeCloseTo(-(E * A) / L1, 8);
    expect(K.get(dof(A_, RZ), dof(B, RZ))).toBeCloseTo((2 * E * Ix) / L1, 6);
  });

  it('leaves no coupling between nodes that share no element', () => {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(K.get(dof(A_, i), dof(C, j))).toBeCloseTo(0, 12);
      }
    }
  });

  it('is symmetric', () => {
    for (let i = 0; i < 18; i++) {
      for (let j = i + 1; j < 18; j++) {
        expect(K.get(i, j), `(${i}, ${j})`).toBeCloseTo(K.get(j, i), 8);
      }
    }
  });

  it('places nodal loads and the equivalent loads of a uniform load in F', () => {
    // Nodal load at B goes straight to B's six DOFs.
    // Uniform wy = -0.5 kip/in on E2 (L2 = 80, along +X so local = global):
    //   force at each end   w L / 2   = -0.5*80/2       = -20 kips
    //   moment at node I    w L^2/12  = -0.5*6400/12    = -266.667 kip-in
    //   moment at node J   -w L^2/12  = +266.667 kip-in
    // (fixed-end actions of a uniformly loaded fixed-fixed beam,
    //  AISC Manual 15th ed., Table 3-23, case 15, with the sign reversed).
    expect(F.get(dof(B, UX), 0)).toBeCloseTo(1, 12);
    expect(F.get(dof(B, UY), 0)).toBeCloseTo(-10 - 20, 10);
    expect(F.get(dof(B, UZ), 0)).toBeCloseTo(2, 12);
    expect(F.get(dof(B, RX), 0)).toBeCloseTo(3, 12);
    expect(F.get(dof(B, RY), 0)).toBeCloseTo(4, 12);
    expect(F.get(dof(B, RZ), 0)).toBeCloseTo(5 - 266.6667, 3);
    expect(F.get(dof(C, UY), 0)).toBeCloseTo(-20, 10);
    expect(F.get(dof(C, RZ), 0)).toBeCloseTo(266.6667, 3);
    // Node A carries no load.
    for (let d = 0; d < 6; d++) {
      expect(F.get(dof(A_, d), 0)).toBeCloseTo(0, 12);
    }
  });
});

/**
 * A single element inclined in the XY plane, from (0, 0) to (60, 80):
 * L = 100, c = 0.6, s = 0.8. The plane-frame element in global coordinates
 * (Kassimali, 2nd ed., Ch. 6) has, at node I:
 *
 *   K(ux, ux) = EA/L c^2 + 12EI/L^3 s^2
 *   K(ux, uy) = (EA/L - 12EI/L^3) c s
 *   K(uy, uy) = EA/L s^2 + 12EI/L^3 c^2
 *   K(ux, rz) = -6EI/L^2 s
 *   K(uy, rz) =  6EI/L^2 c
 *   K(rz, rz) =  4EI/L
 *
 * with I = Ix, since local z stays on global +Z for this member.
 */
describe('assembleGlobalSystem - inclined element', () => {
  const L = 100;
  const c = 0.6;
  const s = 0.8;
  const model: StructuralModel = {
    nodes: [{ id: 'I', x: 0, y: 0, z: 0 }, { id: 'J', x: 60, y: 80, z: 0 }],
    materials: [A992],
    sections: [W12x26],
    elements: [element('E', 'I', 'J')],
    supports: [],
    nodalLoads: [],
    distributedLoads: [{ id: 'w', elementId: 'E', wx: 0, wy: -1, wz: 0 }],
  };
  const { K, F } = assembleGlobalSystem(model);

  const EA_L = (E * A) / L;              // 2218.5
  const K1 = (12 * E * Ix) / L ** 3;     // 70.992
  const K2 = (6 * E * Ix) / L ** 2;      // 3549.6
  const K3 = (4 * E * Ix) / L;           // 236640

  it('matches the closed-form plane-frame global stiffness at node I', () => {
    // EA/L c^2 + 12EI/L^3 s^2 = 2218.5*0.36 + 70.992*0.64 = 844.09488
    expect(K.get(UX, UX)).toBeCloseTo(EA_L * c * c + K1 * s * s, 8);
    expect(K.get(UX, UX)).toBeCloseTo(844.09488, 5);
    // (2218.5 - 70.992)*0.48 = 1030.80384
    expect(K.get(UX, UY)).toBeCloseTo((EA_L - K1) * c * s, 8);
    expect(K.get(UX, UY)).toBeCloseTo(1030.80384, 5);
    expect(K.get(UY, UY)).toBeCloseTo(EA_L * s * s + K1 * c * c, 8);
    expect(K.get(UX, RZ)).toBeCloseTo(-K2 * s, 8);
    expect(K.get(UY, RZ)).toBeCloseTo(K2 * c, 8);
    expect(K.get(RZ, RZ)).toBeCloseTo(K3, 6);
  });

  it('couples the two ends with the opposite translational block', () => {
    // K(I.ux, J.ux) = -(EA/L c^2 + 12EI/L^3 s^2), and so on.
    expect(K.get(dof(0, UX), dof(1, UX))).toBeCloseTo(-(EA_L * c * c + K1 * s * s), 8);
    expect(K.get(dof(0, UX), dof(1, UY))).toBeCloseTo(-(EA_L - K1) * c * s, 8);
    expect(K.get(dof(0, RZ), dof(1, RZ))).toBeCloseTo(K3 / 2, 6);
  });

  it('rotates the equivalent loads of a uniform load into global axes', () => {
    // wy = -1 kip/in in local y. Local y in global axes is (-s, c, 0)
    // = (-0.8, 0.6, 0). End force w L / 2 = -50 kips along local y:
    //   global (fx, fy) = -50 * (-0.8, 0.6) = (40, -30) at each end.
    // Local z is global Z, so the moments carry over unchanged:
    //   node I  w L^2 / 12 = -10000/12 = -833.333 kip-in, node J +833.333.
    expect(F.get(dof(0, UX), 0)).toBeCloseTo(40, 10);
    expect(F.get(dof(0, UY), 0)).toBeCloseTo(-30, 10);
    expect(F.get(dof(0, RZ), 0)).toBeCloseTo(-833.3333, 3);
    expect(F.get(dof(1, UX), 0)).toBeCloseTo(40, 10);
    expect(F.get(dof(1, UY), 0)).toBeCloseTo(-30, 10);
    expect(F.get(dof(1, RZ), 0)).toBeCloseTo(833.3333, 3);
  });
});

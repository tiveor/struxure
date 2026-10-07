import { describe, it, expect } from 'vitest';
import type { StructuralModel, Support } from '../types';
import { assembleGlobalSystem } from '../assembler';
import { getRestrainedDofs } from '../boundary-conditions';
import { postProcess } from '../post-processor';

/**
 * Validation tests for the post-processor in isolation.
 *
 * The displacement vector is NOT obtained from the solver. It is written from
 * the closed-form Euler-Bernoulli solution of each statically determinate
 * beam below, and handed to postProcess together with the assembled K. For a
 * prismatic beam under nodal loads the cubic element is exact at the nodes,
 * so K * u reproduces the applied loads at free DOFs and the support
 * reactions at restrained DOFs.
 *
 * Statics then fixes every expected value: reactions balance the applied
 * load (sum F = 0, sum M = 0) and member end forces follow from the free-body
 * diagram of each element.
 *
 * W12x26, A992: E = 29000 ksi, Ix = 204 in^4, EI = 5,916,000 kip-in^2.
 */

const E = 29000;
const Ix = 204;
const EI = E * Ix;

const fixed = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
});
const pin = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: false, rz: false,
});
const roller = (nodeId: string): Support => ({
  nodeId, dx: false, dy: true, dz: true, rx: true, ry: false, rz: false,
});

const base = {
  materials: [{ id: 'steel', name: 'A992', type: 'steel' as const, E, G: 11200, density: 0 }],
  sections: [{ id: 'W12x26', name: 'W12x26', A: 7.65, Ix, Iy: 17.3, J: 0.3 }],
};

const element = (id: string, nodeI: string, nodeJ: string) => ({
  id, nodeI, nodeJ, materialId: 'steel', sectionId: 'W12x26', betaAngle: 0,
});

/** Run postProcess on hand-written displacements, given per node as [ux..rz]. */
function run(model: StructuralModel, u: Record<string, number[]>) {
  const { K, F, nodeIndexMap, elementTransformations, elementLocalStiffness } =
    assembleGlobalSystem(model);
  const displacements = model.nodes.flatMap((n) => u[n.id] ?? [0, 0, 0, 0, 0, 0]);
  return postProcess(
    model,
    displacements,
    K,
    F,
    nodeIndexMap,
    elementTransformations,
    elementLocalStiffness,
    getRestrainedDofs(model.supports, nodeIndexMap),
  );
}

/**
 * Cantilever, fixed at A, L = 100 in, P = 5 kips down at the free end B.
 *
 *   v_B     = -P L^3 / (3EI) = -5*100^3/(3*5916000) = -0.281722 in
 *   theta_B = -P L^2 / (2EI) = -5*100^2/(2*5916000) = -0.00422583 rad
 *
 * Statics: R_Ay = +P = 5 kips, M_A = +P L = 500 kip-in (counter-clockwise),
 * so that sum Fy = 5 - 5 = 0 and sum Mz about A = 500 - 5*100 = 0.
 */
describe('postProcess - cantilever with a tip load', () => {
  const L = 100;
  const P = 5;
  const vB = (-P * L ** 3) / (3 * EI);
  const tB = (-P * L ** 2) / (2 * EI);
  const model: StructuralModel = {
    ...base,
    nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: L, y: 0, z: 0 }],
    elements: [element('E1', 'A', 'B')],
    supports: [fixed('A')],
    nodalLoads: [{ id: 'P', nodeId: 'B', fx: 0, fy: -P, fz: 0, mx: 0, my: 0, mz: 0 }],
    distributedLoads: [],
  };
  const results = run(model, { B: [0, vB, 0, 0, 0, tB] });

  it('returns the displacements per node unchanged', () => {
    const b = results.nodeDisplacements.get('B')!;
    expect(b[1]).toBeCloseTo(-0.281722, 6);
    expect(b[5]).toBeCloseTo(-0.00422583, 7);
    expect(results.nodeDisplacements.get('A')!.every((d) => d === 0)).toBe(true);
  });

  it('gives the statically determinate reactions at the fixed end', () => {
    const r = results.reactions.get('A')!;
    expect(r[1]).toBeCloseTo(P, 8);       // R_Ay = +5 kips
    expect(r[5]).toBeCloseTo(P * L, 6);   // M_A = +500 kip-in
    for (const d of [0, 2, 3, 4]) {
      expect(r[d]).toBeCloseTo(0, 8);
    }
  });

  it('satisfies global equilibrium, sum F = 0 and sum M = 0', () => {
    const r = results.reactions.get('A')!;
    // Sum Fy: R_Ay + (-P) = 0.
    expect(r[1] - P).toBeCloseTo(0, 8);
    // Sum Mz about A: M_A + x_B * (-P) = 0.
    expect(r[5] + L * -P).toBeCloseTo(0, 6);
  });

  it('gives the member end forces from the free-body diagram', () => {
    // Member end forces in local axes (the element lies along +X):
    //   at A: shear +P = 5, moment +P L = 500
    //   at B: shear -P = -5, moment 0 (free end)
    const { startForces, endForces } = results.elementForces.get('E1')!;
    expect(startForces[1]).toBeCloseTo(P, 8);
    expect(startForces[5]).toBeCloseTo(P * L, 6);
    expect(endForces[1]).toBeCloseTo(-P, 8);
    expect(endForces[5]).toBeCloseTo(0, 6);
    expect(startForces[0]).toBeCloseTo(0, 8);
    expect(endForces[0]).toBeCloseTo(0, 8);
  });

  it('subtracts a load applied directly at the support from its reaction', () => {
    // An extra 3 kips down at A goes straight into the support and does not
    // move the structure, so u is unchanged and R_Ay = 5 + 3 = 8 kips.
    const loaded: StructuralModel = {
      ...model,
      nodalLoads: [
        ...model.nodalLoads,
        { id: 'Q', nodeId: 'A', fx: 0, fy: -3, fz: 0, mx: 0, my: 0, mz: 0 },
      ],
    };
    const r = run(loaded, { B: [0, vB, 0, 0, 0, tB] }).reactions.get('A')!;
    expect(r[1]).toBeCloseTo(8, 8);
    expect(r[5]).toBeCloseTo(500, 6);
  });
});

/**
 * Simply supported beam, pin at A, roller at C, L = 120 in, P = 10 kips down
 * at midspan B (two elements of 60 in).
 *
 *   theta_A = -P L^2 / (16EI) = -10*14400/(16*5916000)  = -0.00152130 rad
 *   theta_C = +P L^2 / (16EI)
 *   v_B     = -P L^3 / (48EI) = -10*1728000/(48*5916000) = -0.0608519 in
 *   theta_B = 0 by symmetry
 *
 * Statics: R_A = R_C = P/2 = 5 kips, M_B = P L / 4 = 300 kip-in.
 */
describe('postProcess - simply supported beam with a midspan load', () => {
  const L = 120;
  const P = 10;
  const tA = (-P * L ** 2) / (16 * EI);
  const vB = (-P * L ** 3) / (48 * EI);
  const model: StructuralModel = {
    ...base,
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: L / 2, y: 0, z: 0 },
      { id: 'C', x: L, y: 0, z: 0 },
    ],
    elements: [element('E1', 'A', 'B'), element('E2', 'B', 'C')],
    supports: [pin('A'), roller('C')],
    nodalLoads: [{ id: 'P', nodeId: 'B', fx: 0, fy: -P, fz: 0, mx: 0, my: 0, mz: 0 }],
    distributedLoads: [],
  };
  const results = run(model, {
    A: [0, 0, 0, 0, 0, tA],
    B: [0, vB, 0, 0, 0, 0],
    C: [0, 0, 0, 0, 0, -tA],
  });

  it('gives R_A = R_C = P/2', () => {
    expect(results.reactions.get('A')![1]).toBeCloseTo(5, 8);
    expect(results.reactions.get('C')![1]).toBeCloseTo(5, 8);
  });

  it('satisfies global equilibrium, sum F = 0 and sum M = 0', () => {
    const rA = results.reactions.get('A')!;
    const rC = results.reactions.get('C')!;
    // Sum Fx and Fy, applied load included.
    expect(rA[0] + rC[0]).toBeCloseTo(0, 8);
    expect(rA[1] + rC[1] - P).toBeCloseTo(0, 8);
    // Sum Mz about A: x_C * R_Cy + x_B * (-P) + reaction moments (none).
    expect(L * rC[1] - (L / 2) * P + rA[5] + rC[5]).toBeCloseTo(0, 6);
  });

  it('reports no reaction on a DOF the support leaves free', () => {
    // The roller leaves ux and rz free, the pin leaves rz free.
    expect(results.reactions.get('C')![0]).toBe(0);
    expect(results.reactions.get('C')![5]).toBe(0);
    expect(results.reactions.get('A')![5]).toBe(0);
  });

  it('gives the midspan moment P L / 4 from both sides', () => {
    // E1 (A to B): shear +5 at A, -5 at B; moment 0 at A.
    //   Element equilibrium about A: M_A + M_B + V_B * 60 = 0
    //   -> M_B = 5 * 60 = 300 kip-in.
    // E2 (B to C): shear -5 at B, +5 at C; moment 0 at C.
    //   -> M_B = -(5 * 60) = -300 kip-in (same internal moment, opposite face).
    const e1 = results.elementForces.get('E1')!;
    const e2 = results.elementForces.get('E2')!;
    expect(e1.startForces[1]).toBeCloseTo(5, 8);
    expect(e1.startForces[5]).toBeCloseTo(0, 6);
    expect(e1.endForces[1]).toBeCloseTo(-5, 8);
    expect(e1.endForces[5]).toBeCloseTo(300, 6);
    expect(e2.startForces[1]).toBeCloseTo(-5, 8);
    expect(e2.startForces[5]).toBeCloseTo(-300, 6);
    expect(e2.endForces[1]).toBeCloseTo(5, 8);
    expect(e2.endForces[5]).toBeCloseTo(0, 6);
  });
});

/**
 * Simply supported beam, single element, L = 120 in, uniform load
 * w = 1 kip/in downward (wy = -1 in local y).
 *
 *   theta_A = -w L^3 / (24EI), theta_B = +w L^3 / (24EI)
 *
 * Statics: R_A = R_B = w L / 2 = 60 kips, end moments 0.
 */
describe('postProcess - simply supported beam with a uniform load', () => {
  const L = 120;
  const w = 1;
  const t = (w * L ** 3) / (24 * EI);
  const model: StructuralModel = {
    ...base,
    nodes: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: L, y: 0, z: 0 }],
    elements: [element('E1', 'A', 'B')],
    supports: [pin('A'), roller('B')],
    nodalLoads: [],
    distributedLoads: [{ id: 'w', elementId: 'E1', wx: 0, wy: -w, wz: 0 }],
  };
  const results = run(model, { A: [0, 0, 0, 0, 0, -t], B: [0, 0, 0, 0, 0, t] });

  it('gives end shears of w L / 2 and zero end moments', () => {
    // Free-body diagram of the beam: both ends push up with 60 kips and
    // carry no moment at the pin and the roller.
    const { startForces, endForces } = results.elementForces.get('E1')!;
    expect(startForces[1]).toBeCloseTo(60, 8);
    expect(endForces[1]).toBeCloseTo(60, 8);
    expect(startForces[5]).toBeCloseTo(0, 6);
    expect(endForces[5]).toBeCloseTo(0, 6);
  });

  // Regression: reactions used to subtract only the applied nodal loads from
  // K * u, so the equivalent nodal loads of a member load never reached the
  // supports and this beam reported R_A = R_B = 0 with sum Fy = -120.
  it('gives R_A = R_B = w L / 2 = 60 kips', () => {
    expect(results.reactions.get('A')![1]).toBeCloseTo(60, 8);
    expect(results.reactions.get('B')![1]).toBeCloseTo(60, 8);
    // Sum Fy: 60 + 60 - w L = 0.
    expect(results.reactions.get('A')![1] + results.reactions.get('B')![1] - w * L)
      .toBeCloseTo(0, 8);
  });
});

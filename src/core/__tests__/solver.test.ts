import { describe, it, expect } from 'vitest';
import { solveModel } from '../solver';
import type { StructuralModel } from '../types';

/**
 * Test 1: Simply supported beam with point load at midspan.
 *
 * Beam: L = 120 in, W12x26 steel section
 * Load: 10 kips downward at midspan
 *
 * Analytical solution (Euler-Bernoulli):
 *   δ_max = PL³ / (48EI) = 10 * 120³ / (48 * 29000 * 204) = 0.0608 in
 *   Reactions: R_A = R_B = P/2 = 5 kips (upward)
 *   Max moment at midspan: M = PL/4 = 10*120/4 = 300 kip-in
 */
describe('Simply Supported Beam - Point Load at Midspan', () => {
  const model: StructuralModel = {
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 60, y: 0, z: 0 },   // midspan
      { id: 'C', x: 120, y: 0, z: 0 },
    ],
    materials: [
      {
        id: 'steel',
        name: 'A992 Steel',
        type: 'steel',
        E: 29000,  // ksi
        G: 11200,  // ksi
        density: 0.000284, // lb/in³
        fy: 50,
      },
    ],
    sections: [
      {
        id: 'W12x26',
        name: 'W12x26',
        A: 7.65,     // in²
        Ix: 204,     // in⁴ (strong axis)
        Iy: 17.3,    // in⁴ (weak axis)
        J: 0.3,      // in⁴
      },
    ],
    elements: [
      { id: 'E1', nodeI: 'A', nodeJ: 'B', materialId: 'steel', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'E2', nodeI: 'B', nodeJ: 'C', materialId: 'steel', sectionId: 'W12x26', betaAngle: 0 },
    ],
    supports: [
      // Pin at A: restrain translations, free rotations
      { nodeId: 'A', dx: true, dy: true, dz: true, rx: true, ry: false, rz: false },
      // Roller at C: restrain dy and dz, free dx and rotations
      { nodeId: 'C', dx: false, dy: true, dz: true, rx: true, ry: false, rz: false },
    ],
    nodalLoads: [
      // 10 kips downward at midspan (B) — negative Y is downward
      { id: 'L1', nodeId: 'B', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 },
    ],
    distributedLoads: [],
  };

  it('should compute correct midspan deflection', () => {
    const results = solveModel(model);
    const nodeB = results.nodeDisplacements.get('B')!;
    // Analytical: δ = PL³/(48EI) = 10*120³/(48*29000*204) ≈ 0.0608 in
    const analytical_delta = (10 * Math.pow(120, 3)) / (48 * 29000 * 204);
    expect(nodeB[1]).toBeCloseTo(-analytical_delta, 3);
  });

  it('should compute correct reactions', () => {
    const results = solveModel(model);
    const rA = results.reactions.get('A')!;
    const rC = results.reactions.get('C')!;

    // Each reaction = P/2 = 5 kips upward
    expect(rA[1]).toBeCloseTo(5, 2);
    expect(rC[1]).toBeCloseTo(5, 2);
  });

  it('should compute correct internal forces (moment at midspan)', () => {
    const results = solveModel(model);

    // Element E1 end forces at node B: moment about z should be ~300 kip-in
    const e1Forces = results.elementForces.get('E1')!;
    // End moment at J (node B) of element E1: rz component (index 5)
    // M = PL/4 = 10*120/4 = 300 kip-in
    expect(Math.abs(e1Forces.endForces[5])).toBeCloseTo(300, 0);
  });
});

/**
 * Test 2: Cantilever beam with tip load.
 *
 * Fixed at A, free at B. L = 100 in. P = 5 kips downward at B.
 *
 * Analytical:
 *   δ_tip = PL³ / (3EI) = 5 * 100³ / (3 * 29000 * 204) = 0.2817 in
 *   M_fixed = P * L = 5 * 100 = 500 kip-in
 *   V = P = 5 kips
 */
describe('Cantilever Beam - Tip Load', () => {
  const model: StructuralModel = {
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 100, y: 0, z: 0 },
    ],
    materials: [
      {
        id: 'steel',
        name: 'A992 Steel',
        type: 'steel',
        E: 29000,
        G: 11200,
        density: 0.000284,
        fy: 50,
      },
    ],
    sections: [
      {
        id: 'W12x26',
        name: 'W12x26',
        A: 7.65,
        Ix: 204,
        Iy: 17.3,
        J: 0.3,
      },
    ],
    elements: [
      { id: 'E1', nodeI: 'A', nodeJ: 'B', materialId: 'steel', sectionId: 'W12x26', betaAngle: 0 },
    ],
    supports: [
      // Fixed support at A: all DOFs restrained
      { nodeId: 'A', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
    ],
    nodalLoads: [
      { id: 'L1', nodeId: 'B', fx: 0, fy: -5, fz: 0, mx: 0, my: 0, mz: 0 },
    ],
    distributedLoads: [],
  };

  it('should compute correct tip deflection', () => {
    const results = solveModel(model);
    const nodeB = results.nodeDisplacements.get('B')!;
    // δ = PL³/(3EI)
    const analytical = (5 * Math.pow(100, 3)) / (3 * 29000 * 204);
    expect(nodeB[1]).toBeCloseTo(-analytical, 3);
  });

  it('should compute correct fixed-end reaction', () => {
    const results = solveModel(model);
    const rA = results.reactions.get('A')!;

    // Reaction: Ry = 5 kips upward, Mz = 500 kip-in
    expect(rA[1]).toBeCloseTo(5, 2);
    expect(rA[5]).toBeCloseTo(500, 0);
  });
});

/**
 * Test 3: Simple 2D truss (3-bar).
 *
 *     C (0, 100)
 *    / \
 *   /   \
 *  A     B
 * (0,0) (100,0)
 *
 * Pin at A and B. Load 10 kips downward at C.
 * All members: A = 10 in², E = 29000 ksi.
 * Members: AC, BC (diagonal), and AB (horizontal bottom chord not needed for stability test).
 *
 * For a symmetric triangular truss:
 *   Reactions: RA_y = RB_y = 5 kips
 *   Axial force in AC and BC (by equilibrium): ~7.07 kips compression
 */
describe('Simple Triangular Truss', () => {
  const model: StructuralModel = {
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 100, y: 0, z: 0 },
      { id: 'C', x: 50, y: 100, z: 0 },
    ],
    materials: [
      {
        id: 'steel',
        name: 'Steel',
        type: 'steel',
        E: 29000,
        G: 11200,
        density: 0.000284,
        fy: 50,
      },
    ],
    sections: [
      {
        id: 'truss',
        name: 'Truss Section',
        A: 10,
        Ix: 100,  // large values to suppress bending
        Iy: 100,
        J: 50,
      },
    ],
    elements: [
      { id: 'AC', nodeI: 'A', nodeJ: 'C', materialId: 'steel', sectionId: 'truss', betaAngle: 0 },
      { id: 'BC', nodeI: 'B', nodeJ: 'C', materialId: 'steel', sectionId: 'truss', betaAngle: 0 },
    ],
    supports: [
      // Pin at A
      { nodeId: 'A', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
      // Pin at B (roller in x)
      { nodeId: 'B', dx: false, dy: true, dz: true, rx: true, ry: true, rz: true },
    ],
    nodalLoads: [
      { id: 'L1', nodeId: 'C', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 },
    ],
    distributedLoads: [],
  };

  it('should compute correct vertical reactions', () => {
    const results = solveModel(model);
    const rA = results.reactions.get('A')!;
    const rB = results.reactions.get('B')!;

    expect(rA[1]).toBeCloseTo(5, 1);
    expect(rB[1]).toBeCloseTo(5, 1);
  });

  it('should have equilibrium (sum of reactions equals applied load)', () => {
    const results = solveModel(model);
    const rA = results.reactions.get('A')!;
    const rB = results.reactions.get('B')!;

    // Sum of vertical reactions = applied load
    expect(rA[1] + rB[1]).toBeCloseTo(10, 2);
  });
});

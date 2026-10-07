import { describe, it, expect } from 'vitest';
import { solveModel } from '../../core/solver';
import type { StructuralModel, Support, NodalLoad, Material, Section } from '../../core/types';
import { runDesign } from '../design-runner';
import type { SteelDesignResult } from '../types';

/**
 * Validation of the axial sign convention between the analysis and the steel
 * design checks, end to end through solveModel + runDesign.
 *
 * Element end forces are the forces each node exerts on the element in local
 * axes, so a compressed member has startForces[0] > 0. runDesign once read
 * startForces[0] as tension-positive, which checked every compressed steel
 * member in tension and never checked buckling.
 *
 * Capacities are worked by hand below from AISC 360-16, not read back from
 * the implementation:
 *   - Tension yielding, Eq. D2-1: phi*Pn = 0.90 * Fy * Ag.
 *     W12x26, Fy = 50 ksi: 0.90 * 50 * 7.65 = 344.25 kips
 *     (AISC Manual 15th ed. Table 5-1 lists 344 kips).
 *   - Flexural buckling, Sec. E3 with K = 1.0:
 *       Fe  = pi^2 E / (KL/r)^2                          (Eq. E3-4)
 *       Fcr = 0.658^(Fy/Fe) * Fy   if KL/r <= 4.71 sqrt(E/Fy)  (Eq. E3-2)
 *       Fcr = 0.877 * Fe           otherwise              (Eq. E3-3)
 *       phi*Pn = 0.90 * Fcr * Ag                         (Eq. E3-1)
 *
 * W12x26 properties from AISC Manual Table 1-1: A = 7.65 in^2,
 * rx = 5.17 in, ry = 1.51 in. A992: E = 29000 ksi, Fy = 50 ksi.
 * Units: kips, inches.
 */

const A992: Material = {
  id: 'steel', name: 'A992', type: 'steel', E: 29000, G: 11200, density: 0, fy: 50, fu: 65,
};

const W12x26: Section = {
  id: 'W12x26', name: 'W12x26',
  A: 7.65, Ix: 204, Iy: 17.3, J: 0.3,
  Sx: 33.4, Sy: 5.48, Zx: 37.2, Zy: 8.17,
  rx: 5.17, ry: 1.51, d: 12.2, bf: 6.49, tf: 0.38, tw: 0.23,
};

const E = 29000;
const FY = 50;
const AG = 7.65;
const RY = 1.51; // weak axis governs: ry < rx

/** Tension yielding, AISC 360-16 Eq. D2-1. */
const PHI_PN_TENSION = 0.9 * FY * AG; // 344.25 kips

/** Flexural buckling about the weak axis, AISC 360-16 Sec. E3, K = 1. */
function phiPnCompression(L: number): number {
  const slenderness = L / RY;
  const Fe = (Math.PI * Math.PI * E) / (slenderness * slenderness);
  const Fcr = slenderness <= 4.71 * Math.sqrt(E / FY)
    ? Math.pow(0.658, FY / Fe) * FY
    : 0.877 * Fe;
  return 0.9 * Fcr * AG;
}

const fixed = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
});
// Pinned in the XY plane, with out-of-plane translation and torsion held.
const pin = (nodeId: string): Support => ({
  nodeId, dx: true, dy: true, dz: true, rx: true, ry: true, rz: false,
});

const element = (id: string, nodeI: string, nodeJ: string) => ({
  id, nodeI, nodeJ, materialId: 'steel', sectionId: 'W12x26', betaAngle: 0,
});

const nodal = (id: string, nodeId: string, f: Partial<Omit<NodalLoad, 'id' | 'nodeId'>>): NodalLoad => ({
  id, nodeId, fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0, ...f,
});

function steelResult(model: StructuralModel, elementId: string): SteelDesignResult {
  const results = runDesign(model, solveModel(model));
  const r = results.find((d) => d.elementId === elementId);
  if (!r || r.material !== 'steel') throw new Error(`no steel result for ${elementId}`);
  return r as SteelDesignResult;
}

function cantilever(fy: number): StructuralModel {
  return {
    nodes: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 0, y: 144, z: 0 },
    ],
    elements: [element('C1', 'A', 'B')],
    materials: [A992],
    sections: [W12x26],
    supports: [fixed('A')],
    nodalLoads: [nodal('P', 'B', { fy })],
    distributedLoads: [],
  };
}

describe('runDesign: steel axial sign convention', () => {
  // KL/r = 144 / 1.51 = 95.36 <= 4.71 sqrt(29000/50) = 113.4, so Eq. E3-2:
  // Fe = pi^2 * 29000 / 95.36^2 = 31.47 ksi
  // Fcr = 0.658^(50/31.47) * 50 = 25.71 ksi
  // phi*Pn = 0.90 * 25.71 * 7.65 = 177.0 kips
  const PHI_PN_144 = phiPnCompression(144);

  it('pins the hand-computed buckling capacity for L = 144 in', () => {
    expect(PHI_PN_144).toBeCloseTo(177.05, 1);
  });

  it('checks a compressed cantilever column for buckling, not tension', () => {
    // 100 kips down at the top of a 144 in column fixed at the base.
    const d = steelResult(cantilever(-100), 'C1').details;
    expect(d.compressionRatio).toBeCloseTo(100 / PHI_PN_144, 4); // 0.565
    expect(d.tensionRatio).toBeCloseTo(0, 10);
  });

  it('checks the same column in tension when the load is reversed', () => {
    const d = steelResult(cantilever(100), 'C1').details;
    expect(d.tensionRatio).toBeCloseTo(100 / PHI_PN_TENSION, 4); // 0.290
    expect(d.compressionRatio).toBeCloseTo(0, 10);
  });

  it('checks both tension and compression under an axial member load', () => {
    // Bar held axially at both ends (fixed at A; at B only rz is free so the
    // model has a free DOF to solve for), L = 144 in, uniform axial load wx = 1 kip/in
    // pointing from I to J. By symmetry of the axial compatibility condition
    // each support takes wx L / 2 = 72 kips, so the bar carries 72 kips
    // tension at I and 72 kips compression at J (N(x) = wx (L/2 - x)).
    const model: StructuralModel = {
      nodes: [
        { id: 'A', x: 0, y: 0, z: 0 },
        { id: 'B', x: 144, y: 0, z: 0 },
      ],
      elements: [element('E1', 'A', 'B')],
      materials: [A992],
      sections: [W12x26],
      supports: [fixed('A'), pin('B')],
      nodalLoads: [],
      distributedLoads: [{ id: 'w', elementId: 'E1', wx: 1, wy: 0, wz: 0 }],
    };
    const d = steelResult(model, 'E1').details;
    expect(d.tensionRatio).toBeCloseTo(72 / PHI_PN_TENSION, 4); // 0.209
    expect(d.compressionRatio).toBeCloseTo(72 / PHI_PN_144, 4); // 0.407
  });

  it('checks each member of a two-bar truss with its own axial sign', () => {
    // A (0,0) and C (288,0) pinned, apex B (144,144). A horizontal load
    // P = 50 kips in +X at B. Joint equilibrium at B with both bars at 45
    // degrees: AB carries P / (2 cos 45) = P / sqrt(2) = 35.36 kips tension
    // and CB the same in compression. The joint at B is rigid, so small
    // secondary moments develop; they shift the axial forces by well under
    // 1%, hence the looser tolerance.
    const P = 50;
    const N = P / Math.SQRT2;
    const L = 144 * Math.SQRT2; // 203.6 in
    // KL/r = 203.6 / 1.51 = 134.9 > 113.4, so Eq. E3-3:
    // Fe = pi^2 * 29000 / 134.9^2 = 15.73 ksi, Fcr = 0.877 * 15.73 = 13.80 ksi
    // phi*Pn = 0.90 * 13.80 * 7.65 = 95.0 kips
    const phiPnDiagonal = phiPnCompression(L);
    expect(phiPnDiagonal).toBeCloseTo(95.0, 0);

    const model: StructuralModel = {
      nodes: [
        { id: 'A', x: 0, y: 0, z: 0 },
        { id: 'B', x: 144, y: 144, z: 0 },
        { id: 'C', x: 288, y: 0, z: 0 },
      ],
      elements: [element('AB', 'A', 'B'), element('CB', 'C', 'B')],
      materials: [A992],
      sections: [W12x26],
      supports: [pin('A'), pin('C')],
      nodalLoads: [nodal('P', 'B', { fx: P })],
      distributedLoads: [],
    };
    const results = runDesign(model, solveModel(model));
    const ab = results.find((r) => r.elementId === 'AB') as SteelDesignResult;
    const cb = results.find((r) => r.elementId === 'CB') as SteelDesignResult;

    expect(ab.details.tensionRatio).toBeCloseTo(N / PHI_PN_TENSION, 2); // 0.103
    expect(ab.details.compressionRatio).toBeCloseTo(0, 10);
    expect(cb.details.compressionRatio).toBeCloseTo(N / phiPnDiagonal, 2); // 0.372
    expect(cb.details.tensionRatio).toBeCloseTo(0, 10);
  });
});

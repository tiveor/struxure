import { describe, it, expect } from 'vitest';
import { validateModelJson } from '../model-validator';
import { solveModel } from '../../core/solver';
import { runDesign } from '../../design/design-runner';
import type { StructuralModel } from '../../core/types';

/**
 * The same structure typed as a kN-m-MPa file and as a plain (untagged,
 * kip-in-ksi) file must analyse and design identically.
 *
 * The metric file uses round metric numbers. The imperial file is written
 * from them with the exact conversion factors below, independently of the
 * field table in model-units.ts, so a field mapped to the wrong quantity
 * shows up as a mismatch.
 */
const M = 1 / 0.0254; // m -> in
const KN = 1 / 4.4482216152605; // kN -> kip
const MPA = 1 / 6.894757293168361; // MPa -> ksi
const KNM = KN * M; // kN-m -> kip-in
const KN_PER_M = KN / M; // kN/m -> kip/in
const KG_M3 = 1 / (1000 * 0.45359237 / 0.0254 ** 3); // kg/m^3 -> kip/in^3

type Json = Record<string, unknown>;

function load(json: Json): StructuralModel {
  const result = validateModelJson(JSON.stringify(json));
  expect(result.errors).toEqual([]);
  return result.model!;
}

function expectSameResults(metric: StructuralModel, imperial: StructuralModel) {
  const a = solveModel(metric);
  const b = solveModel(imperial);
  expect(a.displacements.length).toBe(b.displacements.length);
  // Translations in inches, rotations in radians.
  a.displacements.forEach((d, i) => expect(d).toBeCloseTo(b.displacements[i], 8));

  const da = runDesign(metric, a);
  const db = runDesign(imperial, b);
  expect(da.length).toBe(metric.elements.length);
  expect(da.map((r) => r.elementId)).toEqual(db.map((r) => r.elementId));
  da.forEach((r, i) => {
    expect(r.ratio).toBeGreaterThan(0);
    expect(r.ratio).toBeCloseTo(db[i].ratio, 8);
    expect(r.status).toBe(db[i].status);
    expect(Boolean(r.indicative)).toBe(Boolean(db[i].indicative));
  });
  return da;
}

const fixed = { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true };

describe('metric and imperial entry give the same results', () => {
  it('steel portal frame', () => {
    const section = {
      A: 4.94e-3, Ix: 8.49e-5, Iy: 7.2e-6, J: 1.25e-7,
      Sx: 5.47e-4, Sy: 9.0e-5, Zx: 6.1e-4, Zy: 1.34e-4,
      rx: 0.131, ry: 0.0384, d: 0.31, bf: 0.165, tf: 0.00965, tw: 0.00584,
    };
    const metric: Json = {
      schemaVersion: 2,
      units: 'kN-m-MPa',
      nodes: [
        { id: 'N1', x: 0, y: 0, z: 0 },
        { id: 'N2', x: 0, y: 4, z: 0 },
        { id: 'N3', x: 6, y: 4, z: 0 },
        { id: 'N4', x: 6, y: 0, z: 0 },
      ],
      elements: [
        { id: 'C1', nodeI: 'N1', nodeJ: 'N2', materialId: 'S355', sectionId: 'I310', betaAngle: 0 },
        { id: 'B1', nodeI: 'N2', nodeJ: 'N3', materialId: 'S355', sectionId: 'I310', betaAngle: 0 },
        { id: 'C2', nodeI: 'N4', nodeJ: 'N3', materialId: 'S355', sectionId: 'I310', betaAngle: 0 },
      ],
      materials: [{ id: 'S355', name: 'S355', type: 'steel', E: 210000, G: 81000, density: 7850, fy: 355, fu: 490 }],
      sections: [{ id: 'I310', name: 'I310', ...section }],
      supports: [{ nodeId: 'N1', ...fixed }, { nodeId: 'N4', ...fixed }],
      nodalLoads: [
        { id: 'L1', nodeId: 'N2', fx: 20, fy: -50, fz: 0, mx: 0, my: 0, mz: 0 },
        { id: 'L2', nodeId: 'N3', fx: 0, fy: -50, fz: 0, mx: 0, my: 0, mz: 10 },
      ],
      distributedLoads: [{ id: 'D1', elementId: 'B1', wx: 0, wy: -15, wz: 0 }],
    };

    const imperial: Json = {
      ...metric,
      schemaVersion: undefined,
      units: undefined,
      nodes: (metric.nodes as Json[]).map((n) => ({
        ...n, x: (n.x as number) * M, y: (n.y as number) * M, z: (n.z as number) * M,
      })),
      materials: [{
        id: 'S355', name: 'S355', type: 'steel',
        E: 210000 * MPA, G: 81000 * MPA, density: 7850 * KG_M3, fy: 355 * MPA, fu: 490 * MPA,
      }],
      sections: [{
        id: 'I310', name: 'I310',
        A: section.A * M ** 2, Ix: section.Ix * M ** 4, Iy: section.Iy * M ** 4, J: section.J * M ** 4,
        Sx: section.Sx * M ** 3, Sy: section.Sy * M ** 3, Zx: section.Zx * M ** 3, Zy: section.Zy * M ** 3,
        rx: section.rx * M, ry: section.ry * M, d: section.d * M, bf: section.bf * M,
        tf: section.tf * M, tw: section.tw * M,
      }],
      nodalLoads: [
        { id: 'L1', nodeId: 'N2', fx: 20 * KN, fy: -50 * KN, fz: 0, mx: 0, my: 0, mz: 0 },
        { id: 'L2', nodeId: 'N3', fx: 0, fy: -50 * KN, fz: 0, mx: 0, my: 0, mz: 10 * KNM },
      ],
      distributedLoads: [{ id: 'D1', elementId: 'B1', wx: 0, wy: -15 * KN_PER_M, wz: 0 }],
    };

    const results = expectSameResults(load(metric), load(imperial));
    expect(results.every((r) => r.material === 'steel')).toBe(true);
  });

  it('reinforced concrete column', () => {
    const fc = 28;
    const Ec = Math.round(4700 * Math.sqrt(fc));
    const metric: Json = {
      units: 'kN-m-MPa',
      nodes: [{ id: 'N1', x: 0, y: 0, z: 0 }, { id: 'N2', x: 0, y: 3.5, z: 0 }],
      elements: [{ id: 'C1', nodeI: 'N1', nodeJ: 'N2', materialId: 'C28', sectionId: 'C400', betaAngle: 0 }],
      materials: [{ id: 'C28', name: "f'c 28 MPa", type: 'concrete', E: Ec, G: Ec / 2.4, density: 2400, fc }],
      sections: [{
        id: 'C400', name: '400x400', A: 0.16, Ix: 0.4 ** 4 / 12, Iy: 0.4 ** 4 / 12, J: 0.141 * 0.4 ** 4,
        b: 0.4, h: 0.4,
        reinforcement: { cover: 0.04, barSize: 8, barsAlongB: 3, barsAlongH: 3, tieSize: 3, fy: 420 },
      }],
      supports: [{ nodeId: 'N1', ...fixed }],
      nodalLoads: [{ id: 'L1', nodeId: 'N2', fx: 40, fy: -1200, fz: 0, mx: 0, my: 0, mz: 0 }],
      distributedLoads: [],
    };

    const imperial: Json = {
      ...metric,
      units: undefined,
      nodes: [{ id: 'N1', x: 0, y: 0, z: 0 }, { id: 'N2', x: 0, y: 3.5 * M, z: 0 }],
      materials: [{
        id: 'C28', name: "f'c 28 MPa", type: 'concrete',
        E: Ec * MPA, G: (Ec / 2.4) * MPA, density: 2400 * KG_M3, fc: fc * MPA,
      }],
      sections: [{
        id: 'C400', name: '400x400',
        A: 0.16 * M ** 2, Ix: (0.4 ** 4 / 12) * M ** 4, Iy: (0.4 ** 4 / 12) * M ** 4, J: 0.141 * 0.4 ** 4 * M ** 4,
        b: 0.4 * M, h: 0.4 * M,
        reinforcement: { cover: 0.04 * M, barSize: 8, barsAlongB: 3, barsAlongH: 3, tieSize: 3, fy: 420 * MPA },
      }],
      nodalLoads: [{ id: 'L1', nodeId: 'N2', fx: 40 * KN, fy: -1200 * KN, fz: 0, mx: 0, my: 0, mz: 0 }],
    };

    const [result] = expectSameResults(load(metric), load(imperial));
    expect(result.material).toBe('concrete');
    // The full strain-compatibility check ran, not the screening estimate.
    expect(result.indicative).toBeUndefined();
    expect(result.details).toHaveProperty('AsProvided');
  });
});

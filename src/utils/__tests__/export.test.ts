import { describe, it, expect } from 'vitest';
import { buildResultsCSV } from '../export';
import type { StructuralModel, AnalysisResults } from '../../core/types';

const model: StructuralModel = {
  nodes: [
    { id: 'n1', x: 0, y: 0, z: 0 },
    { id: 'n2', x: 120, y: 0, z: 0 },
  ],
  elements: [{ id: 'e1', nodeI: 'n1', nodeJ: 'n2', materialId: 'm', sectionId: 's', betaAngle: 0 }],
  materials: [],
  sections: [],
  supports: [{ nodeId: 'n1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true }],
  nodalLoads: [],
  distributedLoads: [],
};

const results: AnalysisResults = {
  displacements: [],
  nodeDisplacements: new Map([
    ['n1', [0, 0, 0, 0, 0, 0]],
    ['n2', [0, -0.5, 0, 0, 0, -0.01]],
  ]),
  reactions: new Map([['n1', [0, 10, 0, 0, 0, 1200]]]),
  elementForces: new Map([['e1', { startForces: [1, 10, 0, 0, 0, 1200], endForces: [-1, -10, 0, 0, 0, 0] }]]),
};

/** The CSV line that follows the given header line. */
function rowsAfter(csv: string, header: string): string[] {
  const lines = csv.split('\n');
  const i = lines.indexOf(header);
  expect(i, `missing header ${header}`).toBeGreaterThan(-1);
  return lines.slice(i + 1);
}

describe('buildResultsCSV', () => {
  it('labels every column with imperial units by default and keeps values as stored', () => {
    const csv = buildResultsCSV(results, model);
    expect(csv.split('\n')[0]).toBe('--- Units: Imperial (kip-in-ksi) ---');

    const disp = rowsAfter(csv, 'Node,ux (in),uy (in),uz (in),rx (rad),ry (rad),rz (rad)');
    expect(disp[1]).toBe('n2,0.000000e+0,-5.000000e-1,0.000000e+0,0.000000e+0,0.000000e+0,-1.000000e-2');

    const reactions = rowsAfter(csv, 'Node,Rx (kip),Ry (kip),Rz (kip),Mrx (kip-in),Mry (kip-in),Mrz (kip-in)');
    expect(reactions[0]).toBe('n1,0.0000,10.0000,0.0000,0.0000,0.0000,1200.0000');

    const forces = rowsAfter(csv, 'Element,Axial (kip),ShearY (kip),ShearZ (kip),Torsion (kip-in),MomentY (kip-in),MomentZ (kip-in)');
    expect(forces[0]).toBe('e1,1.0000,10.0000,0.0000,0.0000,0.0000,1200.0000');
  });

  it('converts to SI with unit headers and leaves rotations in radians', () => {
    const csv = buildResultsCSV(results, model, 'metric');
    expect(csv.split('\n')[0]).toBe('--- Units: SI Metric (kN-m-MPa) ---');

    const disp = rowsAfter(csv, 'Node,ux (mm),uy (mm),uz (mm),rx (rad),ry (rad),rz (rad)');
    expect(disp[1]).toBe('n2,0.000000e+0,-1.270000e+1,0.000000e+0,0.000000e+0,0.000000e+0,-1.000000e-2');

    const reactions = rowsAfter(csv, 'Node,Rx (kN),Ry (kN),Rz (kN),Mrx (kN-m),Mry (kN-m),Mrz (kN-m)');
    expect(reactions[0]).toBe('n1,0.0000,44.4822,0.0000,0.0000,0.0000,135.5818');

    const forces = rowsAfter(csv, 'Element,Axial (kN),ShearY (kN),ShearZ (kN),Torsion (kN-m),MomentY (kN-m),MomentZ (kN-m)');
    expect(forces[0]).toBe('e1,4.4482,44.4822,0.0000,0.0000,0.0000,135.5818');
  });

  it('writes plain ASCII so spreadsheets do not mangle the headers', () => {
    expect(buildResultsCSV(results, model, 'metric')).toMatch(/^[\x20-\x7E\n]*$/);
  });
});

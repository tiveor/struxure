import { describe, it, expect, vi } from 'vitest';
import {
  generateReport,
  formatDisplacement,
  formatForce,
  formatDCRatio,
  captureViewportScreenshot,
  designChecksTableBody,
  nodeTable,
  materialTable,
  sectionTable,
  nodalLoadTable,
  distributedLoadTable,
  displacementTable,
  reactionTable,
  elementForceHead,
  elementForceRows,
  reportUnit,
  reportUnitsLine,
  reportCodesLine,
} from '../report-generator';
import type { StructuralModel, AnalysisResults } from '../../core/types';
import type { DesignCheckResult } from '../../design/types';
import { INDICATIVE_MARK } from '../../design/indicative';

// ─── Helpers ─────────────────────────────────────────────────────────

function createTestModel(): StructuralModel {
  return {
    nodes: [
      { id: 'n1', x: 0, y: 0, z: 0 },
      { id: 'n2', x: 240, y: 0, z: 0 },
      { id: 'n3', x: 240, y: 144, z: 0 },
      { id: 'n4', x: 0, y: 144, z: 0 },
    ],
    elements: [
      { id: 'e1', nodeI: 'n1', nodeJ: 'n4', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'e2', nodeI: 'n4', nodeJ: 'n3', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
      { id: 'e3', nodeI: 'n2', nodeJ: 'n3', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 },
    ],
    materials: [
      { id: 'steel-A992', name: 'A992 Steel', type: 'steel', E: 29000, G: 11200, density: 0.000284, fy: 50, fu: 65 },
    ],
    sections: [
      { id: 'W12x26', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3, Sx: 33.4, Zx: 37.2 },
    ],
    supports: [
      { nodeId: 'n1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
      { nodeId: 'n2', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
    ],
    nodalLoads: [
      { id: 'l1', nodeId: 'n4', fx: 5, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
    ],
    distributedLoads: [
      { id: 'dl1', elementId: 'e2', wx: 0, wy: -0.1, wz: 0 },
    ],
  };
}

function createTestResults(): AnalysisResults {
  return {
    displacements: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.02, 0, 0, 0, -0.001, 0.05, -0.02, 0, 0, 0, 0.001],
    reactions: new Map([
      ['n1', [2.5, 12, 0, 0, 0, -500]],
      ['n2', [2.5, 12, 0, 0, 0, 500]],
    ]),
    elementForces: new Map([
      ['e1', { startForces: [-12, 2.5, 0, 0, 0, -500], endForces: [12, -2.5, 0, 0, 0, 140] }],
      ['e2', { startForces: [-2.5, 0, 0, 0, 0, 140], endForces: [2.5, 24, 0, 0, 0, -360] }],
      ['e3', { startForces: [-12, -2.5, 0, 0, 0, 500], endForces: [12, 2.5, 0, 0, 0, -360] }],
    ]),
    nodeDisplacements: new Map([
      ['n1', [0, 0, 0, 0, 0, 0]],
      ['n2', [0, 0, 0, 0, 0, 0]],
      ['n3', [0.05, 0.02, 0, 0, 0, -0.001]],
      ['n4', [0.05, -0.02, 0, 0, 0, 0.001]],
    ]),
  };
}

function createTestDesignResults(): DesignCheckResult[] {
  return [
    { elementId: 'e1', material: 'steel', ratio: 0.72, status: 'pass', details: { tensionRatio: 0.1, compressionRatio: 0.3, flexureRatio: 0.5, combinedRatio: 0.72, governingCheck: 4 } },
    { elementId: 'e2', material: 'steel', ratio: 0.45, status: 'pass', details: { tensionRatio: 0, compressionRatio: 0.1, flexureRatio: 0.35, combinedRatio: 0.45, governingCheck: 4 } },
    { elementId: 'e3', material: 'steel', ratio: 1.15, status: 'fail', details: { tensionRatio: 0.1, compressionRatio: 0.3, flexureRatio: 0.85, combinedRatio: 1.15, governingCheck: 4 } },
  ];
}

// ─── Number formatting tests ─────────────────────────────────────────

describe('formatDisplacement', () => {
  it('should format to 4 decimal places', () => {
    expect(formatDisplacement(0.123456789)).toBe('0.1235');
  });

  it('should handle zero', () => {
    expect(formatDisplacement(0)).toBe('0.0000');
  });

  it('should handle negative values', () => {
    expect(formatDisplacement(-0.00567)).toBe('-0.0057');
  });

  it('should handle large values', () => {
    expect(formatDisplacement(12.3456)).toBe('12.3456');
  });
});

describe('formatForce', () => {
  it('should format to 2 decimal places', () => {
    expect(formatForce(123.456)).toBe('123.46');
  });

  it('should handle zero', () => {
    expect(formatForce(0)).toBe('0.00');
  });

  it('should handle negative values', () => {
    expect(formatForce(-45.678)).toBe('-45.68');
  });
});

describe('formatDCRatio', () => {
  it('should format to 3 decimal places', () => {
    expect(formatDCRatio(0.856789)).toBe('0.857');
  });

  it('should handle exact values', () => {
    expect(formatDCRatio(1.0)).toBe('1.000');
  });

  it('should handle failing ratios', () => {
    expect(formatDCRatio(1.523)).toBe('1.523');
  });
});

// ─── PDF generation tests ────────────────────────────────────────────

describe('generateReport', () => {
  it('should generate a valid PDF blob', async () => {
    const model = createTestModel();
    const results = createTestResults();
    const design = createTestDesignResults();

    const blob = await generateReport(model, results, design);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('should generate report with custom options', async () => {
    const model = createTestModel();
    const results = createTestResults();

    const blob = await generateReport(model, results, [], {
      projectName: 'Test Project',
      engineer: 'John Doe',
      description: 'Portal frame analysis for industrial warehouse',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('should generate report without results (model only)', async () => {
    const model = createTestModel();

    const blob = await generateReport(model, null, []);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
  });

  it('should handle empty model', async () => {
    const emptyModel: StructuralModel = {
      nodes: [],
      elements: [],
      materials: [],
      sections: [],
      supports: [],
      nodalLoads: [],
      distributedLoads: [],
    };

    const blob = await generateReport(emptyModel, null, []);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle model with no loads', async () => {
    const model = createTestModel();
    model.nodalLoads = [];
    model.distributedLoads = [];

    const blob = await generateReport(model, createTestResults(), []);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('should handle results with no design checks', async () => {
    const model = createTestModel();
    const results = createTestResults();

    const blob = await generateReport(model, results, []);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('should handle missing screenshot gracefully', async () => {
    const model = createTestModel();
    const results = createTestResults();

    const blob = await generateReport(model, results, [], {
      screenshot: '',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('should include all sections for a full report', async () => {
    const model = createTestModel();
    const results = createTestResults();
    const design = createTestDesignResults();

    const blob = await generateReport(model, results, design, {
      projectName: 'Full Report Test',
      engineer: 'Test Engineer',
      description: 'Comprehensive test',
    });

    // A full report with all sections should be substantially larger
    expect(blob.size).toBeGreaterThan(5000);
  });
});

// ─── Viewport screenshot tests (mock document) ──────────────────────

describe('captureViewportScreenshot', () => {
  it('should return null when no canvas exists', () => {
    vi.stubGlobal('document', { querySelector: () => null });
    const result = captureViewportScreenshot();
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it('should return data URL from canvas', () => {
    const fakeCanvas = { toDataURL: () => 'data:image/png;base64,AAAA' };
    vi.stubGlobal('document', { querySelector: () => fakeCanvas });
    const result = captureViewportScreenshot();
    expect(result).toBe('data:image/png;base64,AAAA');
    vi.unstubAllGlobals();
  });

  it('should handle toDataURL failure gracefully', () => {
    const fakeCanvas = { toDataURL: () => { throw new Error('Security error'); } };
    vi.stubGlobal('document', { querySelector: () => fakeCanvas });
    const result = captureViewportScreenshot();
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });
});

// ─── Indicative design results ───────────────────────────────────────

describe('design checks table, indicative results', () => {
  const column: DesignCheckResult = {
    elementId: 'c1', material: 'concrete', ratio: 0.5234, status: 'pass',
    details: { flexureRatio: 0.5234, shearRatio: 0, AvRequired: 0, rhoAssumed: 0.01 },
    indicative: { reason: 'Assumed steel, screening only.' },
  };
  const beam: DesignCheckResult = {
    elementId: 'b1', material: 'concrete', ratio: 0.4, status: 'pass',
    details: { flexureRatio: 0.4, shearRatio: 0.2, AsRequired: 1.2, AvRequired: 0 },
  };

  it('marks only the indicative ratio', () => {
    const body = designChecksTableBody([column, beam]);
    expect(body[0][2]).toBe(`0.523 ${INDICATIVE_MARK}`);
    expect(body[1][2]).toBe('0.400');
  });

  it('prints the reason as a footnote under the table', async () => {
    const withColumn = await generateReport(createTestModel(), createTestResults(), [column, beam]);
    const beamsOnly = await generateReport(createTestModel(), createTestResults(), [beam]);
    expect(await withColumn.text()).toContain('Indicative: Assumed steel, screening only.');
    expect(await beamsOnly.text()).not.toContain('Indicative:');
  });
});

// ─── Units ───────────────────────────────────────────────────────────

describe('report tables in display units', () => {
  const model = createTestModel();
  const results = createTestResults();

  it('keeps imperial tables as before', () => {
    const nodes = nodeTable(model, 'imperial');
    expect(nodes.head[0]).toEqual(['Node ID', 'X (in)', 'Y (in)', 'Z (in)']);
    expect(nodes.body[1]).toEqual(['n2', '240.00', '0.00', '0.00']);
    expect(sectionTable(model, 'imperial').body[0]).toEqual(['W12x26', '7.65', '204.0', '17.3', '0.300', '33.4', '37.2']);
  });

  it('converts geometry to m and section properties to mm', () => {
    const nodes = nodeTable(model, 'metric');
    expect(nodes.head[0]).toEqual(['Node ID', 'X (m)', 'Y (m)', 'Z (m)']);
    expect(nodes.body[1]).toEqual(['n2', '6.096', '0.000', '0.000']);

    const sections = sectionTable(model, 'metric');
    expect(sections.head[0]).toEqual(['Section', 'A (mm²)', 'Ix (mm^4)', 'Iy (mm^4)', 'J (mm^4)', 'Sx (mm³)', 'Zx (mm³)']);
    expect(sections.body[0]).toEqual(['W12x26', '4935', '84.91e6', '7.201e6', '124869', '547328', '609599']);
  });

  it('converts materials to MPa', () => {
    const materials = materialTable(model, 'metric');
    expect(materials.head[0]).toEqual(['Name', 'Type', 'E (MPa)', 'G (MPa)', 'fy/fc (MPa)']);
    expect(materials.body[0]).toEqual(['A992 Steel', 'steel', '199948', '77221', '344.7']);
  });

  it('converts loads to kN, kN-m and kN/m', () => {
    const loaded = createTestModel();
    loaded.nodalLoads = [{ id: 'l1', nodeId: 'n4', fx: 5, fy: 0, fz: 0, mx: 0, my: 0, mz: 120 }];
    const nodal = nodalLoadTable(loaded, 'metric');
    expect(nodal.head[0]).toEqual(['Load ID', 'Node', 'Fx (kN)', 'Fy (kN)', 'Fz (kN)', 'Mx (kN-m)', 'My (kN-m)', 'Mz (kN-m)']);
    expect(nodal.body[0]).toEqual(['l1', 'n4', '22.24', '0.00', '0.00', '0.00', '0.00', '13.56']);

    const distributed = distributedLoadTable(model, 'metric');
    expect(distributed.head[0]).toEqual(['Load ID', 'Element', 'wx (kN/m)', 'wy (kN/m)', 'wz (kN/m)']);
    expect(distributed.body[0]).toEqual(['dl1', 'e2', '0.00', '-17.51', '0.00']);
  });

  it('converts results and leaves rotations in radians', () => {
    const disp = displacementTable(model, results, 'metric');
    expect(disp.head[0]).toEqual(['Node', 'ux (mm)', 'uy (mm)', 'uz (mm)', 'rx (rad)', 'ry (rad)', 'rz (rad)']);
    expect(disp.body[2]).toEqual(['n3', '1.270', '0.508', '0.000', '0.0000', '0.0000', '-0.0010']);

    const reactions = reactionTable(model, results, 'metric');
    expect(reactions.head[0]).toEqual(['Node', 'Rx (kN)', 'Ry (kN)', 'Rz (kN)', 'Mrx (kN-m)', 'Mry (kN-m)', 'Mrz (kN-m)']);
    expect(reactions.body[0]).toEqual(['n1', '11.12', '53.38', '0.00', '0.00', '0.00', '-56.49']);

    expect(elementForceHead('metric')[0]).toEqual(['Element', 'Axial (kN)', 'V2 (kN)', 'V3 (kN)', 'T (kN-m)', 'M2 (kN-m)', 'M3 (kN-m)']);
    expect(elementForceRows([-12, 2.5, 0, 0, 0, -500], 'metric')).toEqual(['-53.38', '11.12', '0.00', '0.00', '0.00', '-56.49']);
    expect(elementForceRows([-12, 2.5, 0, 0, 0, -500], 'imperial')).toEqual(['-12.00', '2.50', '0.00', '0.00', '0.00', '-500.00']);
  });

  it('avoids the superscript 4, which the PDF fonts cannot draw', () => {
    expect(reportUnit('momentOfInertia', 'imperial')).toBe('in^4');
    expect(reportUnit('area', 'imperial')).toBe('in²');
  });
});

describe('generateReport units', () => {
  // jsPDF writes the page size as the MediaBox in points, at full float precision.
  const LETTER = '/MediaBox [0 0 612. 792.]';
  const A4 = '/MediaBox [0 0 595.279';

  it('uses US Letter and an imperial units line by default', async () => {
    const text = await (await generateReport(createTestModel(), createTestResults(), [])).text();
    expect(text).toContain(LETTER);
    expect(text).toContain(reportUnitsLine('imperial'));
    expect(text).toContain(reportCodesLine('imperial').replace(/[()]/g, '\\$&'));
    expect(text).toContain('X \\(in\\)');
  });

  it('uses A4, SI headers and states the codes for metric', async () => {
    const blob = await generateReport(createTestModel(), createTestResults(), [], { units: 'metric' });
    const text = await blob.text();
    expect(text).toContain(A4);
    expect(text).not.toContain(LETTER);
    expect(text).toContain('X \\(m\\)');
    expect(text).toContain('Mrz \\(kN-m\\)');
    expect(text).toContain(reportUnitsLine('metric').replace(/[()]/g, '\\$&'));
    expect(text).toContain(reportCodesLine('metric').replace(/[()]/g, '\\$&'));
    expect(text).not.toContain('\\(kip\\)');
  });

  it('keeps the summary lines short enough not to be truncated', () => {
    for (const units of ['imperial', 'metric'] as const) {
      expect(reportUnitsLine(units).length).toBeLessThanOrEqual(70);
      expect(reportCodesLine(units).length).toBeLessThanOrEqual(70);
    }
  });
});

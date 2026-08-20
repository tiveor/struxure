import { describe, it, expect, vi } from 'vitest';
import {
  generateReport,
  formatDisplacement,
  formatForce,
  formatDCRatio,
  captureViewportScreenshot,
} from '../report-generator';
import type { StructuralModel, AnalysisResults } from '../../core/types';
import type { DesignCheckResult } from '../../design/types';

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

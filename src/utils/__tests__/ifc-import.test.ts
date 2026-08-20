import { describe, it, expect } from 'vitest';
import {
  getIfcUnitFactor,
  calculateIShapeProperties,
  calculateHSSProperties,
  calculatePipeProperties,
  ifcProfileToSection,
} from '../ifc-profiles';
import {
  ifcMaterialToMaterial,
  identityMat4,
  multiplyMat4,
  transformPoint,
  buildPlacementTransform,
  extractEndpointsFromItems,
  extractFromCoordList,
  parseTuple,
  extractDirectionRatios,
  strVal,
  numVal,
} from '../ifc-import';
import { exportResultsToIfc } from '../ifc-export';
import type { StructuralModel, AnalysisResults } from '../../core/types';

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
      { id: 'W12x26', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 },
    ],
    supports: [
      { nodeId: 'n1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
      { nodeId: 'n2', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
    ],
    nodalLoads: [
      { id: 'l1', nodeId: 'n4', fx: 5, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
    ],
    distributedLoads: [],
  };
}

function createTestResults(): AnalysisResults {
  return {
    displacements: [],
    reactions: new Map([
      ['n1', [2.5, 12, 0, 0, 0, -500]],
      ['n2', [2.5, 12, 0, 0, 0, 500]],
    ]),
    elementForces: new Map([
      ['e1', { startForces: [-12, 2.5, 0, 0, 0, -500], endForces: [12, -2.5, 0, 0, 0, 140] }],
      ['e2', { startForces: [-2.5, 0, 0, 0, 0, 140], endForces: [2.5, 0, 0, 0, 0, -360] }],
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

// ─── Unit conversion tests ───────────────────────────────────────────

describe('IFC unit conversion', () => {
  it('should detect and convert from millimeters', () => {
    const factor = getIfcUnitFactor('MILLIMETRE');
    expect(factor).toBeCloseTo(1 / 25.4, 4);
  });

  it('should detect and convert from meters', () => {
    const factor = getIfcUnitFactor('METRE');
    expect(factor).toBeCloseTo(39.3701, 2);
  });

  it('should handle feet', () => {
    const factor = getIfcUnitFactor('FOOT');
    expect(factor).toBeCloseTo(12, 0);
  });

  it('should handle inches', () => {
    const factor = getIfcUnitFactor('INCH');
    expect(factor).toBeCloseTo(1, 0);
  });

  it('should handle centimeters', () => {
    const factor = getIfcUnitFactor('CENTIMETRE');
    expect(factor).toBeCloseTo(1 / 2.54, 3);
  });

  it('should default to millimeters when undefined', () => {
    const factor = getIfcUnitFactor(undefined);
    expect(factor).toBeCloseTo(1 / 25.4, 4);
  });

  it('should default to millimeters for unknown unit', () => {
    const factor = getIfcUnitFactor('PARSEC');
    expect(factor).toBeCloseTo(1 / 25.4, 4);
  });

  it('should be case-insensitive', () => {
    expect(getIfcUnitFactor('millimetre')).toBeCloseTo(getIfcUnitFactor('MILLIMETRE'), 6);
    expect(getIfcUnitFactor('Metre')).toBeCloseTo(getIfcUnitFactor('METRE'), 6);
  });
});

// ─── I-shape properties tests ────────────────────────────────────────

describe('calculateIShapeProperties', () => {
  it('should calculate W12x26 properties from dimensions', () => {
    // W12x26: d=12.22, bf=6.49, tf=0.38, tw=0.23
    const props = calculateIShapeProperties(12.22, 6.49, 0.38, 0.23);

    expect(props.A).toBeCloseTo(7.65, 0);
    expect(props.Ix).toBeCloseTo(204, -1);
    expect(props.Ix).toBeGreaterThan(props.Iy);
    expect(props.Sx).toBeGreaterThan(0);
    expect(props.Zx).toBeGreaterThanOrEqual(props.Sx * 0.99);
  });

  it('should calculate area correctly', () => {
    // Simple case: d=10, bf=5, tf=0.5, tw=0.3
    const props = calculateIShapeProperties(10, 5, 0.5, 0.3);
    // 2 flanges: 2 * 5 * 0.5 = 5
    // Web: (10 - 2*0.5) * 0.3 = 2.7
    expect(props.A).toBeCloseTo(7.7, 1);
  });

  it('should have Ix > Iy for typical W-shapes', () => {
    const props = calculateIShapeProperties(14, 6.77, 0.42, 0.25);
    expect(props.Ix).toBeGreaterThan(props.Iy);
  });

  it('should calculate positive radii of gyration', () => {
    const props = calculateIShapeProperties(12, 6, 0.4, 0.25);
    expect(props.rx).toBeGreaterThan(0);
    expect(props.ry).toBeGreaterThan(0);
    expect(props.rx).toBeGreaterThan(props.ry);
  });
});

// ─── HSS properties tests ────────────────────────────────────────────

describe('calculateHSSProperties', () => {
  it('should calculate square HSS properties', () => {
    const props = calculateHSSProperties(8, 8, 0.375);

    expect(props.A).toBeGreaterThan(0);
    expect(props.Ix).toBeCloseTo(props.Iy, 4); // Square: Ix = Iy
    expect(props.Sx).toBeCloseTo(props.Sy, 4);
    expect(props.J).toBeGreaterThan(0);
  });

  it('should calculate rectangular HSS with Ix != Iy', () => {
    const props = calculateHSSProperties(6, 8, 0.375);

    expect(props.Ix).toBeGreaterThan(props.Iy); // H > B → Ix > Iy
  });

  it('should have Zx >= Sx', () => {
    const props = calculateHSSProperties(8, 8, 0.375);
    expect(props.Zx).toBeGreaterThanOrEqual(props.Sx * 0.99);
  });
});

// ─── Pipe properties tests ───────────────────────────────────────────

describe('calculatePipeProperties', () => {
  it('should calculate pipe with Ix = Iy (circular symmetry)', () => {
    const props = calculatePipeProperties(6.625, 0.28);

    expect(props.Ix).toBeCloseTo(props.Iy, 4);
    expect(props.Sx).toBeCloseTo(props.Sy, 4);
    expect(props.rx).toBeCloseTo(props.ry, 4);
  });

  it('should have J approximately 2*Ix for thin-walled pipe', () => {
    const props = calculatePipeProperties(6.625, 0.28);
    expect(props.J).toBeCloseTo(2 * props.Ix, 0);
  });

  it('should calculate positive area', () => {
    const props = calculatePipeProperties(4.5, 0.237);
    expect(props.A).toBeGreaterThan(0);
  });
});

// ─── Profile to Section conversion ───────────────────────────────────

describe('ifcProfileToSection', () => {
  it('should convert IfcIShapeProfileDef', () => {
    const section = ifcProfileToSection({
      type: 'IfcIShapeProfileDef',
      name: 'IPE300',
      OverallDepth: 300,    // mm
      OverallWidth: 150,    // mm
      WebThickness: 7.1,    // mm
      FlangeThickness: 10.7, // mm
    }, 'MILLIMETRE');

    expect(section.name).toBe('IPE300');
    expect(section.d).toBeCloseTo(300 / 25.4, 0);
    expect(section.A).toBeGreaterThan(0);
    expect(section.Ix).toBeGreaterThan(section.Iy!);
  });

  it('should convert IfcRectangleHollowProfileDef', () => {
    const section = ifcProfileToSection({
      type: 'IfcRectangleHollowProfileDef',
      name: 'HSS200x200',
      XDim: 200,
      YDim: 200,
      WallThickness: 10,
    }, 'MILLIMETRE');

    expect(section.A).toBeGreaterThan(0);
    expect(section.Ix).toBeCloseTo(section.Iy!, 0); // Square
  });

  it('should convert IfcCircleHollowProfileDef', () => {
    const section = ifcProfileToSection({
      type: 'IfcCircleHollowProfileDef',
      name: 'CHS168.3',
      Radius: 84.15, // mm (half of 168.3mm OD)
      WallThickness: 7.11,
    }, 'MILLIMETRE');

    expect(section.A).toBeGreaterThan(0);
    expect(section.Ix).toBeCloseTo(section.Iy!, 2); // Circular
  });

  it('should convert IfcRectangleProfileDef (solid)', () => {
    const section = ifcProfileToSection({
      type: 'IfcRectangleProfileDef',
      name: 'Rect300x500',
      XDim: 300,
      YDim: 500,
    }, 'MILLIMETRE');

    expect(section.A).toBeGreaterThan(0);
    expect(section.b).toBeCloseTo(300 / 25.4, 0);
    expect(section.h).toBeCloseTo(500 / 25.4, 0);
  });

  it('should return fallback section for unknown profile type', () => {
    const section = ifcProfileToSection({
      type: 'UnknownProfileType',
    }, 'MILLIMETRE');

    expect(section.A).toBe(10);
    expect(section.Ix).toBe(100);
  });

  it('should return fallback for zero dimensions', () => {
    const section = ifcProfileToSection({
      type: 'IfcIShapeProfileDef',
      OverallDepth: 0,
      OverallWidth: 0,
    }, 'MILLIMETRE');

    expect(section.A).toBe(10); // fallback
  });
});

// ─── Material conversion tests ───────────────────────────────────────

describe('ifcMaterialToMaterial', () => {
  it('should create steel material with defaults', () => {
    const mat = ifcMaterialToMaterial('S355', 'steel');

    expect(mat.id).toBe('S355');
    expect(mat.name).toBe('S355');
    expect(mat.type).toBe('steel');
    expect(mat.E).toBe(29000);
    expect(mat.fy).toBe(50);
  });

  it('should create concrete material', () => {
    const mat = ifcMaterialToMaterial('C30/37', 'concrete');

    expect(mat.type).toBe('concrete');
    expect(mat.E).toBe(3605);
    expect(mat.fc).toBe(4);
  });
});

// ─── IFC export tests ────────────────────────────────────────────────

describe('exportResultsToIfc', () => {
  it('should generate valid IFC buffer', async () => {
    const model = createTestModel();
    const results = createTestResults();

    const buffer = await exportResultsToIfc(model, results);

    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(100);

    // Check IFC header
    const text = new TextDecoder().decode(buffer.slice(0, 14));
    expect(text).toBe('ISO-10303-21;\n');
  });

  it('should include IFC4 schema', async () => {
    const buffer = await exportResultsToIfc(createTestModel(), null);
    const text = new TextDecoder().decode(buffer);
    expect(text).toContain("FILE_SCHEMA(('IFC4'))");
  });

  it('should include all nodes as IFCSTRUCTURALPOINTCONNECTION', async () => {
    const model = createTestModel();
    const buffer = await exportResultsToIfc(model, null);
    const text = new TextDecoder().decode(buffer);

    const matches = text.match(/IFCSTRUCTURALPOINTCONNECTION/g);
    expect(matches?.length).toBe(model.nodes.length);
  });

  it('should include all elements as IFCSTRUCTURALCURVEMEMBER', async () => {
    const model = createTestModel();
    const buffer = await exportResultsToIfc(model, null);
    const text = new TextDecoder().decode(buffer);

    const matches = text.match(/IFCSTRUCTURALCURVEMEMBER/g);
    expect(matches?.length).toBe(model.elements.length);
  });

  it('should include structural analysis model', async () => {
    const buffer = await exportResultsToIfc(createTestModel(), null);
    const text = new TextDecoder().decode(buffer);
    expect(text).toContain('IFCSTRUCTURALANALYSISMODEL');
  });

  it('should include boundary conditions for supported nodes', async () => {
    const model = createTestModel();
    const buffer = await exportResultsToIfc(model, null);
    const text = new TextDecoder().decode(buffer);
    expect(text).toContain('IFCBOUNDARYNODECONDITION');
  });

  it('should include reactions when results provided', async () => {
    const model = createTestModel();
    const results = createTestResults();
    const buffer = await exportResultsToIfc(model, results);
    const text = new TextDecoder().decode(buffer);
    expect(text).toContain('IFCSTRUCTURALPOINTREACTION');
    expect(text).toContain('IFCSTRUCTURALLOADSINGLEFORCE');
  });

  it('should not include reactions when no results', async () => {
    const buffer = await exportResultsToIfc(createTestModel(), null);
    const text = new TextDecoder().decode(buffer);
    expect(text).not.toContain('IFCSTRUCTURALPOINTREACTION');
  });

  it('should convert coordinates to millimeters', async () => {
    const model = createTestModel();
    // Node n2 is at x=240 inches = 6096 mm
    const buffer = await exportResultsToIfc(model, null);
    const text = new TextDecoder().decode(buffer);
    expect(text).toContain('6096.0000');
  });

  it('should handle empty model', async () => {
    const empty: StructuralModel = {
      nodes: [],
      elements: [],
      materials: [],
      sections: [],
      supports: [],
      nodalLoads: [],
      distributedLoads: [],
    };

    const buffer = await exportResultsToIfc(empty, null);
    expect(buffer.length).toBeGreaterThan(0);
    const text = new TextDecoder().decode(buffer);
    expect(text).toContain('ISO-10303-21;');
    expect(text).toContain('END-ISO-10303-21;');
  });

  it('should include project hierarchy', async () => {
    const buffer = await exportResultsToIfc(createTestModel(), null);
    const text = new TextDecoder().decode(buffer);
    expect(text).toContain('IFCPROJECT');
    expect(text).toContain('IFCSITE');
    expect(text).toContain('IFCBUILDING');
  });

  it('should include member connectivity relations', async () => {
    const model = createTestModel();
    const buffer = await exportResultsToIfc(model, null);
    const text = new TextDecoder().decode(buffer);
    // 3 elements * 2 connections each = 6
    const matches = text.match(/IFCRELCONNECTSSTRUCTURALMEMBER/g);
    expect(matches?.length).toBe(6);
  });
});

// ─── Mat4 transform tests ───────────────────────────────────────────

describe('identityMat4', () => {
  it('should return identity matrix', () => {
    const m = identityMat4();
    expect(m).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  });
});

describe('transformPoint', () => {
  it('should not change point with identity', () => {
    const m = identityMat4();
    const p = transformPoint(m, { x: 5, y: 10, z: 15 });
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(10);
    expect(p.z).toBeCloseTo(15);
  });

  it('should apply translation', () => {
    const m = identityMat4();
    m[9] = 100;  // tx
    m[10] = 200; // ty
    m[11] = 300; // tz
    const p = transformPoint(m, { x: 1, y: 2, z: 3 });
    expect(p.x).toBeCloseTo(101);
    expect(p.y).toBeCloseTo(202);
    expect(p.z).toBeCloseTo(303);
  });

  it('should apply 90° rotation around Z', () => {
    // Rotate 90° around Z: X→Y, Y→-X
    // [cos  -sin  0] = [0  -1  0]
    // [sin   cos  0]   [1   0  0]
    // [0     0    1]   [0   0  1]
    // Layout: [xx, xy, xz, yx, yy, yz, zx, zy, zz, tx, ty, tz]
    const m: typeof identityMat4 extends () => infer T ? T : never =
      [0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0];
    const p = transformPoint(m, { x: 10, y: 0, z: 5 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
    expect(p.z).toBeCloseTo(5);
  });
});

describe('multiplyMat4', () => {
  it('should return same matrix when multiplied by identity', () => {
    const id = identityMat4();
    const t = identityMat4();
    t[9] = 50; t[10] = 60; t[11] = 70;
    const result = multiplyMat4(id, t);
    expect(result[9]).toBeCloseTo(50);
    expect(result[10]).toBeCloseTo(60);
    expect(result[11]).toBeCloseTo(70);
  });

  it('should chain translations correctly', () => {
    const a = identityMat4();
    a[9] = 10; a[10] = 20; a[11] = 30;
    const b = identityMat4();
    b[9] = 1; b[10] = 2; b[11] = 3;
    const result = multiplyMat4(a, b);
    // Translation should add
    expect(result[9]).toBeCloseTo(11);
    expect(result[10]).toBeCloseTo(22);
    expect(result[11]).toBeCloseTo(33);
  });

  it('should apply parent rotation to child translation', () => {
    // Parent: 90° rotation around Z
    const parent: typeof identityMat4 extends () => infer T ? T : never =
      [0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0];
    // Child: translate (100, 0, 0)
    const child = identityMat4();
    child[9] = 100;
    const result = multiplyMat4(parent, child);
    // Parent rotates child's local X (100) to global Y
    const p = transformPoint(result, { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(100);
    expect(p.z).toBeCloseTo(0);
  });
});

// ─── buildPlacementTransform tests ──────────────────────────────────

describe('buildPlacementTransform', () => {
  it('should build identity for origin with no rotation', () => {
    const m = buildPlacementTransform({
      Location: { Coordinates: [0, 0, 0] },
    }, 1);
    const p = transformPoint(m, { x: 5, y: 10, z: 0 });
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(10);
  });

  it('should apply translation from Location', () => {
    const m = buildPlacementTransform({
      Location: { Coordinates: [1000, 2000, 3000] },
    }, 1 / 25.4); // mm → inches
    const p = transformPoint(m, { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(1000 / 25.4);
    expect(p.y).toBeCloseTo(2000 / 25.4);
    expect(p.z).toBeCloseTo(3000 / 25.4);
  });

  it('should handle custom Axis direction (column along Y)', () => {
    // Axis = (0, -1, 0) → local Z points downward in global Y
    const m = buildPlacementTransform({
      Location: { Coordinates: [0, 0, 5000] },
      Axis: { DirectionRatios: [0, -1, 0] },
      RefDirection: { DirectionRatios: [1, 0, 0] },
    }, 1 / 25.4);

    // A point at local (0, 0, 3000) should be at global (0, -3000, 5000) → in inches
    const p = transformPoint(m, { x: 0, y: 0, z: 3000 / 25.4 });
    expect(p.x).toBeCloseTo(0, 0);
    expect(p.y).toBeCloseTo(-3000 / 25.4, 0);
    expect(p.z).toBeCloseTo(5000 / 25.4, 0);
  });

  it('should handle value-wrapped coordinates', () => {
    const m = buildPlacementTransform({
      Location: { Coordinates: [{ value: 500 }, { value: 600 }, { value: 0 }] },
    }, 1);
    const p = transformPoint(m, { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(500);
    expect(p.y).toBeCloseTo(600);
  });
});

// ─── extractDirectionRatios tests ───────────────────────────────────

describe('extractDirectionRatios', () => {
  it('should extract plain number array', () => {
    expect(extractDirectionRatios([1, 0, 0])).toEqual([1, 0, 0]);
  });

  it('should extract value-wrapped array', () => {
    expect(extractDirectionRatios([{ value: 0 }, { value: 0 }, { value: 1 }])).toEqual([0, 0, 1]);
  });

  it('should return null for non-array', () => {
    expect(extractDirectionRatios('not-an-array')).toBeNull();
    expect(extractDirectionRatios(undefined)).toBeNull();
    expect(extractDirectionRatios(null)).toBeNull();
  });

  it('should return null for too-short array', () => {
    expect(extractDirectionRatios([1])).toBeNull();
  });
});

// ─── parseTuple tests ───────────────────────────────────────────────

describe('parseTuple', () => {
  it('should parse plain number tuple', () => {
    const p = parseTuple([100, 200, 300], 1);
    expect(p).toEqual({ x: 100, y: 200, z: 300 });
  });

  it('should apply unit factor', () => {
    const p = parseTuple([25.4, 50.8, 0], 1 / 25.4);
    expect(p!.x).toBeCloseTo(1);
    expect(p!.y).toBeCloseTo(2);
    expect(p!.z).toBeCloseTo(0);
  });

  it('should parse value-wrapped tuple', () => {
    const p = parseTuple([{ value: 10 }, { value: 20 }, { value: 30 }], 1);
    expect(p).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('should handle 2D tuple (z defaults to 0)', () => {
    const p = parseTuple([5, 10], 1);
    expect(p).toEqual({ x: 5, y: 10, z: 0 });
  });

  it('should return null for too-short tuple', () => {
    expect(parseTuple([5], 1)).toBeNull();
    expect(parseTuple([], 1)).toBeNull();
  });

  it('should return null for non-array', () => {
    expect(parseTuple('not-a-tuple', 1)).toBeNull();
    expect(parseTuple(null, 1)).toBeNull();
  });
});

// ─── extractFromCoordList tests ─────────────────────────────────────

describe('extractFromCoordList', () => {
  it('should extract start/end from IfcCartesianPointList3D CoordList', () => {
    const coordList = [
      [0, 0, 0],
      [3000, 0, 0],
    ];
    const result = extractFromCoordList(coordList, 1 / 25.4);
    expect(result).not.toBeNull();
    expect(result!.start.x).toBeCloseTo(0);
    expect(result!.end.x).toBeCloseTo(3000 / 25.4);
  });

  it('should use first and last points (skip intermediate)', () => {
    const coordList = [
      [0, 0, 0],
      [1000, 500, 0],
      [2000, 0, 0],
    ];
    const result = extractFromCoordList(coordList, 1);
    expect(result!.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(result!.end).toEqual({ x: 2000, y: 0, z: 0 });
  });

  it('should handle value-wrapped coordinates', () => {
    const coordList = [
      [{ value: 66.5 }, { value: 0 }, { value: 3076 }],
      [{ value: 66.5 }, { value: 3000 }, { value: 76 }],
    ];
    const result = extractFromCoordList(coordList, 1);
    expect(result).not.toBeNull();
    expect(result!.start.z).toBeCloseTo(3076);
    expect(result!.end.y).toBeCloseTo(3000);
  });

  it('should return null for single point', () => {
    expect(extractFromCoordList([[0, 0, 0]], 1)).toBeNull();
  });

  it('should return null for empty list', () => {
    expect(extractFromCoordList([], 1)).toBeNull();
    expect(extractFromCoordList(null, 1)).toBeNull();
  });
});

// ─── extractEndpointsFromItems tests ────────────────────────────────

describe('extractEndpointsFromItems', () => {
  it('should extract from IfcPolyline (Points array)', () => {
    const shapeRep = {
      Items: [
        {
          Points: [
            { Coordinates: [0, 0, 0] },
            { Coordinates: [0, 9770, 0] },
          ],
        },
      ],
    };
    const result = extractEndpointsFromItems(shapeRep, 1 / 25.4);
    expect(result).not.toBeNull();
    expect(result!.start.x).toBeCloseTo(0);
    expect(result!.end.y).toBeCloseTo(9770 / 25.4);
  });

  it('should extract from IfcIndexedPolyCurve (CoordList)', () => {
    // Simulates: IfcIndexedPolyCurve.Points = IfcCartesianPointList3D with CoordList
    const shapeRep = {
      Items: [
        {
          Points: {
            CoordList: [
              [66.5, 0, 3076],
              [66.5, 3000, 76],
            ],
          },
        },
      ],
    };
    const result = extractEndpointsFromItems(shapeRep, 1);
    expect(result).not.toBeNull();
    expect(result!.start.z).toBeCloseTo(3076);
    expect(result!.end.y).toBeCloseTo(3000);
  });

  it('should return null for empty Items', () => {
    expect(extractEndpointsFromItems({ Items: [] }, 1)).toBeNull();
    expect(extractEndpointsFromItems({}, 1)).toBeNull();
  });

  it('should prefer IfcPolyline over IfcIndexedPolyCurve', () => {
    const shapeRep = {
      Items: [
        {
          // This looks like IfcPolyline because Points is an array
          Points: [
            { Coordinates: [0, 0, 0] },
            { Coordinates: [100, 0, 0] },
          ],
        },
      ],
    };
    const result = extractEndpointsFromItems(shapeRep, 1);
    expect(result!.end.x).toBeCloseTo(100);
  });
});

describe('strVal', () => {
  it('unwraps an IFC wrapped string value', () => {
    expect(strVal({ value: 'W12X26' })).toBe('W12X26');
  });

  it('passes a bare string through', () => {
    expect(strVal('HSS6X6X1/4')).toBe('HSS6X6X1/4');
  });

  it('returns undefined for a wrapped non-string', () => {
    expect(strVal({ value: 42 })).toBeUndefined();
  });

  it('returns undefined for null, undefined and empty strings', () => {
    expect(strVal(null)).toBeUndefined();
    expect(strVal(undefined)).toBeUndefined();
    expect(strVal('')).toBeUndefined();
  });
});

describe('numVal', () => {
  it('unwraps an IFC wrapped number value', () => {
    expect(numVal({ value: 12.5 })).toBe(12.5);
  });

  it('passes a bare number through', () => {
    expect(numVal(42)).toBe(42);
  });

  it('returns undefined for a wrapped non-number', () => {
    expect(numVal({ value: 'not a number' })).toBeUndefined();
  });

  it('returns undefined for null and undefined', () => {
    expect(numVal(null)).toBeUndefined();
    expect(numVal(undefined)).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { convertEntities } from '../dxf-import';

// Helper: create LINE entities in dxf-parser format (vertices array)
function makeLine(start: { x: number; y: number; z?: number }, end: { x: number; y: number; z?: number }, layer = '0') {
  return {
    type: 'LINE',
    layer,
    vertices: [
      { x: start.x, y: start.y, z: start.z ?? 0 },
      { x: end.x, y: end.y, z: end.z ?? 0 },
    ],
  };
}

// Helper: create LWPOLYLINE entity
function makeLwPolyline(vertices: Array<{ x: number; y: number; z?: number }>, layer = '0') {
  return {
    type: 'LWPOLYLINE',
    layer,
    vertices: vertices.map((v) => ({ x: v.x, y: v.y, z: v.z ?? 0 })),
  };
}

describe('DXF LINE entity', () => {
  it('should create 2 nodes and 1 element from a single LINE', () => {
    const entities = [makeLine({ x: 0, y: 0, z: 0 }, { x: 120, y: 0, z: 0 })];
    const result = convertEntities(entities);

    expect(result.nodes).toHaveLength(2);
    expect(result.elements).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(result.nodes[1]).toMatchObject({ x: 120, y: 0, z: 0 });
  });

  it('should connect element to correct node IDs', () => {
    const entities = [makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })];
    const result = convertEntities(entities);

    expect(result.elements[0].nodeI).toBe('n1');
    expect(result.elements[0].nodeJ).toBe('n2');
  });

  it('should assign default material and section', () => {
    const entities = [makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 })];
    const result = convertEntities(entities);

    expect(result.elements[0].materialId).toBe('steel-A992');
    expect(result.elements[0].sectionId).toBe('W12x26');
  });
});

describe('node merging', () => {
  it('should merge coincident nodes within tolerance', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
      makeLine({ x: 100.05, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }),
    ];
    const result = convertEntities(entities, { tolerance: 0.1 });

    expect(result.nodes).toHaveLength(3);
    expect(result.elements).toHaveLength(2);
    expect(result.stats.duplicatesMerged).toBe(1);
  });

  it('should NOT merge nodes beyond tolerance', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
      makeLine({ x: 101, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }),
    ];
    const result = convertEntities(entities, { tolerance: 0.1 });

    expect(result.nodes).toHaveLength(4);
    expect(result.elements).toHaveLength(2);
  });

  it('should handle 3D tolerance correctly', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
      makeLine({ x: 100, y: 0.05, z: 0.05 }, { x: 200, y: 0, z: 0 }),
    ];
    // sqrt(0.05^2 + 0.05^2) ≈ 0.071, within default tolerance 0.1
    const result = convertEntities(entities);

    expect(result.nodes).toHaveLength(3);
    expect(result.stats.duplicatesMerged).toBe(1);
  });
});

describe('DXF LWPOLYLINE entity', () => {
  it('should create N elements from N+1 vertex polyline', () => {
    const entities = [
      makeLwPolyline([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ]),
    ];
    const result = convertEntities(entities);

    expect(result.nodes).toHaveLength(4);
    expect(result.elements).toHaveLength(3);
  });

  it('should handle 2-vertex polyline as single element', () => {
    const entities = [
      makeLwPolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }]),
    ];
    const result = convertEntities(entities);

    expect(result.nodes).toHaveLength(2);
    expect(result.elements).toHaveLength(1);
  });
});

describe('unit conversion', () => {
  it('should convert meters to inches', () => {
    const entities = [makeLine({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })];
    const result = convertEntities(entities, { units: 'm' });

    expect(result.nodes[1].x).toBeCloseTo(39.3701, 1);
  });

  it('should convert feet to inches', () => {
    const entities = [makeLine({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 })];
    const result = convertEntities(entities, { units: 'feet' });

    expect(result.nodes[1].x).toBeCloseTo(120);
  });

  it('should convert mm to inches', () => {
    const entities = [makeLine({ x: 0, y: 0, z: 0 }, { x: 25.4, y: 0, z: 0 })];
    const result = convertEntities(entities, { units: 'mm' });

    expect(result.nodes[1].x).toBeCloseTo(1, 2);
  });

  it('should leave inches as-is', () => {
    const entities = [makeLine({ x: 0, y: 0, z: 0 }, { x: 120, y: 0, z: 0 })];
    const result = convertEntities(entities, { units: 'inches' });

    expect(result.nodes[1].x).toBe(120);
  });
});

describe('layer filtering', () => {
  it('should only import entities from selected layers', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 'STRUCTURE'),
      makeLine({ x: 0, y: 50, z: 0 }, { x: 100, y: 50, z: 0 }, 'DIMENSIONS'),
    ];
    const result = convertEntities(entities, { layers: ['STRUCTURE'] });

    expect(result.elements).toHaveLength(1);
    expect(result.nodes).toHaveLength(2);
  });

  it('should import all layers when no filter specified', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 'STRUCTURE'),
      makeLine({ x: 0, y: 50, z: 0 }, { x: 100, y: 50, z: 0 }, 'DIMENSIONS'),
    ];
    const result = convertEntities(entities);

    expect(result.elements).toHaveLength(2);
  });

  it('should report all layers in result', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, 'BEAMS'),
      makeLine({ x: 0, y: 50, z: 0 }, { x: 100, y: 50, z: 0 }, 'COLUMNS'),
    ];
    const result = convertEntities(entities);

    expect(result.layers).toContain('BEAMS');
    expect(result.layers).toContain('COLUMNS');
  });
});

describe('unsupported entities', () => {
  it('should warn about CIRCLE entities', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
      { type: 'CIRCLE', layer: '0', center: { x: 50, y: 50, z: 0 }, radius: 10 },
    ];
    const result = convertEntities(entities);

    expect(result.elements).toHaveLength(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('CIRCLE')]),
    );
  });

  it('should warn about ARC entities', () => {
    const entities = [{ type: 'ARC', layer: '0' }];
    const result = convertEntities(entities);

    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('ARC')]),
    );
  });
});

describe('import stats', () => {
  it('should report correct statistics', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }),
      makeLine({ x: 100, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }),
    ];
    const result = convertEntities(entities);

    expect(result.stats.linesFound).toBe(2);
    expect(result.stats.nodesCreated).toBe(3);
    expect(result.stats.elementsCreated).toBe(2);
  });

  it('should count polyline segments as lines', () => {
    const entities = [
      makeLwPolyline([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
      ]),
    ];
    const result = convertEntities(entities);

    expect(result.stats.linesFound).toBe(2);
  });
});

describe('portal frame from DXF', () => {
  it('should correctly import a 2D portal frame', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 0, y: 144, z: 0 }),     // Left column
      makeLine({ x: 0, y: 144, z: 0 }, { x: 240, y: 144, z: 0 }),  // Beam
      makeLine({ x: 240, y: 0, z: 0 }, { x: 240, y: 144, z: 0 }),  // Right column
    ];
    const result = convertEntities(entities);

    expect(result.nodes).toHaveLength(4);
    expect(result.elements).toHaveLength(3);
  });
});

describe('3D structure', () => {
  it('should preserve z coordinates', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 120 }),
    ];
    const result = convertEntities(entities);

    expect(result.nodes[0].z).toBe(0);
    expect(result.nodes[1].z).toBe(120);
  });

  it('should handle a 3D space frame', () => {
    const entities = [
      makeLine({ x: 0, y: 0, z: 0 }, { x: 120, y: 0, z: 0 }),
      makeLine({ x: 0, y: 0, z: 0 }, { x: 0, y: 120, z: 0 }),
      makeLine({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 120 }),
    ];
    const result = convertEntities(entities);

    expect(result.nodes).toHaveLength(4); // shared origin + 3 endpoints
    expect(result.elements).toHaveLength(3);
  });
});

describe('edge cases', () => {
  it('should handle empty entity list', () => {
    const result = convertEntities([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.elements).toHaveLength(0);
    expect(result.stats.linesFound).toBe(0);
  });

  it('should skip zero-length lines', () => {
    const entities = [
      makeLine({ x: 50, y: 50, z: 0 }, { x: 50, y: 50, z: 0 }),
    ];
    const result = convertEntities(entities);

    // Both endpoints map to same node, so no element created
    expect(result.elements).toHaveLength(0);
  });

  it('should handle missing z coordinate', () => {
    const entities = [
      { type: 'LINE', layer: '0', vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    ];
    const result = convertEntities(entities);

    expect(result.nodes[0].z).toBe(0);
    expect(result.nodes[1].z).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { validateModelJson, validateModelShape } from '../model-validator';
import { extractAndValidateModel } from '../ai-model-validator';
import type { StructuralModel } from '../../core/types';

const validModel: StructuralModel = {
  nodes: [
    { id: 'N1', x: 0, y: 0, z: 0 },
    { id: 'N2', x: 120, y: 0, z: 0 },
  ],
  elements: [
    { id: 'E1', nodeI: 'N1', nodeJ: 'N2', materialId: 'M1', sectionId: 'S1', betaAngle: 0 },
  ],
  materials: [
    { id: 'M1', name: 'A992', type: 'steel', E: 29000, G: 11200, density: 0.000284, fy: 50 },
  ],
  sections: [
    { id: 'S1', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 },
  ],
  supports: [
    { nodeId: 'N1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
  ],
  nodalLoads: [
    { id: 'L1', nodeId: 'N2', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 },
  ],
  distributedLoads: [],
};

function jsonOf(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...validModel, ...overrides });
}

describe('validateModelJson', () => {
  it('accepts a valid exported model file', () => {
    const result = validateModelJson(JSON.stringify(validModel));
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.model).toEqual(validModel);
  });

  it('rejects text that is not JSON', () => {
    const result = validateModelJson('not json {');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/^Invalid JSON/);
  });

  it.each([['[1,2,3]'], ['42'], ['"hello"'], ['null']])(
    'rejects JSON that is not a model object: %s',
    (text) => {
      const result = validateModelJson(text);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe('File does not contain a model object');
    },
  );

  it('rejects a model missing required arrays', () => {
    const result = validateModelJson(JSON.stringify({ nodes: [] }));
    expect(result.success).toBe(false);
    for (const key of ['elements', 'materials', 'sections', 'supports', 'nodalLoads']) {
      expect(result.errors).toContain(`Missing or invalid "${key}" array`);
    }
  });

  it('defaults a missing distributedLoads array to empty', () => {
    const { distributedLoads: _omit, ...rest } = validModel;
    const result = validateModelJson(JSON.stringify(rest));
    expect(result.success).toBe(true);
    expect(result.model?.distributedLoads).toEqual([]);
  });

  it('rejects a node with a non-numeric coordinate', () => {
    const result = validateModelJson(
      jsonOf({ nodes: [{ id: 'N1', x: 'abc', y: 0, z: 0 }] }),
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('"x" must be a number');
  });

  it('rejects a material with an unknown type', () => {
    const result = validateModelJson(
      jsonOf({ materials: [{ id: 'M1', name: 'Wood', type: 'timber', E: 1600, G: 600, density: 0.00002 }] }),
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('"type" must be "steel" or "concrete"');
  });

  it('rejects a support with non-boolean restraints', () => {
    const result = validateModelJson(
      jsonOf({ supports: [{ nodeId: 'N1', dx: 1, dy: true, dz: true, rx: true, ry: true, rz: true }] }),
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('"dx" must be a boolean');
  });

  it('rejects an optional numeric field given a non-number', () => {
    const result = validateModelJson(
      jsonOf({ materials: [{ id: 'M1', name: 'A992', type: 'steel', E: 29000, G: 11200, density: 0.000284, fy: 'high' }] }),
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('"fy" must be a number');
  });

  it('rejects an element referencing a missing node', () => {
    const result = validateModelJson(
      jsonOf({ elements: [{ id: 'E1', nodeI: 'N1', nodeJ: 'N9', materialId: 'M1', sectionId: 'S1', betaAngle: 0 }] }),
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toBe('Element E1: nodeJ "N9" not found');
  });

  it('rejects a support referencing a missing node', () => {
    const result = validateModelJson(
      jsonOf({ supports: [{ nodeId: 'N9', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true }] }),
    );
    expect(result.success).toBe(false);
    expect(result.errors[0]).toBe('Support: nodeId "N9" not found');
  });

  it('reports a non-object array item instead of throwing', () => {
    const result = validateModelJson(jsonOf({ nodes: [null] }));
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Node 1: expected an object');
  });

  it('accepts an empty model — a saved work in progress must still load', () => {
    const result = validateModelJson(
      JSON.stringify({
        nodes: [], elements: [], materials: [], sections: [],
        supports: [], nodalLoads: [], distributedLoads: [],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('validateModelShape', () => {
  it('rejects a model with no elements', () => {
    const result = validateModelShape({ ...validModel, elements: [] });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Model has no elements');
  });

  it('returns an error instead of throwing on a null array item', () => {
    const result = validateModelShape({ nodes: [null] });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Node 1: expected an object');
  });

  it.each([
    ['nodes', 'Node 1: expected an object'],
    ['elements', 'Element 1: expected an object'],
    ['materials', 'Material 1: expected an object'],
    ['sections', 'Section 1: expected an object'],
    ['supports', 'Support 1: expected an object'],
    ['nodalLoads', 'Nodal load 1: expected an object'],
    ['distributedLoads', 'Distributed load 1: expected an object'],
  ])('reports a non-object item in "%s" without throwing', (key, message) => {
    const result = validateModelShape({ ...validModel, [key]: [null] });
    expect(result.success).toBe(false);
    expect(result.errors).toContain(message);
  });
});

describe('extractAndValidateModel (AI path)', () => {
  it('still extracts fenced JSON and coerces numeric IDs', () => {
    const response = '```json\n' + JSON.stringify({
      nodes: [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 120, y: 0, z: 0 }],
      elements: [{ id: 1, nodeI: 1, nodeJ: 2, materialId: 1, sectionId: 1 }],
      materials: [{ id: 1, name: 'A992', type: 'steel', E: 29000, G: 11200, density: 0.000284 }],
      sections: [{ id: 1, name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 }],
      supports: [{ nodeId: 1, dx: 1, dy: 1, dz: 1, rx: 1, ry: 1, rz: 1 }],
      nodalLoads: [{ nodeId: 2, fy: -10 }],
    }) + '\n```';
    const result = extractAndValidateModel(response);
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.model?.elements[0].nodeI).toBe('N1');
  });

  it('reports missing arrays', () => {
    const result = extractAndValidateModel('{"nodes": []}');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Missing or invalid "elements" array');
  });

  it('returns an error instead of throwing on a null array item', () => {
    const result = extractAndValidateModel(JSON.stringify({ ...validModel, nodes: [null] }));
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Node 1: expected an object');
  });
});

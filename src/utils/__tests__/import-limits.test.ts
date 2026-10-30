import { describe, it, expect } from 'vitest';
import { fileSizeError, MAX_IMPORT_BYTES, MAX_MODEL_ELEMENTS, MAX_MODEL_NODES } from '../import-limits';
import { validateModelJson } from '../model-validator';
import { convertEntities } from '../dxf-import';

describe('fileSizeError', () => {
  it('accepts a file at the limit', () => {
    expect(fileSizeError({ name: 'a.ifc', size: MAX_IMPORT_BYTES })).toBeNull();
  });

  it('rejects a larger file and names it', () => {
    expect(fileSizeError({ name: 'big.ifc', size: MAX_IMPORT_BYTES + 1 })).toMatch(/big\.ifc/);
  });
});

describe('model size limits', () => {
  const model = (nodes: number, elements: number) =>
    JSON.stringify({
      nodes: Array.from({ length: nodes }, (_, i) => ({ id: `N${i}`, x: i, y: 0, z: 0 })),
      elements: Array.from({ length: elements }, (_, i) => ({
        id: `E${i}`, nodeI: 'N0', nodeJ: 'N1', materialId: 'M1', sectionId: 'S1', betaAngle: 0,
      })),
      materials: [], sections: [], supports: [], nodalLoads: [],
    });

  it('rejects a JSON model with too many nodes before validating each one', () => {
    const result = validateModelJson(model(MAX_MODEL_NODES + 1, 0));
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toMatch(/nodes/);
  });

  it('rejects a JSON model with too many elements', () => {
    const result = validateModelJson(model(2, MAX_MODEL_ELEMENTS + 1));
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toMatch(/elements/);
  });

  it('refuses a DXF with more segments than the element limit instead of hanging', () => {
    const lines = Array.from({ length: MAX_MODEL_ELEMENTS + 1 }, (_, i) => ({
      type: 'LINE', layer: '0', vertices: [{ x: i * 10, y: 0, z: 0 }, { x: i * 10, y: 5, z: 0 }],
    }));
    const started = Date.now();
    const result = convertEntities(lines);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.nodes).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/limit/);
  });
});

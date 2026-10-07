import { describe, it, expect } from 'vitest';
import type {
  ColumnReinforcement,
  DistributedLoad,
  FrameElement,
  Material,
  NodalLoad,
  Section,
  StructuralModel,
  StructuralNode,
  Support,
} from '../../core/types';
import {
  INTERNAL_UNIT_TAG,
  MODEL_FIELD_UNITS,
  MODEL_SCHEMA_VERSION,
  convertModel,
  convertValue,
  isModelUnitTag,
  tagModel,
  unitTagForSystem,
} from '../model-units';

/**
 * Every field of every model type is filled in. `Required<...>` makes the
 * typecheck fail here when a field is added to src/core/types.ts, and the
 * test below then fails until the new numeric field has a unit entry.
 */
const fullModel: StructuralModel = {
  nodes: [{ id: 'N1', x: 1, y: 2, z: 3 } satisfies Required<StructuralNode>],
  elements: [
    { id: 'E1', nodeI: 'N1', nodeJ: 'N1', materialId: 'M1', sectionId: 'S1', betaAngle: 90 } satisfies Required<FrameElement>,
  ],
  materials: [
    { id: 'M1', name: 'M', type: 'steel', E: 1, G: 2, density: 3, fy: 4, fu: 5, fc: 6 } satisfies Required<Material>,
  ],
  sections: [
    {
      id: 'S1', name: 'S', A: 1, Ix: 2, Iy: 3, J: 4, Sx: 5, Sy: 6, Zx: 7, Zy: 8, rx: 9, ry: 10,
      d: 11, bf: 12, tf: 13, tw: 14, b: 15, h: 16,
      reinforcement: {
        cover: 1.5, barSize: 8, barsAlongB: 3, barsAlongH: 4, tieSize: 3, fy: 60,
      } satisfies Required<ColumnReinforcement>,
    } satisfies Required<Section>,
  ],
  supports: [
    { nodeId: 'N1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true } satisfies Required<Support>,
  ],
  nodalLoads: [
    { id: 'L1', nodeId: 'N1', fx: 1, fy: 2, fz: 3, mx: 4, my: 5, mz: 6 } satisfies Required<NodalLoad>,
  ],
  distributedLoads: [
    { id: 'D1', elementId: 'E1', wx: 1, wy: 2, wz: 3 } satisfies Required<DistributedLoad>,
  ],
};

describe('MODEL_FIELD_UNITS', () => {
  it('has an entry for every numeric field of a fully populated model', () => {
    const missing: string[] = [];
    for (const [key, items] of Object.entries(fullModel)) {
      const spec = MODEL_FIELD_UNITS[key as keyof StructuralModel];
      expect(spec, `model array "${key}"`).toBeDefined();
      for (const item of items as Record<string, unknown>[]) {
        for (const [field, value] of Object.entries(item)) {
          if (typeof value === 'number' && !(field in spec.fields)) missing.push(`${key}.${field}`);
          if (typeof value === 'object' && value !== null) {
            const nested = (spec.nested as Record<string, Record<string, unknown>>)[field];
            if (!nested) {
              missing.push(`${key}.${field} (nested object)`);
              continue;
            }
            for (const [sub, subValue] of Object.entries(value)) {
              if (typeof subValue === 'number' && !(sub in nested)) missing.push(`${key}.${field}.${sub}`);
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('declares the section shape marker as unitless', () => {
    expect(MODEL_FIELD_UNITS.sections.fields.shape).toBe('unitless');
  });
});

describe('convertValue', () => {
  it('uses one length unit per tag', () => {
    expect(convertValue(1, 'length', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(0.0254, 12);
    expect(convertValue(1, 'sectionDimension', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(0.0254, 12);
    expect(convertValue(1, 'length', 'kip-in-ksi', 'N-mm-MPa')).toBeCloseTo(25.4, 10);
    expect(convertValue(1, 'sectionDimension', 'kip-in-ksi', 'N-mm-MPa')).toBeCloseTo(25.4, 10);
  });

  it('converts derived quantities consistently', () => {
    // 1 kip = 4.4482216152605 kN, 1 ksi = 6.894757293168361 MPa
    expect(convertValue(1, 'force', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(4.4482216152605, 12);
    expect(convertValue(1, 'force', 'kip-in-ksi', 'N-mm-MPa')).toBeCloseTo(4448.2216152605, 8);
    expect(convertValue(1, 'moment', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(0.112984829, 8);
    expect(convertValue(1, 'moment', 'kip-in-ksi', 'N-mm-MPa')).toBeCloseTo(112984.829, 2);
    expect(convertValue(1, 'forcePerLength', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(175.126835, 5);
    expect(convertValue(1, 'stress', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(6.894757293, 8);
    expect(convertValue(1, 'stress', 'kip-in-ksi', 'N-mm-MPa')).toBeCloseTo(6.894757293, 8);
    expect(convertValue(1, 'area', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(6.4516e-4, 12);
    expect(convertValue(1, 'momentOfInertia', 'kip-in-ksi', 'N-mm-MPa')).toBeCloseTo(416231.4256, 3);
    expect(convertValue(1, 'sectionModulus', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(1.6387064e-5, 12);
  });

  it('reads 490 pcf steel as about 7850 kg/m3', () => {
    expect(convertValue(0.000284, 'density', 'kip-in-ksi', 'kN-m-MPa')).toBeCloseTo(7861, 0);
    expect(convertValue(7850, 'density', 'N-mm-MPa', 'kip-in-ksi')).toBeCloseTo(0.0002836, 7);
  });

  it('round-trips between metric tags', () => {
    expect(convertValue(convertValue(12.5, 'moment', 'kN-m-MPa', 'N-mm-MPa'), 'moment', 'N-mm-MPa', 'kN-m-MPa'))
      .toBeCloseTo(12.5, 12);
    expect(convertValue(12.5, 'moment', 'kN-m-MPa', 'N-mm-MPa')).toBeCloseTo(12.5e6, 3);
  });
});

describe('convertModel', () => {
  it('converts every listed field and leaves unitless ones alone', () => {
    const m = convertModel(fullModel, INTERNAL_UNIT_TAG, 'N-mm-MPa');
    expect(m.nodes[0].x).toBeCloseTo(25.4, 10);
    expect(m.elements[0].betaAngle).toBe(90);
    expect(m.materials[0].fy).toBeCloseTo(4 * 6.894757293168361, 10);
    expect(m.sections[0].d).toBeCloseTo(11 * 25.4, 10);
    expect(m.sections[0].rx).toBeCloseTo(9 * 25.4, 10);
    const r = m.sections[0].reinforcement!;
    expect(r.cover).toBeCloseTo(1.5 * 25.4, 10);
    expect(r.fy).toBeCloseTo(60 * 6.894757293168361, 8);
    expect([r.barSize, r.barsAlongB, r.barsAlongH, r.tieSize]).toEqual([8, 3, 4, 3]);
    expect(m.supports).toEqual(fullModel.supports);
    expect(m.nodalLoads[0].mz).toBeCloseTo(6 * 112984.829, 1);
    expect(m.distributedLoads[0].wy).toBeCloseTo(2 * 4448.2216152605 / 25.4, 6);
  });

  it('does not modify its input and round-trips', () => {
    const before = JSON.stringify(fullModel);
    const back = convertModel(convertModel(fullModel, INTERNAL_UNIT_TAG, 'kN-m-MPa'), 'kN-m-MPa', INTERNAL_UNIT_TAG);
    expect(JSON.stringify(fullModel)).toBe(before);
    expect(back.sections[0].Ix).toBeCloseTo(2, 10);
    expect(back.nodalLoads[0].mx).toBeCloseTo(4, 10);
    expect(back.materials[0].density).toBeCloseTo(3, 10);
  });

  it('is exact when both tags are the same', () => {
    expect(convertModel(fullModel, 'kip-in-ksi', 'kip-in-ksi')).toEqual(fullModel);
  });
});

describe('tags', () => {
  it('knows the three tags and nothing else', () => {
    expect(['kip-in-ksi', 'kN-m-MPa', 'N-mm-MPa'].every(isModelUnitTag)).toBe(true);
    expect(isModelUnitTag('SI')).toBe(false);
    expect(isModelUnitTag(undefined)).toBe(false);
  });

  it('maps the display system to its tag', () => {
    expect(unitTagForSystem('imperial')).toBe('kip-in-ksi');
    expect(unitTagForSystem('metric')).toBe('kN-m-MPa');
  });

  it('tags a model with the schema version and internal units', () => {
    const tagged = tagModel(fullModel);
    expect(tagged.schemaVersion).toBe(MODEL_SCHEMA_VERSION);
    expect(tagged.units).toBe('kip-in-ksi');
    expect(tagged.nodes).toBe(fullModel.nodes);
  });
});

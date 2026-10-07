import { describe, it, expect } from 'vitest';
import { validateModelJson, validateModelShape } from '../model-validator';
import { extractAndValidateModel } from '../ai-model-validator';
import { modelToJson } from '../export';
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

  it('rejects a distributedLoads that is present but not an array', () => {
    // Quietly replacing it with [] drops the loads and reports success, which
    // is the silently-wrong-values case this validator exists to catch.
    const result = validateModelJson(jsonOf({ distributedLoads: { E1: { wy: -5 } } }));
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Missing or invalid "distributedLoads" array');
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

  it('accepts a material without G or density, and the result round-trips', () => {
    // The two paths have to agree: a model the AI path accepts gets saved, and
    // reopening it goes through the strict file path. Leaving the constants out
    // is the same class of omission as the betaAngle this already defaults.
    const ai = extractAndValidateModel(JSON.stringify({
      ...validModel,
      materials: [{ id: 'M1', name: 'A992', type: 'steel', E: 29000 }],
    }));
    expect(ai.errors).toEqual([]);
    expect(ai.success).toBe(true);

    const reopened = validateModelJson(JSON.stringify(ai.model));
    expect(reopened.errors).toEqual([]);
    expect(reopened.success).toBe(true);
  });

  it('derives a missing G from E and takes density from the material type', () => {
    // material-library.ts uses nu = 0.3 for steel and nu = 0.2 for concrete,
    // with 490 pcf and 150 pcf. The same constants are applied here.
    const steel = extractAndValidateModel(JSON.stringify({
      ...validModel,
      materials: [{ id: 'M1', name: 'A992', type: 'steel', E: 29000 }],
    }));
    expect(steel.model?.materials[0].G).toBeCloseTo(29000 / 2.6, 6);
    expect(steel.model?.materials[0].density).toBeCloseTo(0.000284, 9);

    const concrete = extractAndValidateModel(JSON.stringify({
      ...validModel,
      materials: [{ id: 'M1', name: "f'c 4 ksi", type: 'concrete', E: 3605, fc: 4 }],
    }));
    expect(concrete.model?.materials[0].G).toBeCloseTo(3605 / 2.4, 6);
    expect(concrete.model?.materials[0].density).toBeCloseTo(0.0000868, 10);
  });

  it('leaves G and density alone when the model supplies them', () => {
    const result = extractAndValidateModel(JSON.stringify(validModel));
    expect(result.model?.materials[0].G).toBe(11200);
    expect(result.model?.materials[0].density).toBeCloseTo(0.000284, 9);
  });
});

describe('section reinforcement (issue #25)', () => {
  const concreteModel: StructuralModel = {
    ...validModel,
    materials: [
      { id: 'M1', name: 'C4000', type: 'concrete', E: 3605, G: 1502, density: 0.0000868, fc: 4 },
    ],
    sections: [
      {
        id: 'S1', name: '16x16 8#8', A: 256, Ix: 5461.33, Iy: 5461.33, J: 9000, b: 16, h: 16,
        reinforcement: { cover: 1.5, barSize: 8, barsAlongB: 3, barsAlongH: 3, tieSize: 3, fy: 60 },
      },
    ],
  };

  it('round-trips through the saved JSON unchanged', () => {
    const result = validateModelJson(modelToJson(concreteModel));
    expect(result.success).toBe(true);
    expect(result.model).toEqual(concreteModel);
    expect(result.model?.sections[0].reinforcement).toEqual(concreteModel.sections[0].reinforcement);
  });

  it('loads a section without reinforcement exactly as before', () => {
    const result = validateModelJson(modelToJson(validModel));
    expect(result.success).toBe(true);
    expect(result.model?.sections[0]).not.toHaveProperty('reinforcement');
    expect(result.model).toEqual(validModel);
  });

  it('rejects invalid reinforcement on the file path', () => {
    const bad = {
      ...concreteModel,
      sections: [{ ...concreteModel.sections[0], reinforcement: { cover: 1.5, barSize: 14, barsAlongB: 3, barsAlongH: 3, tieSize: 3 } }],
    };
    const result = validateModelJson(JSON.stringify(bad));
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Section "S1": reinforcement "barSize" must be a bar designation from 3 to 11']);
  });

  it('rejects reinforcement on a section without b and h', () => {
    const { b: _b, h: _h, ...noDims } = concreteModel.sections[0];
    void _b; void _h;
    const result = validateModelJson(JSON.stringify({ ...concreteModel, sections: [noDims] }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/Section "S1": reinforcement needs positive "b" and "h"/);
  });

  it('rejects invalid reinforcement on the AI path too', () => {
    const bad = {
      ...concreteModel,
      sections: [{ ...concreteModel.sections[0], reinforcement: { cover: 1.5, barSize: 8, barsAlongB: 1, barsAlongH: 3, tieSize: 3 } }],
    };
    const result = extractAndValidateModel('```json\n' + JSON.stringify(bad) + '\n```');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => /barsAlongB/.test(e))).toBe(true);
    expect(validateModelShape(concreteModel).success).toBe(true);
  });
});

describe('unit-tagged files (schema version 2, issue #8)', () => {
  it('writes the schema version and the internal unit tag', () => {
    const parsed = JSON.parse(modelToJson(validModel));
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.units).toBe('kip-in-ksi');
    expect(parsed.nodes).toEqual(validModel.nodes);
  });

  it('reads back a tagged file as the plain model, without the tags', () => {
    const result = validateModelJson(modelToJson(validModel));
    expect(result.success).toBe(true);
    expect(result.model).toEqual(validModel);
    expect(result.model).not.toHaveProperty('units');
    expect(result.model).not.toHaveProperty('schemaVersion');
    expect(result.warnings).toEqual([]);
  });

  it('treats an untagged file as kip-in-ksi', () => {
    const result = validateModelJson(JSON.stringify(validModel));
    expect(result.success).toBe(true);
    expect(result.model).toEqual(validModel);
  });

  it('converts a kN-m-MPa file to internal units', () => {
    const result = validateModelJson(jsonOf({
      units: 'kN-m-MPa',
      nodes: [{ id: 'N1', x: 0, y: 0, z: 0 }, { id: 'N2', x: 3.048, y: 0, z: 0 }],
      materials: [{ id: 'M1', name: 'S355', type: 'steel', E: 210000, G: 81000, density: 7850, fy: 355 }],
      nodalLoads: [{ id: 'L1', nodeId: 'N2', fx: 0, fy: -44.482216152605, fz: 0, mx: 0, my: 0, mz: 0 }],
    }));
    expect(result.success).toBe(true);
    expect(result.model?.nodes[1].x).toBeCloseTo(120, 9);
    expect(result.model?.nodalLoads[0].fy).toBeCloseTo(-10, 9);
    expect(result.model?.materials[0].fy).toBeCloseTo(355 / 6.894757293168361, 9);
    expect(result.model?.materials[0].density).toBeCloseTo(0.0002836, 7);
    expect(result.warnings).toEqual([]);
  });

  it('converts an N-mm-MPa file, including section properties and cover', () => {
    const result = validateModelJson(JSON.stringify({
      ...validModel,
      units: 'N-mm-MPa',
      schemaVersion: 2,
      nodes: [{ id: 'N1', x: 0, y: 0, z: 0 }, { id: 'N2', x: 0, y: 3048, z: 0 }],
      materials: [{ id: 'M1', name: "f'c 28", type: 'concrete', E: 24870, G: 10363, density: 2400, fc: 28 }],
      sections: [{
        id: 'S1', name: 'C400', A: 160000, Ix: 2133333333, Iy: 2133333333, J: 3609000000, b: 400, h: 400,
        reinforcement: { cover: 40, barSize: 8, barsAlongB: 3, barsAlongH: 3, tieSize: 3, fy: 420 },
      }],
    }));
    expect(result.errors).toEqual([]);
    const s = result.model!.sections[0];
    expect(s.b).toBeCloseTo(400 / 25.4, 9);
    expect(s.A).toBeCloseTo(160000 / 645.16, 6);
    expect(s.Ix).toBeCloseTo(2133333333 / 25.4 ** 4, 6);
    expect(s.reinforcement?.cover).toBeCloseTo(40 / 25.4, 9);
    expect(s.reinforcement?.barSize).toBe(8);
    expect(s.reinforcement?.fy).toBeCloseTo(420 / 6.894757293168361, 9);
  });

  it('rejects an unknown units tag', () => {
    const result = validateModelJson(jsonOf({ units: 'SI' }));
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Unknown "units" "SI". Expected one of: "kip-in-ksi", "kN-m-MPa", "N-mm-MPa"']);
  });

  it('rejects a file from a newer schema version', () => {
    const result = validateModelJson(jsonOf({ schemaVersion: 3 }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/schemaVersion 3, newer than this app supports/);
  });

  it('warns when steel E looks like MPa under a kip-in-ksi tag', () => {
    const result = validateModelJson(jsonOf({
      materials: [{ id: 'M1', name: 'S355', type: 'steel', E: 200000, G: 77000, density: 0.000284, fy: 355 }],
    }));
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings?.[0]).toMatch(/Material "M1": E is 200000 ksi .*"kip-in-ksi"/);
    expect(result.warnings?.[1]).toMatch(/Material "M1": fy is 355 ksi/);
  });

  it('warns when ksi values are tagged as MPa', () => {
    const result = validateModelJson(jsonOf({ units: 'kN-m-MPa' }));
    expect(result.success).toBe(true);
    expect(result.warnings?.some((w) => /E is 4206 ksi after reading the file as "kN-m-MPa"/.test(w))).toBe(true);
  });
});

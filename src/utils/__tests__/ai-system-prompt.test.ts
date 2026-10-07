import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT, buildSystemPrompt, buildUserMessage } from '../ai-system-prompt';
import { extractAndValidateModel } from '../ai-model-validator';
import type { StructuralModel } from '../../core/types';

function fencedJson(text: string): Record<string, unknown> {
  const blocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  return JSON.parse(blocks[blocks.length - 1]);
}

const model: StructuralModel = {
  nodes: [{ id: 'N1', x: 0, y: 0, z: 0 }, { id: 'N2', x: 120, y: 0, z: 0 }],
  elements: [{ id: 'E1', nodeI: 'N1', nodeJ: 'N2', materialId: 'M1', sectionId: 'S1', betaAngle: 0 }],
  materials: [{ id: 'M1', name: 'A992', type: 'steel', E: 29000, G: 11200, density: 0.000284, fy: 50 }],
  sections: [{ id: 'S1', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 }],
  supports: [{ nodeId: 'N1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true }],
  nodalLoads: [{ id: 'L1', nodeId: 'N2', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 }],
  distributedLoads: [],
};

describe('buildSystemPrompt', () => {
  it('asks for kip-in-ksi by default', () => {
    expect(SYSTEM_PROMPT).toBe(buildSystemPrompt('imperial'));
    expect(SYSTEM_PROMPT).toContain('set "units": "kip-in-ksi"');
    expect(SYSTEM_PROMPT).toContain('A992 Steel');
  });

  it('asks for kN-m-MPa with a metric example when metric is selected', () => {
    const prompt = buildSystemPrompt('metric');
    expect(prompt).toContain('set "units": "kN-m-MPa"');
    expect(prompt).toContain('S355 Steel');
    expect(prompt).toContain('9 m span, 90 kN center load');
    expect(prompt).not.toContain('A992');
    expect(prompt).not.toContain('"units": "kip-in-ksi"');
  });

  it.each([['imperial'], ['metric']] as const)('has a %s example that imports as a valid model', (system) => {
    const example = fencedJson(buildSystemPrompt(system));
    const result = extractAndValidateModel(JSON.stringify(example));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('gives the same beam in both examples, within rounding', () => {
    const imperial = extractAndValidateModel(JSON.stringify(fencedJson(buildSystemPrompt('imperial')))).model!;
    const metric = extractAndValidateModel(JSON.stringify(fencedJson(buildSystemPrompt('metric')))).model!;
    // Ix of W14x22 survives the m^4 rounding in the metric prompt.
    expect(metric.sections[0].Ix).toBeCloseTo(imperial.sections[0].Ix, 0);
  });
});

describe('buildUserMessage', () => {
  it('returns the text alone without a model', () => {
    expect(buildUserMessage('Simple beam', null, 'metric')).toBe('Simple beam');
  });

  it('sends the current model tagged in kip-in-ksi for imperial users', () => {
    const json = fencedJson(buildUserMessage('Add a load', model, 'imperial'));
    expect(json.units).toBe('kip-in-ksi');
    expect((json.nodes as { x: number }[])[1].x).toBe(120);
  });

  it('sends the current model converted and tagged for metric users', () => {
    const msg = buildUserMessage('Add a load', model, 'metric');
    const json = fencedJson(msg);
    expect(json.units).toBe('kN-m-MPa');
    expect((json.nodes as { x: number }[])[1].x).toBeCloseTo(3.048, 12);
    expect(msg).toContain('with "units": "kN-m-MPa"');
    // A reply that echoes the model back unchanged imports as the same model.
    const back = extractAndValidateModel(JSON.stringify(json)).model!;
    expect(back.nodes[1].x).toBeCloseTo(120, 9);
    expect(back.materials[0].fy).toBeCloseTo(50, 9);
  });
});

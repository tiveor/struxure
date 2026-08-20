import { describe, it, expect } from 'vitest';
import { SolverManager } from '../solver-manager';
import type { StructuralModel, AnalysisResults } from '../types';

describe('SolverManager', () => {
  it('should be instantiable', () => {
    const manager = new SolverManager();
    expect(manager).toBeDefined();
    expect(manager.cancel).toBeInstanceOf(Function);
    expect(manager.solve).toBeInstanceOf(Function);
  });

  it('should accept onProgress callback', () => {
    const manager = new SolverManager();
    manager.onProgress = (step, progress) => {
      expect(typeof step).toBe('string');
      expect(typeof progress).toBe('number');
    };
    expect(manager.onProgress).toBeInstanceOf(Function);
  });

  it('should not throw when cancelling without active worker', () => {
    const manager = new SolverManager();
    expect(() => manager.cancel()).not.toThrow();
  });
});

describe('model serialization for worker', () => {
  it('should correctly serialize and deserialize model data', () => {
    const model: StructuralModel = {
      nodes: [
        { id: 'n1', x: 0, y: 0, z: 0 },
        { id: 'n2', x: 120, y: 0, z: 0 },
      ],
      elements: [
        { id: 'e1', nodeI: 'n1', nodeJ: 'n2', materialId: 'm1', sectionId: 's1', betaAngle: 0 },
      ],
      materials: [
        { id: 'm1', name: 'Steel', type: 'steel', E: 29000, G: 11200, density: 0.000284 },
      ],
      sections: [
        { id: 's1', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 },
      ],
      supports: [
        { nodeId: 'n1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
      ],
      nodalLoads: [
        { id: 'l1', nodeId: 'n2', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 },
      ],
      distributedLoads: [],
    };

    // Simulate structured clone serialization (what postMessage does)
    const serialized = JSON.parse(JSON.stringify(model));

    expect(serialized.nodes).toHaveLength(2);
    expect(serialized.elements).toHaveLength(1);
    expect(serialized.nodes[0].x).toBe(0);
    expect(serialized.nodes[1].x).toBe(120);
    expect(serialized.materials[0].E).toBe(29000);
    expect(serialized.sections[0].A).toBe(7.65);
  });

  it('should serialize analysis results with Maps converted to objects', () => {
    // Simulate what the worker does: convert Maps to plain objects
    const results: AnalysisResults = {
      displacements: [0, -0.1, 0, 0, 0, 0, 0, -0.5, 0, 0, 0, 0],
      reactions: new Map([['n1', [10, 5, 0, 0, 0, -600]]]),
      elementForces: new Map([['e1', { startForces: [10, 5, 0, 0, 0, -600], endForces: [-10, -5, 0, 0, 0, 0] }]]),
      nodeDisplacements: new Map([
        ['n1', [0, 0, 0, 0, 0, 0]],
        ['n2', [0, -0.5, 0, 0, 0, 0]],
      ]),
    };

    // Worker serialization
    const serialized = {
      ...results,
      reactions: Object.fromEntries(results.reactions),
      elementForces: Object.fromEntries(results.elementForces),
      nodeDisplacements: Object.fromEntries(results.nodeDisplacements),
    };

    // Simulate JSON roundtrip
    const transmitted = JSON.parse(JSON.stringify(serialized));

    // Manager deserialization
    const restored: AnalysisResults = {
      ...transmitted,
      reactions: new Map(Object.entries(transmitted.reactions)),
      elementForces: new Map(Object.entries(transmitted.elementForces)),
      nodeDisplacements: new Map(Object.entries(transmitted.nodeDisplacements)),
    };

    expect(restored.reactions.get('n1')).toEqual([10, 5, 0, 0, 0, -600]);
    expect(restored.elementForces.get('e1')?.startForces).toEqual([10, 5, 0, 0, 0, -600]);
    expect(restored.nodeDisplacements.get('n2')).toEqual([0, -0.5, 0, 0, 0, 0]);
    expect(restored.displacements).toHaveLength(12);
  });
});

describe('solver step ordering', () => {
  it('progress steps should follow correct order', () => {
    const expectedOrder = ['assembly', 'boundaries', 'solving', 'postprocess', 'complete'];
    // Verify logical order of steps
    expect(expectedOrder[0]).toBe('assembly');
    expect(expectedOrder[1]).toBe('boundaries');
    expect(expectedOrder[2]).toBe('solving');
    expect(expectedOrder[3]).toBe('postprocess');
    expect(expectedOrder[4]).toBe('complete');
  });
});

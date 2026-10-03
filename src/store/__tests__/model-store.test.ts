import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model-store';
import { useResultsStore } from '../results-store';
import { validateModelJson } from '../../utils/model-validator';
import type { AnalysisResults, StructuralNode, FrameElement } from '../../core/types';
import type { DesignResult } from '../results-store';

const node = (id: string, x = 0): StructuralNode => ({ id, x, y: 0, z: 0 });

const element = (id: string, nodeI: string, nodeJ: string): FrameElement => ({
  id,
  nodeI,
  nodeJ,
  materialId: 'steel-A992',
  sectionId: 'W12x26',
  betaAngle: 0,
});

const fakeAnalysis = (): AnalysisResults => ({
  displacements: [0, 0, 0, 0, 0, 0],
  reactions: new Map(),
  elementForces: new Map(),
  nodeDisplacements: new Map(),
});

const fakeDesign = (): DesignResult[] => [
  { elementId: 'e1', material: 'steel', ratio: 0.5, status: 'pass', details: {} },
];

/** Puts the results store in the state it has right after a successful run. */
function seedResults() {
  const { setAnalysisResults, setDesignResults } = useResultsStore.getState();
  setAnalysisResults(fakeAnalysis());
  setDesignResults(fakeDesign());
}

describe('model edits invalidate analysis results', () => {
  beforeEach(() => {
    useModelStore.getState().clearModel();
    useResultsStore.getState().clearResults();
  });

  it('seeded results start out valid', () => {
    seedResults();
    expect(useResultsStore.getState().isAnalyzed).toBe(true);
    expect(useResultsStore.getState().isDesigned).toBe(true);
  });

  const mutations: Array<[string, () => void]> = [
    ['addNode', () => useModelStore.getState().addNode(node('n-new'))],
    ['updateNode', () => useModelStore.getState().updateNode('n1', { x: 120 })],
    ['removeNode', () => useModelStore.getState().removeNode('n1')],
    ['addElement', () => useModelStore.getState().addElement(element('e-new', 'n1', 'n2'))],
    ['updateElement', () => useModelStore.getState().updateElement('e1', { sectionId: 'W14x30' })],
    ['removeElement', () => useModelStore.getState().removeElement('e1')],
    ['updateMaterial', () => useModelStore.getState().updateMaterial('steel-A992', { fy: 65 })],
    ['updateSection', () => useModelStore.getState().updateSection('W12x26', { A: 9.1 })],
    ['addSupport', () =>
      useModelStore.getState().addSupport({
        nodeId: 'n2',
        dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
      })],
    ['removeSupport', () => useModelStore.getState().removeSupport('n1')],
    ['addNodalLoad', () =>
      useModelStore.getState().addNodalLoad({
        id: 'l-new', nodeId: 'n2', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0,
      })],
    ['removeNodalLoad', () => useModelStore.getState().removeNodalLoad('l1')],
    ['loadModel', () =>
      // A template or a .json file always arrives as freshly built arrays,
      // which is what makes the identity comparison in the store meaningful.
      useModelStore.getState().loadModel({
        nodes: [node('other-1'), node('other-2', 240)],
        elements: [element('other-e1', 'other-1', 'other-2')],
        materials: [],
        sections: [],
        supports: [],
        nodalLoads: [],
        distributedLoads: [],
      })],
    ['bulkImport', () => useModelStore.getState().bulkImport([node('n-imported')], [])],
    ['clearModel', () => useModelStore.getState().clearModel()],
  ];

  it.each(mutations)('%s clears stale results', (_name, mutate) => {
    // Arrange a model the mutation can act on, then analyze it.
    const store = useModelStore.getState();
    store.addNode(node('n1', 0));
    store.addNode(node('n2', 120));
    store.addElement(element('e1', 'n1', 'n2'));
    store.addSupport({ nodeId: 'n1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true });
    store.addNodalLoad({ id: 'l1', nodeId: 'n2', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0 });
    seedResults();

    mutate();

    const results = useResultsStore.getState();
    expect(results.isAnalyzed).toBe(false);
    expect(results.isDesigned).toBe(false);
    expect(results.analysisResults).toBeNull();
    expect(results.designResults).toEqual([]);
  });

  it('clears a stale analysis error too', () => {
    useResultsStore.getState().setAnalysisError('Singular stiffness matrix');
    useModelStore.getState().addSupport({
      nodeId: 'n1', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true,
    });
    expect(useResultsStore.getState().analysisError).toBeNull();
  });

  it('leaves an in-flight solve alone', () => {
    // A solve that has not produced results yet must survive the model edits
    // the solver itself does not make, so the progress UI is not torn down.
    useResultsStore.getState().setSolving(true);
    useModelStore.getState().addNode(node('n1'));
    expect(useResultsStore.getState().isSolving).toBe(true);
  });

  it('does not touch the results store when nothing was analyzed', () => {
    const before = useResultsStore.getState();
    useModelStore.getState().addNode(node('n1'));
    // Same object identity proves no redundant set() ran.
    expect(useResultsStore.getState()).toBe(before);
  });
});

describe('deleting referenced materials, sections and nodes', () => {
  beforeEach(() => {
    useModelStore.getState().clearModel();
    useResultsStore.getState().clearResults();
  });

  /** Two nodes and one element on the default material and section. */
  function seedModel() {
    const store = useModelStore.getState();
    store.addNode(node('n1', 0));
    store.addNode(node('n2', 120));
    // e1 references the default 'steel-A992' material and 'W12x26' section.
    store.addElement(element('e1', 'n1', 'n2'));
  }

  /** The regression check: what the app saves must be what the app can reopen. */
  function savedFileRoundTrips() {
    const model = useModelStore.getState().getModel();
    return validateModelJson(JSON.stringify(model)).success;
  }

  it('refuses to delete a material an element still uses', () => {
    seedModel();
    seedResults();

    expect(useModelStore.getState().removeMaterial('steel-A992')).toBe(false);

    const s = useModelStore.getState();
    expect(s.materials.map((m) => m.id)).toContain('steel-A992');
    expect(savedFileRoundTrips()).toBe(true);
    // A refused delete is not a model edit — results stay valid.
    expect(useResultsStore.getState().isAnalyzed).toBe(true);
  });

  it('refuses to delete a section an element still uses', () => {
    seedModel();

    expect(useModelStore.getState().removeSection('W12x26')).toBe(false);

    expect(useModelStore.getState().sections.map((s) => s.id)).toContain('W12x26');
    expect(savedFileRoundTrips()).toBe(true);
  });

  it('deletes a material no element uses', () => {
    seedModel();

    expect(useModelStore.getState().removeMaterial('concrete-4000')).toBe(true);

    expect(useModelStore.getState().materials.map((m) => m.id)).not.toContain('concrete-4000');
    expect(savedFileRoundTrips()).toBe(true);
  });

  it('deletes a section no element uses', () => {
    seedModel();
    useModelStore.getState().addSection({ id: 'W14x30', name: 'W14x30', A: 8.85, Ix: 291, Iy: 19.6, J: 0.38 });

    expect(useModelStore.getState().removeSection('W14x30')).toBe(true);

    expect(useModelStore.getState().sections.map((s) => s.id)).not.toContain('W14x30');
    expect(savedFileRoundTrips()).toBe(true);
  });

  it('deletes the material once the last element using it is gone', () => {
    seedModel();
    useModelStore.getState().removeElement('e1');

    expect(useModelStore.getState().removeMaterial('steel-A992')).toBe(true);

    expect(useModelStore.getState().materials.map((m) => m.id)).not.toContain('steel-A992');
    expect(savedFileRoundTrips()).toBe(true);
  });

  it('drops distributed loads when deleting a node removes their element', () => {
    seedModel();
    useModelStore.getState().addDistributedLoad({ id: 'dl1', elementId: 'e1', wx: 0, wy: -1, wz: 0 });

    useModelStore.getState().removeNode('n1');

    const s = useModelStore.getState();
    expect(s.elements).toEqual([]);
    expect(s.distributedLoads).toEqual([]);
    expect(savedFileRoundTrips()).toBe(true);
  });
});

// @vitest-environment jsdom
// The UI store reads localStorage and touches document on load, hence jsdom.
import { describe, it, expect, beforeEach } from 'vitest';
import { useModelStore } from '../model-store';
import { useUIStore } from '../ui-store';
import type { StructuralModel } from '../../core/types';

const N1 = { id: 'N1', x: 0, y: 0, z: 0 };
const N2 = { id: 'N2', x: 120, y: 0, z: 0 };
const E1 = { id: 'E1', nodeI: 'N1', nodeJ: 'N2', materialId: 'steel-A992', sectionId: 'W12x26', betaAngle: 0 };

/** A different model that happens to reuse the ids N2 and E1. */
function otherModelReusingIds(): StructuralModel {
  const { materials, sections } = useModelStore.getState();
  return {
    nodes: [N1, { id: 'N2', x: 0, y: 300, z: 0 }],
    elements: [{ ...E1 }],
    materials,
    sections,
    supports: [],
    nodalLoads: [],
    distributedLoads: [],
  };
}

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useModelStore.getState().clearModel();
  useModelStore.setState({ nodes: [{ ...N1 }, { ...N2 }], elements: [{ ...E1 }] });
});

describe('replacing the model clears the selection', () => {
  it('clears a selected node when the model is cleared', () => {
    useUIStore.getState().selectNode('N2');

    useModelStore.getState().clearModel();

    expect(useUIStore.getState().selectedNodeId).toBeNull();
  });

  it('clears a selected node when a model reusing its id is loaded', () => {
    useUIStore.getState().selectNode('N2');

    useModelStore.getState().loadModel(otherModelReusingIds());

    expect(useUIStore.getState().selectedNodeId).toBeNull();
  });

  it('clears a selected element when a model reusing its id is loaded', () => {
    useUIStore.getState().selectElement('E1');

    useModelStore.getState().loadModel(otherModelReusingIds());

    expect(useUIStore.getState().selectedElementId).toBeNull();
  });

  it('leaves the active panel alone', () => {
    useUIStore.getState().selectElement('E1');

    useModelStore.getState().clearModel();

    expect(useUIStore.getState().activePanel).toBe('elements');
  });
});

describe('editing the model keeps the selection', () => {
  beforeEach(() => {
    useUIStore.getState().selectNode('N2');
  });

  it('survives an edit to the selected node', () => {
    useModelStore.getState().updateNode('N2', { x: 240 });
    expect(useUIStore.getState().selectedNodeId).toBe('N2');
  });

  it('survives adding a node', () => {
    useModelStore.getState().addNode({ id: 'N3', x: 0, y: 0, z: 120 });
    expect(useUIStore.getState().selectedNodeId).toBe('N2');
  });

  it('survives an additive import, which keeps the existing entities', () => {
    useModelStore.getState().bulkImport([{ id: 'N3', x: 0, y: 0, z: 120 }], []);
    expect(useUIStore.getState().selectedNodeId).toBe('N2');
  });
});

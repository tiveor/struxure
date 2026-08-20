import { create } from 'zustand';
import type {
  StructuralNode,
  Material,
  Section,
  FrameElement,
  Support,
  NodalLoad,
  DistributedLoad,
  StructuralModel,
} from '../core/types';

interface ModelState {
  nodes: StructuralNode[];
  elements: FrameElement[];
  materials: Material[];
  sections: Section[];
  supports: Support[];
  nodalLoads: NodalLoad[];
  distributedLoads: DistributedLoad[];

  // Node CRUD
  addNode: (node: StructuralNode) => void;
  updateNode: (id: string, updates: Partial<StructuralNode>) => void;
  removeNode: (id: string) => void;

  // Element CRUD
  addElement: (element: FrameElement) => void;
  updateElement: (id: string, updates: Partial<FrameElement>) => void;
  removeElement: (id: string) => void;

  // Material CRUD
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  removeMaterial: (id: string) => void;

  // Section CRUD
  addSection: (section: Section) => void;
  updateSection: (id: string, updates: Partial<Section>) => void;
  removeSection: (id: string) => void;

  // Support CRUD
  addSupport: (support: Support) => void;
  updateSupport: (nodeId: string, updates: Partial<Support>) => void;
  removeSupport: (nodeId: string) => void;

  // Load CRUD
  addNodalLoad: (load: NodalLoad) => void;
  updateNodalLoad: (id: string, updates: Partial<NodalLoad>) => void;
  removeNodalLoad: (id: string) => void;

  addDistributedLoad: (load: DistributedLoad) => void;
  removeDistributedLoad: (id: string) => void;

  // Model operations
  getModel: () => StructuralModel;
  loadModel: (model: StructuralModel) => void;
  bulkImport: (nodes: StructuralNode[], elements: FrameElement[]) => void;
  bulkImportFull: (nodes: StructuralNode[], elements: FrameElement[], materials: Material[], sections: Section[]) => void;
  clearModel: () => void;
}

// Default materials
const defaultSteel: Material = {
  id: 'steel-A992',
  name: 'A992 Steel',
  type: 'steel',
  E: 29000,
  G: 11200,
  density: 0.000284,
  fy: 50,
  fu: 65,
};

const defaultConcrete: Material = {
  id: 'concrete-4000',
  name: "f'c = 4000 psi Concrete",
  type: 'concrete',
  E: 3605,
  G: 1502,
  density: 0.0000868,
  fc: 4,
};

// Default section
const defaultSection: Section = {
  id: 'W12x26',
  name: 'W12x26',
  A: 7.65,
  Ix: 204,
  Iy: 17.3,
  J: 0.3,
  Sx: 33.4,
  Sy: 5.48,
  Zx: 37.2,
  Zy: 8.17,
  rx: 5.17,
  ry: 1.51,
  d: 12.2,
  bf: 6.49,
  tf: 0.38,
  tw: 0.23,
};

export const useModelStore = create<ModelState>((set, get) => ({
  nodes: [],
  elements: [],
  materials: [defaultSteel, defaultConcrete],
  sections: [defaultSection],
  supports: [],
  nodalLoads: [],
  distributedLoads: [],

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNode: (id, updates) =>
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)) })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      elements: s.elements.filter((e) => e.nodeI !== id && e.nodeJ !== id),
      supports: s.supports.filter((sup) => sup.nodeId !== id),
      nodalLoads: s.nodalLoads.filter((l) => l.nodeId !== id),
    })),

  addElement: (element) => set((s) => ({ elements: [...s.elements, element] })),
  updateElement: (id, updates) =>
    set((s) => ({ elements: s.elements.map((e) => (e.id === id ? { ...e, ...updates } : e)) })),
  removeElement: (id) =>
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      distributedLoads: s.distributedLoads.filter((dl) => dl.elementId !== id),
    })),

  addMaterial: (material) => set((s) => ({ materials: [...s.materials, material] })),
  updateMaterial: (id, updates) =>
    set((s) => ({ materials: s.materials.map((m) => (m.id === id ? { ...m, ...updates } : m)) })),
  removeMaterial: (id) => set((s) => ({ materials: s.materials.filter((m) => m.id !== id) })),

  addSection: (section) => set((s) => ({ sections: [...s.sections, section] })),
  updateSection: (id, updates) =>
    set((s) => ({ sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...updates } : sec)) })),
  removeSection: (id) => set((s) => ({ sections: s.sections.filter((sec) => sec.id !== id) })),

  addSupport: (support) => set((s) => ({ supports: [...s.supports, support] })),
  updateSupport: (nodeId, updates) =>
    set((s) => ({
      supports: s.supports.map((sup) => (sup.nodeId === nodeId ? { ...sup, ...updates } : sup)),
    })),
  removeSupport: (nodeId) =>
    set((s) => ({ supports: s.supports.filter((sup) => sup.nodeId !== nodeId) })),

  addNodalLoad: (load) => set((s) => ({ nodalLoads: [...s.nodalLoads, load] })),
  updateNodalLoad: (id, updates) =>
    set((s) => ({ nodalLoads: s.nodalLoads.map((l) => (l.id === id ? { ...l, ...updates } : l)) })),
  removeNodalLoad: (id) =>
    set((s) => ({ nodalLoads: s.nodalLoads.filter((l) => l.id !== id) })),

  addDistributedLoad: (load) =>
    set((s) => ({ distributedLoads: [...s.distributedLoads, load] })),
  removeDistributedLoad: (id) =>
    set((s) => ({ distributedLoads: s.distributedLoads.filter((dl) => dl.id !== id) })),

  getModel: () => {
    const s = get();
    return {
      nodes: s.nodes,
      elements: s.elements,
      materials: s.materials,
      sections: s.sections,
      supports: s.supports,
      nodalLoads: s.nodalLoads,
      distributedLoads: s.distributedLoads,
    };
  },

  loadModel: (model) =>
    set({
      nodes: model.nodes,
      elements: model.elements,
      materials: model.materials,
      sections: model.sections,
      supports: model.supports,
      nodalLoads: model.nodalLoads,
      distributedLoads: model.distributedLoads,
    }),

  bulkImport: (nodes, elements) =>
    set((s) => ({
      nodes: [...s.nodes, ...nodes],
      elements: [...s.elements, ...elements],
    })),

  bulkImportFull: (nodes, elements, materials, sections) =>
    set((s) => {
      // Merge materials/sections, avoiding duplicates by ID
      const existingMatIds = new Set(s.materials.map((m) => m.id));
      const existingSecIds = new Set(s.sections.map((sec) => sec.id));
      return {
        nodes: [...s.nodes, ...nodes],
        elements: [...s.elements, ...elements],
        materials: [...s.materials, ...materials.filter((m) => !existingMatIds.has(m.id))],
        sections: [...s.sections, ...sections.filter((sec) => !existingSecIds.has(sec.id))],
      };
    }),

  clearModel: () =>
    set({
      nodes: [],
      elements: [],
      materials: [defaultSteel, defaultConcrete],
      sections: [defaultSection],
      supports: [],
      nodalLoads: [],
      distributedLoads: [],
    }),
}));

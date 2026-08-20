import { create } from 'zustand';
import type { AnimationMode } from '../utils/animation';
import type { HeatmapVariable, ColorScheme } from '../utils/color-ramp';
import type { UnitSystem } from '../utils/units';

export type ActivePanel = 'nodes' | 'elements' | 'materials' | 'sections' | 'loads' | 'supports' | 'results';
export type ViewMode = 'model' | 'deformed' | 'axial' | 'shear' | 'moment' | 'design';
export type RenderMode = 'wireframe' | 'sections';
export type DiagramType = 'none' | 'moment_M3' | 'shear_V2' | 'axial_N';
export type AppTheme = 'midnight' | 'forest' | 'ember' | 'orchid' | 'daylight' | 'snow';
export type CanvasTheme = 'deep-blue' | 'charcoal' | 'void' | 'graphite' | 'white' | 'paper';

const VALID_THEMES: AppTheme[] = ['midnight', 'forest', 'ember', 'orchid', 'daylight', 'snow'];
const VALID_CANVAS: CanvasTheme[] = ['deep-blue', 'charcoal', 'void', 'graphite', 'white', 'paper'];
const VALID_UNITS: UnitSystem[] = ['imperial', 'metric'];

function loadTheme(): AppTheme {
  const stored = localStorage.getItem('struxure-theme');
  return VALID_THEMES.includes(stored as AppTheme) ? (stored as AppTheme) : 'midnight';
}

function loadCanvasTheme(): CanvasTheme {
  const stored = localStorage.getItem('struxure-canvas');
  return VALID_CANVAS.includes(stored as CanvasTheme) ? (stored as CanvasTheme) : 'deep-blue';
}

function loadUnitSystem(): UnitSystem {
  const stored = localStorage.getItem('struxure-units');
  return VALID_UNITS.includes(stored as UnitSystem) ? (stored as UnitSystem) : 'imperial';
}

export const CANVAS_THEMES: Record<CanvasTheme, { label: string; bg: string; cell: string; section: string }> = {
  'deep-blue': { label: 'Deep Blue', bg: '#020617', cell: '#1e293b', section: '#334155' },
  'charcoal': { label: 'Charcoal', bg: '#111111', cell: '#222222', section: '#333333' },
  'void': { label: 'Void', bg: '#000000', cell: '#141414', section: '#1f1f1f' },
  'graphite': { label: 'Graphite', bg: '#1a1a2e', cell: '#2a2a3e', section: '#3a3a4e' },
  'white': { label: 'White', bg: '#ffffff', cell: '#e2e8f0', section: '#cbd5e1' },
  'paper': { label: 'Paper', bg: '#fafaf9', cell: '#e7e5e4', section: '#d6d3d1' },
};

function applyTheme(theme: AppTheme) {
  if (theme === 'midnight') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

interface UIState {
  activePanel: ActivePanel;
  viewMode: ViewMode;
  selectedNodeId: string | null;
  selectedElementId: string | null;
  showGrid: boolean;
  showNodeLabels: boolean;
  showElementLabels: boolean;
  showShearMoment: boolean;
  showDeformations: boolean;
  deformationScale: number;

  // Sidebar state
  sidebarCollapsed: boolean;

  // Render mode
  renderMode: RenderMode;

  // Heatmap state
  heatmapVariable: HeatmapVariable;
  heatmapScheme: ColorScheme;

  // Force diagram state
  diagramType: DiagramType;
  diagramScale: number;
  showDiagramValues: boolean;

  // Animation state
  animating: boolean;
  animationSpeed: number;
  animationMode: AnimationMode;

  // Unit system
  unitSystem: UnitSystem;

  // Theme
  theme: AppTheme;
  canvasTheme: CanvasTheme;

  // Model name (shown in status bar)
  modelName: string;

  setActivePanel: (panel: ActivePanel) => void;
  setViewMode: (mode: ViewMode) => void;
  selectNode: (id: string | null) => void;
  selectElement: (id: string | null) => void;
  toggleGrid: () => void;
  toggleNodeLabels: () => void;
  toggleElementLabels: () => void;
  toggleShearMoment: () => void;
  toggleDeformations: () => void;
  setDeformationScale: (scale: number) => void;
  toggleSidebar: () => void;
  setRenderMode: (mode: RenderMode) => void;
  setHeatmapVariable: (v: HeatmapVariable) => void;
  setHeatmapScheme: (s: ColorScheme) => void;
  setDiagramType: (t: DiagramType) => void;
  setDiagramScale: (s: number) => void;
  toggleDiagramValues: () => void;
  toggleAnimating: () => void;
  setAnimationSpeed: (speed: number) => void;
  setAnimationMode: (mode: AnimationMode) => void;
  setUnitSystem: (system: UnitSystem) => void;
  setTheme: (theme: AppTheme) => void;
  setCanvasTheme: (canvas: CanvasTheme) => void;
  setModelName: (name: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activePanel: 'nodes',
  viewMode: 'model',
  selectedNodeId: null,
  selectedElementId: null,
  showGrid: true,
  showNodeLabels: true,
  showElementLabels: false,
  showShearMoment: true,
  showDeformations: false,
  deformationScale: 50,

  // Sidebar default
  sidebarCollapsed: false,

  // Render mode default
  renderMode: 'wireframe',

  // Heatmap defaults
  heatmapVariable: 'none',
  heatmapScheme: 'jet',

  // Force diagram defaults
  diagramType: 'none' as DiagramType,
  diagramScale: 20,
  showDiagramValues: true,

  // Animation defaults
  animating: false,
  animationSpeed: 2.0,
  animationMode: 'oscillate',

  // Unit system (persisted)
  unitSystem: loadUnitSystem(),

  // Theme (persisted)
  theme: loadTheme(),
  canvasTheme: loadCanvasTheme(),

  // Model name
  modelName: '3D Building',

  setActivePanel: (panel) => set({ activePanel: panel }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectNode: (id) => set({ selectedNodeId: id, selectedElementId: null, ...(id ? { activePanel: 'nodes' } : {}) }),
  selectElement: (id) => set({ selectedElementId: id, selectedNodeId: null, ...(id ? { activePanel: 'elements' } : {}) }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleNodeLabels: () => set((s) => ({ showNodeLabels: !s.showNodeLabels })),
  toggleElementLabels: () => set((s) => ({ showElementLabels: !s.showElementLabels })),
  toggleShearMoment: () => set((s) => ({ showShearMoment: !s.showShearMoment })),
  toggleDeformations: () => set((s) => ({ showDeformations: !s.showDeformations })),
  setDeformationScale: (scale) => set({ deformationScale: scale }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setRenderMode: (mode) => set({ renderMode: mode }),
  setHeatmapVariable: (v) => set({ heatmapVariable: v }),
  setHeatmapScheme: (s) => set({ heatmapScheme: s }),
  setDiagramType: (t) => set({ diagramType: t }),
  setDiagramScale: (s) => set({ diagramScale: s }),
  toggleDiagramValues: () => set((s) => ({ showDiagramValues: !s.showDiagramValues })),
  toggleAnimating: () => set((s) => ({ animating: !s.animating })),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
  setAnimationMode: (mode) => set({ animationMode: mode }),
  setUnitSystem: (system) => {
    localStorage.setItem('struxure-units', system);
    set({ unitSystem: system });
  },
  setTheme: (theme) => {
    localStorage.setItem('struxure-theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  setCanvasTheme: (canvas) => {
    localStorage.setItem('struxure-canvas', canvas);
    set({ canvasTheme: canvas });
  },
  setModelName: (name) => set({ modelName: name }),
}));

// Apply initial theme on load
applyTheme(loadTheme());

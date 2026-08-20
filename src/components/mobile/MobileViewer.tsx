import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { NodeMesh } from '../viewport/NodeMesh';
import { ElementMesh } from '../viewport/ElementMesh';
import { SupportMesh } from '../viewport/SupportMesh';
import { LoadArrows } from '../viewport/LoadArrows';
import { DeformedShape } from '../viewport/DeformedShape';
import { useModelStore } from '../../store/model-store';
import { useUIStore, CANVAS_THEMES } from '../../store/ui-store';
import { useResultsStore } from '../../store/results-store';
import { TEMPLATES, getTemplateFromURL } from '../../utils/templates';
import { SolverManager } from '../../core/solver-manager';
import { solveModel } from '../../core/solver';
import { runDesign } from '../../design/design-runner';
import { InstallPrompt } from './InstallPrompt';
import { AboutDialog } from '../shared/AboutDialog';

type MobileTab = 'view' | 'results';

export function MobileViewer() {
  const loadModel = useModelStore((s) => s.loadModel);
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const modelName = useUIStore((s) => s.modelName);
  const canvasTheme = useUIStore((s) => s.canvasTheme);
  const canvasColors = CANVAS_THEMES[canvasTheme];
  const isAnalyzed = useResultsStore((s) => s.isAnalyzed);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>('results');
  const [showDeformed, setShowDeformed] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSections, setShowSections] = useState(true);
  const [currentTemplate, setCurrentTemplate] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const featuredTemplates = TEMPLATES.filter((t) => t.featured || t.id === 'portal-frame');

  // Load template from URL or default to Eiffel Tower, then auto-analyze
  useEffect(() => {
    const tpl = getTemplateFromURL() || TEMPLATES.find((t) => t.id === 'eiffel-tower');
    if (!tpl) return;
    loadModel(tpl.load());
    setTimeout(() => window.dispatchEvent(new Event('zoom-extents')), 100);

    // Auto-analyze after model loads
    const autoAnalyze = async () => {
      setIsAnalyzing(true);
      const model = useModelStore.getState().getModel();
      const { setAnalysisResults, setDesignResults, setSolving } = useResultsStore.getState();
      setSolving(true);
      try {
        const manager = new SolverManager();
        const results = await manager.solve(model);
        setAnalysisResults(results);
        try { setDesignResults(runDesign(model, results)); } catch { /* optional */ }
      } catch {
        try {
          const results = solveModel(model);
          setAnalysisResults(results);
          try { setDesignResults(runDesign(model, results)); } catch { /* optional */ }
        } catch { /* failed */ }
      } finally {
        setSolving(false);
        setIsAnalyzing(false);
      }
    };
    // Small delay so canvas renders first, then analyze
    setTimeout(autoAnalyze, 300);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoomExtents = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const allNodes = useModelStore.getState().nodes;
    if (allNodes.length === 0) return;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const n of allNodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
      minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
    }

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 20);
    const dist = size * 1.8;

    controls.target.set(cx, cy, cz);
    controls.object.position.set(cx + dist * 0.7, cy + dist * 0.5, cz + dist * 0.7);
    controls.update();
  }, []);

  useEffect(() => {
    const handler = () => setTimeout(handleZoomExtents, 50);
    window.addEventListener('zoom-extents', handler);
    return () => window.removeEventListener('zoom-extents', handler);
  }, [handleZoomExtents]);

  const handleNextTemplate = async () => {
    const next = (currentTemplate + 1) % featuredTemplates.length;
    setCurrentTemplate(next);
    loadModel(featuredTemplates[next].load());
    setShowDeformed(false);
    setShowHeatmap(true);
    setActiveTab('results');
    useResultsStore.getState().clearResults();
    setTimeout(() => window.dispatchEvent(new Event('zoom-extents')), 100);

    // Auto-analyze new template
    setIsAnalyzing(true);
    await new Promise((r) => setTimeout(r, 200));
    const model = useModelStore.getState().getModel();
    const { setAnalysisResults, setDesignResults, setSolving } = useResultsStore.getState();
    setSolving(true);
    try {
      const manager = new SolverManager();
      const results = await manager.solve(model);
      setAnalysisResults(results);
      try { setDesignResults(runDesign(model, results)); } catch { /* optional */ }
    } catch {
      try {
        const results = solveModel(model);
        setAnalysisResults(results);
        try { setDesignResults(runDesign(model, results)); } catch { /* optional */ }
      } catch { /* failed */ }
    } finally {
      setSolving(false);
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const model = useModelStore.getState().getModel();
    const { setAnalysisResults, setDesignResults, setSolving } = useResultsStore.getState();
    setSolving(true);

    try {
      const manager = new SolverManager();
      const results = await manager.solve(model);
      setAnalysisResults(results);
      try {
        setDesignResults(runDesign(model, results));
      } catch { /* Design is optional */ }
      setActiveTab('results');
    } catch {
      // Worker failed, fallback to main thread
      try {
        const results = solveModel(model);
        setAnalysisResults(results);
        try {
          setDesignResults(runDesign(model, results));
        } catch { /* Design is optional */ }
        setActiveTab('results');
      } catch { /* Analysis failed */ }
    } finally {
      setSolving(false);
      setIsAnalyzing(false);
    }
  };

  const viewMode = showHeatmap && isAnalyzed ? 'design' : showDeformed && isAnalyzed ? 'deformed' : 'model';

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center p-1">
            <img src={`${import.meta.env.BASE_URL}favicon_white.svg`} alt="Struxure" className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">STRUXURE</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">{modelName || 'Structural Model'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">{nodes.length}N / {elements.length}E</span>
          <button
            onClick={handleNextTemplate}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 active:bg-slate-700"
          >
            <span className="material-icons-round text-slate-300" style={{ fontSize: '18px' }}>swap_horiz</span>
          </button>
          <button
            onClick={() => setShowAbout(true)}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 active:bg-slate-700"
          >
            <span className="material-icons-round text-slate-300" style={{ fontSize: '18px' }}>info_outline</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [150, 100, 150], fov: 50, near: 0.1, far: 10000 }}
          style={{ background: canvasColors.bg }}
          gl={{ preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[50, 100, 50]} intensity={0.8} />
          <pointLight position={[-50, 50, -50]} intensity={0.3} />

          <Grid
            infiniteGrid
            cellSize={10}
            sectionSize={50}
            cellColor={canvasColors.cell}
            sectionColor={canvasColors.section}
            fadeDistance={500}
            fadeStrength={1}
          />

          <MobileScene viewMode={viewMode} showSections={showSections} />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.1}
            enableRotate
            enablePan
            enableZoom
          />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport axisHeadScale={0.8} />
          </GizmoHelper>
        </Canvas>

        {/* Zoom extents floating button */}
        <button
          onClick={handleZoomExtents}
          className="absolute top-3 left-3 p-2 rounded-lg bg-slate-800/90 backdrop-blur-md border border-slate-700 active:bg-slate-700 z-10"
        >
          <span className="material-icons-round text-slate-300" style={{ fontSize: '20px' }}>zoom_out_map</span>
        </button>

        {/* Analyzing overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center z-20">
            <div className="bg-slate-800 rounded-xl px-6 py-4 border border-slate-700 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-slate-200">Analyzing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-10">
        {/* Tab bar */}
        <div className="flex border-b border-slate-800">
          <TabButton label="View" icon="visibility" active={activeTab === 'view'} onClick={() => setActiveTab('view')} />
          <TabButton label="Results" icon="assessment" active={activeTab === 'results'} onClick={() => setActiveTab('results')} disabled={!isAnalyzed} />
        </div>

        {/* Tab content */}
        <div className="px-4 py-3">
          {activeTab === 'view' ? (
            <div className="flex items-center gap-2">
              <ToggleChip
                label="3D Sections"
                icon="view_in_ar"
                active={showSections}
                onClick={() => setShowSections(!showSections)}
              />
              <div className="flex-1" />
              {!isAnalyzed ? (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg active:opacity-80 disabled:opacity-50"
                >
                  <span className="material-icons-round" style={{ fontSize: '18px' }}>play_arrow</span>
                  Analyze
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="material-icons-round" style={{ fontSize: '14px' }}>check_circle</span>
                  Analyzed
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ToggleChip
                label="Deformed"
                icon="deblur"
                active={showDeformed}
                onClick={() => { setShowDeformed(!showDeformed); setShowHeatmap(false); }}
              />
              <ToggleChip
                label="D/C Ratio"
                icon="palette"
                active={showHeatmap}
                onClick={() => { setShowHeatmap(!showHeatmap); setShowDeformed(false); }}
              />
              <ToggleChip
                label="3D Sections"
                icon="view_in_ar"
                active={showSections}
                onClick={() => setShowSections(!showSections)}
              />
            </div>
          )}
        </div>

        <InstallPrompt />

        {/* Desktop CTA */}
        <div className="px-4 pb-3 pt-0">
          <p className="text-[10px] text-slate-500 text-center">
            Open on desktop for full editing, analysis &amp; export &middot;{' '}
            <span className="text-accent">alvarotech.dev/struxure</span>
            {' '}&middot; v{__APP_VERSION__}
          </p>
        </div>
      </div>

      {/* About dialog */}
      {showAbout && <AboutDialog variant="mobile" onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function MobileScene({ viewMode, showSections }: { viewMode: string; showSections: boolean }) {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const supports = useModelStore((s) => s.supports);
  const nodalLoads = useModelStore((s) => s.nodalLoads);
  const setRenderMode = useUIStore((s) => s.setRenderMode);

  useEffect(() => {
    setRenderMode(showSections ? 'sections' : 'wireframe');
  }, [showSections, setRenderMode]);

  const showDeformed = viewMode === 'deformed';

  return (
    <>
      {nodes.map((node) => (
        <NodeMesh key={node.id} node={node} />
      ))}
      {elements.map((element) => (
        <ElementMesh key={element.id} element={element} viewMode={viewMode} />
      ))}
      {supports.map((support) => (
        <SupportMesh key={support.nodeId} support={support} />
      ))}
      {nodalLoads.map((load) => (
        <LoadArrows key={load.id} load={load} />
      ))}
      {showDeformed && <DeformedShape viewMode={viewMode} />}
    </>
  );
}

function TabButton({ label, icon, active, onClick, disabled }: {
  label: string; icon: string; active: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors
        ${active ? 'text-accent border-b-2 border-accent' : disabled ? 'text-slate-600' : 'text-slate-400 active:text-slate-200'}`}
    >
      <span className="material-icons-round" style={{ fontSize: '16px' }}>{icon}</span>
      {label}
    </button>
  );
}

function ToggleChip({ label, icon, active, onClick }: {
  label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
        ${active
          ? 'bg-accent/20 text-accent border border-accent/40'
          : 'bg-slate-800 text-slate-400 border border-slate-700 active:bg-slate-700'
        }`}
    >
      <span className="material-icons-round" style={{ fontSize: '14px' }}>{icon}</span>
      {label}
    </button>
  );
}

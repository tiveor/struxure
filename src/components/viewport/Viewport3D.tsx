import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { MOUSE, Color } from 'three';
import { Tooltip } from '../shared/Tooltip';
import { NodeMesh } from './NodeMesh';
import { ElementMesh } from './ElementMesh';
import { LoadArrows } from './LoadArrows';
import { DeformedShape } from './DeformedShape';
import { ForceDiagram3D } from './ForceDiagram3D';
import { SupportMesh } from './SupportMesh';
import { useModelStore } from '../../store/model-store';
import { useUIStore, CANVAS_THEMES } from '../../store/ui-store';
import { useResultsStore } from '../../store/results-store';
import type { AnimationMode } from '../../utils/animation';
import { getSchemeColor } from '../../utils/color-ramp';
import type { HeatmapVariable, ColorScheme } from '../../utils/color-ramp';
import { track } from '../../utils/analytics';
import type { DiagramType } from '../../store/ui-store';

export function Viewport3D() {
  const showGrid = useUIStore((s) => s.showGrid);
  const viewMode = useUIStore((s) => s.viewMode);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const showNodeLabels = useUIStore((s) => s.showNodeLabels);
  const toggleNodeLabels = useUIStore((s) => s.toggleNodeLabels);
  const showShearMoment = useUIStore((s) => s.showShearMoment);
  const toggleShearMoment = useUIStore((s) => s.toggleShearMoment);
  const showDeformations = useUIStore((s) => s.showDeformations);
  const toggleDeformations = useUIStore((s) => s.toggleDeformations);
  const animating = useUIStore((s) => s.animating);
  const toggleAnimating = useUIStore((s) => s.toggleAnimating);
  const animationSpeed = useUIStore((s) => s.animationSpeed);
  const setAnimationSpeed = useUIStore((s) => s.setAnimationSpeed);
  const animationMode = useUIStore((s) => s.animationMode);
  const setAnimationMode = useUIStore((s) => s.setAnimationMode);
  const renderMode = useUIStore((s) => s.renderMode);
  const setRenderMode = useUIStore((s) => s.setRenderMode);
  const heatmapVariable = useUIStore((s) => s.heatmapVariable);
  const setHeatmapVariable = useUIStore((s) => s.setHeatmapVariable);
  const heatmapScheme = useUIStore((s) => s.heatmapScheme);
  const setHeatmapScheme = useUIStore((s) => s.setHeatmapScheme);
  const diagramType = useUIStore((s) => s.diagramType);
  const setDiagramType = useUIStore((s) => s.setDiagramType);
  const diagramScale = useUIStore((s) => s.diagramScale);
  const setDiagramScale = useUIStore((s) => s.setDiagramScale);
  const showDiagramValues = useUIStore((s) => s.showDiagramValues);
  const toggleDiagramValues = useUIStore((s) => s.toggleDiagramValues);
  const selectNode = useUIStore((s) => s.selectNode);
  const selectElement = useUIStore((s) => s.selectElement);
  const canvasTheme = useUIStore((s) => s.canvasTheme);
  const canvasColors = CANVAS_THEMES[canvasTheme];
  const isAnalyzed = useResultsStore((s) => s.isAnalyzed);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const screenshotFnRef = useRef<(() => void) | null>(null);
  const [interactionMode, setInteractionMode] = useState<'orbit' | 'pan'>('orbit');
  const [displayOpen, setDisplayOpen] = useState(true);

  const handleSetMode = (mode: 'orbit' | 'pan') => {
    setInteractionMode(mode);
    const controls = controlsRef.current;
    if (!controls) return;
    controls.mouseButtons = mode === 'pan'
      ? { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }
      : { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
  };

  const handleZoomExtents = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const nodes = useModelStore.getState().nodes;
    if (nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const n of nodes) {
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

  // Auto zoom extents when a model/template is loaded
  useEffect(() => {
    const handler = () => setTimeout(handleZoomExtents, 50);
    window.addEventListener('zoom-extents', handler);
    return () => window.removeEventListener('zoom-extents', handler);
  }, [handleZoomExtents]);

  const handleScreenshot = useCallback(() => {
    screenshotFnRef.current?.();
  }, []);

  const showDeformed = viewMode === 'deformed' || viewMode === 'moment' || viewMode === 'shear' || viewMode === 'axial';
  const canAnimate = isAnalyzed && showDeformed;

  return (
    <div className="relative w-full h-full bg-canvas">
      {/* Floating toolbar - top left */}
      <div className="absolute top-4 left-4 flex flex-col space-y-2 z-10">
        <div className="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl border border-slate-700 flex flex-col overflow-hidden">
          <ToolbarIconButton icon="3d_rotation" title="Orbit" onClick={() => handleSetMode('orbit')} active={interactionMode === 'orbit'} />
          <ToolbarIconButton icon="open_with" title="Pan" onClick={() => handleSetMode('pan')} active={interactionMode === 'pan'} />
          <ToolbarIconButton icon="zoom_out_map" title="Zoom Extents" onClick={handleZoomExtents} />
          <ToolbarIconButton icon="photo_camera" title="Screenshot" onClick={handleScreenshot} />
          <div className="h-px bg-slate-700 mx-2" />
          <ToolbarIconButton icon="grid_4x4" title="Toggle Grid" onClick={toggleGrid} active={showGrid} />
        </div>
      </div>

      {/* Display Settings - top right */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl border border-slate-700 w-52">
          <button
            className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-700/50 transition-colors rounded-lg"
            onClick={() => setDisplayOpen((v) => !v)}
          >
            <h4 className="text-[10px] font-bold text-slate-400 uppercase">Display Settings</h4>
            <span className="material-icons-round text-slate-400" style={{ fontSize: '16px' }}>
              {displayOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {displayOpen && (
            <div className="px-3 pb-3 space-y-2">
              <DisplayCheckbox label="Node IDs" checked={showNodeLabels} onChange={toggleNodeLabels} />
              <DisplayCheckbox label="Shear Moment" checked={showShearMoment} onChange={toggleShearMoment} />
              <DisplayCheckbox label="Deformations" checked={showDeformations} onChange={toggleDeformations} />
              <DisplayCheckbox
                label="3D Sections"
                checked={renderMode === 'sections'}
                onChange={() => setRenderMode(renderMode === 'sections' ? 'wireframe' : 'sections')}
              />

              {/* Heatmap Controls */}
              {isAnalyzed && (
                <>
                  <div className="h-px bg-slate-700 my-1" />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Heatmap</label>
                    <select
                      value={heatmapVariable}
                      onChange={(e) => setHeatmapVariable(e.target.value as HeatmapVariable)}
                      className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1 border border-slate-600"
                    >
                      <option value="none">None</option>
                      <option value="dc_ratio">D/C Ratio</option>
                      <option value="displacement">Displacement</option>
                      <option value="axial_stress">Axial Stress</option>
                      <option value="combined_stress">Combined Stress</option>
                    </select>
                    {heatmapVariable !== 'none' && (
                      <select
                        value={heatmapScheme}
                        onChange={(e) => setHeatmapScheme(e.target.value as ColorScheme)}
                        className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1 border border-slate-600"
                      >
                        <option value="jet">Jet (Classic)</option>
                        <option value="thermal">Thermal</option>
                        <option value="blueRed">Blue → Red</option>
                      </select>
                    )}
                  </div>

                  {/* Force Diagram Controls */}
                  <div className="h-px bg-slate-700 my-1" />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Diagram</label>
                    <select
                      value={diagramType}
                      onChange={(e) => setDiagramType(e.target.value as DiagramType)}
                      className="w-full bg-slate-700 text-xs text-slate-200 rounded px-2 py-1 border border-slate-600"
                    >
                      <option value="none">None</option>
                      <option value="moment_M3">Moment (M3)</option>
                      <option value="shear_V2">Shear (V2)</option>
                      <option value="axial_N">Axial (N)</option>
                    </select>
                    {diagramType !== 'none' && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-10">Scale</span>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={diagramScale}
                            onChange={(e) => setDiagramScale(parseInt(e.target.value))}
                            className="flex-1 accent-accent"
                          />
                        </div>
                        <DisplayCheckbox label="Show Values" checked={showDiagramValues} onChange={toggleDiagramValues} />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Color Legend - bottom right */}
      {heatmapVariable !== 'none' && isAnalyzed && (
        <ColorLegend scheme={heatmapScheme} variable={heatmapVariable} />
      )}

      {/* Animation Controls - bottom center */}
      {canAnimate && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl border border-slate-700 px-4 py-3 flex items-center gap-4">
            {/* Play/Pause */}
            <button
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                animating ? 'bg-accent text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => {
                if (!animating) track('animation_play');
                toggleAnimating();
              }}
              title={animating ? 'Pause animation' : 'Play animation'}
            >
              <span className="material-icons-round" style={{ fontSize: '20px' }}>
                {animating ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* Speed slider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold w-10">Speed</span>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.25"
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                className="w-20 accent-accent"
              />
              <span className="text-xs text-slate-300 w-8">{animationSpeed.toFixed(1)}x</span>
            </div>

            {/* Mode selector */}
            <select
              value={animationMode}
              onChange={(e) => setAnimationMode(e.target.value as AnimationMode)}
              className="bg-slate-700 text-xs text-slate-200 rounded px-2 py-1 border border-slate-600"
            >
              <option value="oscillate">Oscillate</option>
              <option value="pulse">Pulse</option>
              <option value="progressive">Progressive</option>
            </select>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [150, 100, 150], fov: 50, near: 0.1, far: 10000 }}
        gl={{ preserveDrawingBuffer: true }}
        className="canvas-grid"
        style={{ background: canvasColors.bg }}
        onPointerMissed={() => { selectNode(null); selectElement(null); }}
      >
        <ScreenshotHelper fnRef={screenshotFnRef} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 100, 50]} intensity={0.8} />
        <pointLight position={[-50, 50, -50]} intensity={0.3} />

        {showGrid && (
          <Grid
            infiniteGrid
            cellSize={10}
            sectionSize={50}
            cellColor={canvasColors.cell}
            sectionColor={canvasColors.section}
            fadeDistance={500}
            fadeStrength={1}
          />
        )}

        <SceneContent viewMode={viewMode} />

        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.1} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}

function ToolbarIconButton({ icon, title, onClick, active }: { icon: string; title: string; onClick?: () => void; active?: boolean }) {
  return (
    <Tooltip label={title} position="right">
      <button
        className={`p-2 hover:bg-slate-700 transition-colors cursor-pointer ${
          active ? 'text-accent' : 'text-slate-300'
        }`}
        onClick={onClick}
      >
        <span className="material-icons-round text-xl">{icon}</span>
      </button>
    </Tooltip>
  );
}

function DisplayCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded text-accent focus:ring-accent h-4 w-4 bg-transparent border-slate-400"
      />
      <span className="text-xs font-medium text-slate-200">{label}</span>
    </label>
  );
}

const HEATMAP_LABELS: Record<HeatmapVariable, string> = {
  none: '',
  dc_ratio: 'D/C Ratio',
  displacement: 'Displ.',
  axial_stress: 'Axial',
  combined_stress: 'Combined',
};

function ColorLegend({ scheme, variable }: { scheme: ColorScheme; variable: HeatmapVariable }) {
  const steps = 10;
  return (
    <div className="absolute bottom-6 left-4 z-10">
      <div className="bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl border border-slate-700 p-3 w-16">
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 text-center leading-tight">
          {HEATMAP_LABELS[variable]}
        </p>
        <div className="flex flex-col-reverse">
          {Array.from({ length: steps + 1 }, (_, i) => {
            const t = i / steps;
            const { r, g, b } = getSchemeColor(scheme, t);
            return (
              <div
                key={i}
                className="h-3 w-full"
                style={{ backgroundColor: `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-slate-400">Min</span>
          <span className="text-[8px] text-slate-400">Max</span>
        </div>
      </div>
    </div>
  );
}

function ScreenshotHelper({ fnRef }: { fnRef: React.RefObject<(() => void) | null> }) {
  const { gl, scene, camera } = useThree();
  const modelName = useUIStore((s) => s.modelName);
  const canvasTheme = useUIStore((s) => s.canvasTheme);
  const canvasColors = CANVAS_THEMES[canvasTheme];

  // Intentionally no dependency array, so the closure always captures the
  // latest gl/scene/camera, canvasColors and modelName. A dependency array
  // would freeze it on its first values and silently capture a stale theme.
  // This is cheap: useThree() without a selector re-renders only when r3f
  // calls set() (resize, DPR change, controls reconnect), never per frame.
  useEffect(() => {
    fnRef.current = () => {
      const prevBg = scene.background;
      scene.background = new Color(canvasColors.bg);

      // High-quality capture: bump pixel ratio to 2x device ratio
      const prevPixelRatio = gl.getPixelRatio();
      const hiResRatio = Math.max(prevPixelRatio, window.devicePixelRatio * 2);
      gl.setPixelRatio(hiResRatio);
      const { width, height } = gl.domElement.getBoundingClientRect();
      gl.setSize(width, height, false);

      // Render only the main scene (no gizmo overlay) and capture immediately
      gl.autoClear = true;
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/png');

      // Restore state
      scene.background = prevBg;
      gl.setPixelRatio(prevPixelRatio);
      gl.setSize(width, height, false);

      const link = document.createElement('a');
      link.download = `Structural Analysis - ${modelName || 'New'}.png`;
      link.href = dataUrl;
      link.click();
    };
  });
  return null;
}

function SceneContent({ viewMode }: { viewMode: string }) {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const supports = useModelStore((s) => s.supports);
  const nodalLoads = useModelStore((s) => s.nodalLoads);

  const showDeformed = viewMode === 'deformed' || viewMode === 'moment' || viewMode === 'shear' || viewMode === 'axial';

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
      <ForceDiagram3D />
    </>
  );
}

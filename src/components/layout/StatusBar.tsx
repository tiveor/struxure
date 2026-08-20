import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useResultsStore } from '../../store/results-store';
import { useUIStore, CANVAS_THEMES } from '../../store/ui-store';
import type { AppTheme, CanvasTheme } from '../../store/ui-store';
import { systemLabel } from '../../utils/units';
import type { UnitSystem } from '../../utils/units';
import { track } from '../../utils/analytics';

const UNIT_OPTIONS: { key: UnitSystem; icon: string }[] = [
  { key: 'imperial', icon: 'straighten' },
  { key: 'metric', icon: 'square_foot' },
];

const THEME_OPTIONS: { key: AppTheme; label: string; color: string }[] = [
  { key: 'midnight', label: 'Midnight', color: '#3b82f6' },
  { key: 'forest', label: 'Forest', color: '#06b6d4' },
  { key: 'ember', label: 'Ember', color: '#f59e0b' },
  { key: 'orchid', label: 'Orchid', color: '#a855f7' },
  { key: 'daylight', label: 'Daylight', color: '#2563eb' },
  { key: 'snow', label: 'Snow', color: '#059669' },
];

const CANVAS_OPTIONS: { key: CanvasTheme; color: string }[] = [
  { key: 'deep-blue', color: '#020617' },
  { key: 'charcoal', color: '#111111' },
  { key: 'void', color: '#000000' },
  { key: 'graphite', color: '#1a1a2e' },
  { key: 'white', color: '#ffffff' },
  { key: 'paper', color: '#fafaf9' },
];

export function StatusBar() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const materials = useModelStore((s) => s.materials);
  const isAnalyzed = useResultsStore((s) => s.isAnalyzed);
  const isDesigned = useResultsStore((s) => s.isDesigned);
  const analysisError = useResultsStore((s) => s.analysisError);
  const unitSystem = useUIStore((s) => s.unitSystem);
  const setUnitSystem = useUIStore((s) => s.setUnitSystem);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const canvasTheme = useUIStore((s) => s.canvasTheme);
  const setCanvasTheme = useUIStore((s) => s.setCanvasTheme);
  const modelName = useUIStore((s) => s.modelName);

  const [showUnits, setShowUnits] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);

  let statusLabel = 'SYSTEM READY';
  let statusColor = 'text-accent-success';
  let statusIcon = 'check_circle';
  if (analysisError) {
    statusLabel = analysisError.length > 80 ? analysisError.slice(0, 80) + '…' : analysisError;
    statusColor = 'text-accent-error';
    statusIcon = 'error';
  } else if (isDesigned) {
    statusLabel = 'ANALYZED & DESIGNED';
    statusColor = 'text-accent-success';
  } else if (isAnalyzed) {
    statusLabel = 'ANALYZED';
    statusColor = 'text-accent-success';
  }

  return (
    <footer className="h-8 border-t border-slate-800 bg-surface-1 flex items-center justify-between px-4 text-[10px] font-medium text-slate-500 shrink-0 z-30 uppercase tracking-wide">
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-1.5 text-accent">
          <span className="material-icons-round" style={{ fontSize: '14px' }}>description</span>
          {modelName}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-success" />
          Nodes: {nodes.length}
        </span>
        <span>Elements: {elements.length}</span>
        <span>Materials: {materials.length}</span>

        {/* Unit switcher */}
        <span className="relative">
          <span
            className="flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors"
            onClick={() => setShowUnits(!showUnits)}
          >
            <span className="material-icons-round" style={{ fontSize: '14px' }}>straighten</span>
            Units: {systemLabel(unitSystem)}
            <span className="material-icons-round" style={{ fontSize: '12px' }}>
              {showUnits ? 'expand_less' : 'expand_more'}
            </span>
          </span>
          {showUnits && (
            <div className="fixed inset-0 z-50" onClick={() => setShowUnits(false)}>
              <div
                className="absolute bottom-10 left-0 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 w-56"
                style={{ left: 'var(--unit-popup-left)' }}
                ref={(el) => {
                  if (el) {
                    const parent = el.parentElement?.parentElement;
                    if (parent) {
                      const rect = parent.getBoundingClientRect();
                      el.style.left = `${rect.left}px`;
                      el.style.bottom = `${window.innerHeight - rect.top + 4}px`;
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {UNIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      unitSystem === opt.key
                        ? 'bg-accent/10 text-accent'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    onClick={() => {
                      setUnitSystem(opt.key);
                      setShowUnits(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="material-icons-round" style={{ fontSize: '14px' }}>{opt.icon}</span>
                      {systemLabel(opt.key)}
                    </span>
                    {unitSystem === opt.key && (
                      <span className="material-icons-round text-accent" style={{ fontSize: '14px' }}>check</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {/* UI Theme picker */}
        <span className="relative">
          <span
            className="flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors"
            onClick={() => setShowTheme(!showTheme)}
          >
            <span className="material-icons-round" style={{ fontSize: '14px' }}>palette</span>
            UI Theme: {THEME_OPTIONS.find((t) => t.key === theme)?.label ?? 'Midnight'}
            <span className="material-icons-round" style={{ fontSize: '12px' }}>
              {showTheme ? 'expand_less' : 'expand_more'}
            </span>
          </span>
          {showTheme && (
            <div className="fixed inset-0 z-50" onClick={() => setShowTheme(false)}>
              <div
                className="absolute bottom-10 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 w-48"
                ref={(el) => {
                  if (el) {
                    const parent = el.parentElement?.parentElement;
                    if (parent) {
                      const rect = parent.getBoundingClientRect();
                      el.style.right = `${window.innerWidth - rect.right}px`;
                      el.style.bottom = `${window.innerHeight - rect.top + 4}px`;
                      el.style.left = 'auto';
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      theme === opt.key
                        ? 'bg-accent/10 text-accent'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    onClick={() => {
                      track('theme_switch', { theme: opt.key });
                      setTheme(opt.key);
                      setShowTheme(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-600" style={{ backgroundColor: opt.color }} />
                      {opt.label}
                    </span>
                    {theme === opt.key && (
                      <span className="material-icons-round text-accent" style={{ fontSize: '14px' }}>check</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </span>

        {/* 3D Canvas theme picker */}
        <span className="relative">
          <span
            className="flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors"
            onClick={() => setShowCanvas(!showCanvas)}
          >
            <span className="material-icons-round" style={{ fontSize: '14px' }}>view_in_ar</span>
            3D: {CANVAS_THEMES[canvasTheme].label}
            <span className="material-icons-round" style={{ fontSize: '12px' }}>
              {showCanvas ? 'expand_less' : 'expand_more'}
            </span>
          </span>
          {showCanvas && (
            <div className="fixed inset-0 z-50" onClick={() => setShowCanvas(false)}>
              <div
                className="absolute bottom-10 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 w-48"
                ref={(el) => {
                  if (el) {
                    const parent = el.parentElement?.parentElement;
                    if (parent) {
                      const rect = parent.getBoundingClientRect();
                      el.style.right = `${window.innerWidth - rect.right}px`;
                      el.style.bottom = `${window.innerHeight - rect.top + 4}px`;
                      el.style.left = 'auto';
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {CANVAS_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      canvasTheme === opt.key
                        ? 'bg-accent/10 text-accent'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    onClick={() => {
                      track('canvas_switch', { canvas: opt.key });
                      setCanvasTheme(opt.key);
                      setShowCanvas(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm border border-slate-600" style={{ backgroundColor: opt.color }} />
                      {CANVAS_THEMES[opt.key].label}
                    </span>
                    {canvasTheme === opt.key && (
                      <span className="material-icons-round text-accent" style={{ fontSize: '14px' }}>check</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </span>

        <span className="flex items-center gap-1">
          <span className="material-icons-round" style={{ fontSize: '14px' }}>info</span>
          v{__APP_VERSION__}
        </span>
        <span className={`flex items-center gap-1 ${statusColor}`}>
          <span className="material-icons-round" style={{ fontSize: '14px' }}>{statusIcon}</span>
          {statusLabel}
        </span>
      </div>
    </footer>
  );
}

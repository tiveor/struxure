import { useRef, useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useResultsStore } from '../../store/results-store';
import { useUIStore } from '../../store/ui-store';
import { solveModel } from '../../core/solver';
import { SolverManager } from '../../core/solver-manager';
import { runDesign } from '../../design/design-runner';
import { exportModelJSON, exportResultsCSV } from '../../utils/export';
import { generateReport, captureDesignScreenshot } from '../../utils/report-generator';
import { exportResultsToIfc } from '../../utils/ifc-export';
import { importIfc } from '../../utils/ifc-import';
import type { IfcImportResult } from '../../utils/ifc-import';
import { TEMPLATES } from '../../utils/templates';
import { track } from '../../utils/analytics';
import { AboutDialog } from '../shared/AboutDialog';
import { AnalysisProgress } from '../shared/AnalysisProgress';
import { IfcImportDialog } from '../shared/IfcImportDialog';
import { ReportDialog } from '../shared/ReportDialog';

export function Toolbar() {
  const getModel = useModelStore((s) => s.getModel);
  const loadModel = useModelStore((s) => s.loadModel);
  const clearModel = useModelStore((s) => s.clearModel);
  const bulkImportFull = useModelStore((s) => s.bulkImportFull);
  const setAnalysisResults = useResultsStore((s) => s.setAnalysisResults);
  const setDesignResults = useResultsStore((s) => s.setDesignResults);
  const setAnalysisError = useResultsStore((s) => s.setAnalysisError);
  const setSolving = useResultsStore((s) => s.setSolving);
  const setSolverProgress = useResultsStore((s) => s.setSolverProgress);
  const clearResults = useResultsStore((s) => s.clearResults);
  const setModelName = useUIStore((s) => s.setModelName);
  const modelName = useUIStore((s) => s.modelName);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const isAnalyzed = useResultsStore((s) => s.isAnalyzed);
  const isSolving = useResultsStore((s) => s.isSolving);
  const solverRef = useRef<SolverManager | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [ifcPending, setIfcPending] = useState<{ result: IfcImportResult; fileName: string } | null>(null);

  const handleAnalyze = async () => {
    track('analyze');
    const model = getModel();

    // Pre-flight validation with helpful hints
    const missing: string[] = [];
    if (model.nodes.length === 0) missing.push('nodes');
    if (model.elements.length === 0) missing.push('elements');
    if (model.supports.length === 0) missing.push('supports (boundary conditions)');
    if (model.nodalLoads.length === 0 && model.distributedLoads.length === 0)
      missing.push('loads (nodal or distributed)');

    if (missing.length > 0) {
      setAnalysisError(
        `Cannot analyze: model is missing ${missing.join(', ')}. Add them in the Model tab before analyzing.`,
      );
      return;
    }

    // Try Web Worker first, fallback to synchronous
    const manager = new SolverManager();
    solverRef.current = manager;
    manager.onProgress = (step, progress) => {
      setSolverProgress(step, progress);
    };
    setSolving(true);

    try {
      const results = await manager.solve(model);
      setAnalysisResults(results);
      try {
        const designResults = runDesign(model, results);
        setDesignResults(designResults);
      } catch {
        // Design is optional
      }
    } catch {
      // Worker failed, fallback to main thread
      try {
        const results = solveModel(model);
        setAnalysisResults(results);
        try {
          const designResults = runDesign(model, results);
          setDesignResults(designResults);
        } catch {
          // Design is optional
        }
      } catch (err) {
        setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
      }
    } finally {
      solverRef.current = null;
    }
  };

  const handleCancelAnalysis = () => {
    solverRef.current?.cancel();
    solverRef.current = null;
    setSolving(false);
  };

  const handleNew = () => {
    clearModel();
    clearResults();
    setModelName('New');
  };

  const handleExport = () => {
    const model = getModel();
    exportModelJSON(model, modelName);
  };

  const handleExportResults = () => {
    const results = useResultsStore.getState();
    if (results.analysisResults) {
      exportResultsCSV(results.analysisResults, getModel(), modelName);
    }
  };

  const handleLoadTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    track('template_load', { template: tpl.name });
    loadModel(tpl.load());
    setModelName(tpl.name);
    clearResults();
    setShowTemplates(false);
    window.dispatchEvent(new Event('zoom-extents'));
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ifc';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.name.toLowerCase().endsWith('.ifc')) {
        try {
          const buffer = await file.arrayBuffer();
          const result = await importIfc(new Uint8Array(buffer));
          track('open_ifc');
          setIfcPending({ result, fileName: file.name });
        } catch (err) {
          alert(`Failed to parse IFC: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const model = JSON.parse(reader.result as string);
          track('open_file');
          loadModel(model);
          setModelName(file.name.replace(/\.json$/i, ''));
          clearResults();
          window.dispatchEvent(new Event('zoom-extents'));
        } catch {
          alert('Invalid model file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const isModelView = viewMode === 'model';

  return (
    <header className="h-14 border-b border-slate-800 bg-surface-1 flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left: Brand + Nav */}
      <div className="flex items-center gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded flex items-center justify-center p-1">
            <img src={`${import.meta.env.BASE_URL}favicon_white.svg`} alt="Struxure" className="w-full h-full" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-100">STRUXURE</span>
          <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">v{__APP_VERSION__}</span>
        </div>

        {/* File navigation */}
        <nav className="flex items-center gap-1 text-sm font-medium">
          <NavButton icon="note_add" label="New" onClick={handleNew} />
          <NavButton icon="folder_open" label="Open" onClick={handleImport} />
          <NavButton icon="save" label="Save" onClick={handleExport} />
          <div className="h-4 w-px bg-slate-700 mx-2" />
          <NavButton icon="widgets" label="Templates" onClick={() => setShowTemplates(!showTemplates)} />
        </nav>
      </div>

      {/* Right: View toggle + Analyze + Settings */}
      <div className="flex items-center gap-4">
        {/* Model / Results toggle */}
        <div className="flex bg-slate-900 p-1 rounded-lg">
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
              isModelView
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => setViewMode('model')}
          >
            Model
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
              !isModelView
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => {
              if (isAnalyzed) {
                track('results_tab');
                setViewMode('moment');
              }
            }}
          >
            Results
          </button>
        </div>

        {/* Analyze button */}
        <button
          className="flex items-center gap-2 bg-accent hover:bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAnalyze}
          disabled={isSolving}
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>
            {isSolving ? 'hourglass_empty' : 'play_arrow'}
          </span>
          {isSolving ? 'Solving...' : 'Analyze'}
        </button>

        {/* Export options (only when analyzed) */}
        {isAnalyzed && (
          <div className="flex items-center gap-1">
            <button
              className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer"
              onClick={handleExportResults}
              title="Export CSV"
            >
              <span className="material-icons-round" style={{ fontSize: '22px' }}>download</span>
            </button>
            <button
              className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer"
              onClick={() => setShowReportDialog(true)}
              title="Export PDF Report"
            >
              <span className="material-icons-round" style={{ fontSize: '22px' }}>picture_as_pdf</span>
            </button>
            <button
              className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer"
              onClick={async () => {
                track('export_ifc');
                const model = getModel();
                const { analysisResults } = useResultsStore.getState();
                const buffer = await exportResultsToIfc(model, analysisResults);
                const blob = new Blob([buffer], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Structural Analysis - ${modelName || 'New'}.ifc`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="Export IFC"
            >
              <span className="material-icons-round" style={{ fontSize: '22px' }}>apartment</span>
            </button>
          </div>
        )}

        {/* About */}
        <button
          className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer"
          onClick={() => setShowAbout(true)}
          title="About Struxure"
        >
          <span className="material-icons-round" style={{ fontSize: '22px' }}>info_outline</span>
        </button>
      </div>

      {/* Analysis progress overlay */}
      {isSolving && <AnalysisProgress onCancel={handleCancelAnalysis} />}

      {/* About dialog */}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}

      {/* Template picker */}
      {showTemplates && (
        <div className="fixed inset-0 z-40" onClick={() => setShowTemplates(false)}>
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 w-[520px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-2 pb-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase">Load Template</h3>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleLoadTemplate(t.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left cursor-pointer group ${
                    t.featured ? 'col-span-2 bg-slate-800/50 border border-blue-500/20' : ''
                  }`}
                >
                  <span
                    className={`material-icons-round mt-0.5 ${
                      t.featured ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                    style={{ fontSize: '20px' }}
                  >
                    {t.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm ${t.featured ? 'text-blue-300' : 'text-slate-200'}`}>
                        {t.name}
                      </p>
                      {t.featured && (
                        <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* IFC import dialog */}
      {ifcPending && (
        <IfcImportDialog
          result={ifcPending.result}
          fileName={ifcPending.fileName}
          onConfirm={() => {
            const { result, fileName } = ifcPending;
            bulkImportFull(result.nodes, result.elements, result.materials, result.sections);
            setModelName(fileName.replace(/\.ifc$/i, ''));
            clearResults();
            setIfcPending(null);
            window.dispatchEvent(new Event('zoom-extents'));
          }}
          onCancel={() => setIfcPending(null)}
        />
      )}

      {/* Report dialog */}
      {showReportDialog && (
        <ReportDialog
          onClose={() => setShowReportDialog(false)}
          onGenerate={async (opts) => {
            track('export_pdf');
            const model = getModel();
            const { analysisResults, designResults } = useResultsStore.getState();
            const screenshot = await captureDesignScreenshot();
            const blob = await generateReport(model, analysisResults, designResults, {
              ...opts,
              screenshot: screenshot ?? undefined,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Structural Analysis - ${opts.projectName || modelName || 'New'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            setShowReportDialog(false);
          }}
        />
      )}
    </header>
  );
}

function NavButton({ icon, label, onClick }: { icon?: string; label: string; onClick: () => void }) {
  return (
    <button
      className="px-3 py-1.5 hover:bg-slate-700 rounded transition-colors flex items-center gap-1.5 text-slate-300 cursor-pointer"
      onClick={onClick}
    >
      {icon && <span className="material-icons-round" style={{ fontSize: '18px' }}>{icon}</span>}
      {label}
    </button>
  );
}

import { useState } from 'react';
import { useResultsStore } from '../../store/results-store';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, toDisplay } from '../../utils/units';
import { exportResultsCSV } from '../../utils/export';
import { track } from '../../utils/analytics';

type ResultTab = 'shear' | 'moment' | 'deflection';

export function ResultsBar() {
  const analysisResults = useResultsStore((s) => s.analysisResults);
  const isAnalyzed = useResultsStore((s) => s.isAnalyzed);
  const elements = useModelStore((s) => s.elements);
  const nodes = useModelStore((s) => s.nodes);
  const getModel = useModelStore((s) => s.getModel);
  const unitSystem = useUIStore((s) => s.unitSystem);
  const [activeTab, setActiveTab] = useState<ResultTab>('shear');

  if (!isAnalyzed || !analysisResults) return null;

  // Compute per-element shear and moment values
  const shearValues: { id: string; value: number }[] = [];
  const momentValues: { id: string; value: number }[] = [];

  elements.forEach((elem) => {
    const f = analysisResults.elementForces.get(elem.id);
    if (!f) return;
    shearValues.push({ id: elem.id, value: Math.abs(f.startForces[1]) });
    momentValues.push({ id: elem.id, value: Math.abs(f.startForces[5]) });
  });

  // Compute per-node deflection (resultant displacement)
  const deflectionValues: { id: string; value: number }[] = [];

  nodes.forEach((node) => {
    const d = analysisResults.nodeDisplacements.get(node.id);
    if (!d) return;
    const resultant = Math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2);
    deflectionValues.push({ id: node.id, value: resultant });
  });

  // Find max values for each type
  const maxShearEntry = shearValues.reduce((max, v) => (v.value > max.value ? v : max), { id: '', value: 0 });
  const maxMomentEntry = momentValues.reduce((max, v) => (v.value > max.value ? v : max), { id: '', value: 0 });
  const maxDeflectionEntry = deflectionValues.reduce((max, v) => (v.value > max.value ? v : max), { id: '', value: 0 });

  // Select data based on active tab
  const tabConfig = {
    shear: {
      summaryLabel: 'Max Shear (V-Y)',
      summaryValue: maxShearEntry.value,
      summaryId: maxShearEntry.id,
      summaryIdLabel: 'Element',
      summaryQty: 'force' as const,
      summaryColor: 'text-accent',
      secondaryLabel: 'Max Moment (M-Z)',
      secondaryValue: maxMomentEntry.value,
      secondaryId: maxMomentEntry.id,
      secondaryIdLabel: 'Element',
      secondaryQty: 'moment' as const,
      secondaryColor: 'text-accent-success',
      barData: shearValues,
      barQty: 'force' as const,
      barColor: 'bg-accent/20 hover:bg-accent/40',
    },
    moment: {
      summaryLabel: 'Max Moment (M-Z)',
      summaryValue: maxMomentEntry.value,
      summaryId: maxMomentEntry.id,
      summaryIdLabel: 'Element',
      summaryQty: 'moment' as const,
      summaryColor: 'text-accent-success',
      secondaryLabel: 'Max Shear (V-Y)',
      secondaryValue: maxShearEntry.value,
      secondaryId: maxShearEntry.id,
      secondaryIdLabel: 'Element',
      secondaryQty: 'force' as const,
      secondaryColor: 'text-accent',
      barData: momentValues,
      barQty: 'moment' as const,
      barColor: 'bg-green-500/20 hover:bg-green-500/40',
    },
    deflection: {
      summaryLabel: 'Max Deflection',
      summaryValue: maxDeflectionEntry.value,
      summaryId: maxDeflectionEntry.id,
      summaryIdLabel: 'Node',
      summaryQty: 'displacement' as const,
      summaryColor: 'text-amber-400',
      secondaryLabel: 'Max Moment (M-Z)',
      secondaryValue: maxMomentEntry.value,
      secondaryId: maxMomentEntry.id,
      secondaryIdLabel: 'Element',
      secondaryQty: 'moment' as const,
      secondaryColor: 'text-accent-success',
      barData: deflectionValues,
      barQty: 'displacement' as const,
      barColor: 'bg-amber-500/20 hover:bg-amber-500/40',
    },
  };

  const cfg = tabConfig[activeTab];
  const maxBar = Math.max(...cfg.barData.map((d) => d.value), 1e-12);

  const handleExportCSV = () => {
    exportResultsCSV(analysisResults, getModel());
  };

  const tabs: { key: ResultTab; label: string }[] = [
    { key: 'shear', label: 'SHEAR-Y' },
    { key: 'moment', label: 'MOMENT-Z' },
    { key: 'deflection', label: 'DEFLECTION' },
  ];

  return (
    <div className="h-48 border-t border-slate-800 bg-surface-1 flex flex-col shrink-0">
      {/* Tab header */}
      <div className="flex items-center px-4 py-2 border-b border-slate-800 justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-xs font-bold text-slate-400 uppercase">Results Analysis</span>
          <div className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-slate-700 text-slate-300'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
                onClick={() => {
                  track('results_switch', { tab: tab.key });
                  setActiveTab(tab.key);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          className="flex items-center gap-1 text-[10px] font-bold text-accent hover:underline cursor-pointer"
          onClick={handleExportCSV}
        >
          <span className="material-icons-round text-sm">download</span> EXPORT CSV
        </button>
      </div>

      {/* Results content */}
      <div className="flex-1 overflow-x-auto p-4 flex space-x-8">
        {/* Primary summary */}
        <div className="min-w-[180px] h-full flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">{cfg.summaryLabel}</span>
          <div className={`text-2xl font-mono font-semibold ${cfg.summaryColor}`}>
            {toDisplay(cfg.summaryValue, cfg.summaryQty, unitSystem).toFixed(1)}{' '}
            <span className="text-xs font-sans text-slate-500">{unitLabel(cfg.summaryQty, unitSystem)}</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">at {cfg.summaryIdLabel} {cfg.summaryId}</span>
        </div>

        <div className="w-px h-full bg-slate-800" />

        {/* Secondary summary */}
        <div className="min-w-[180px] h-full flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">{cfg.secondaryLabel}</span>
          <div className={`text-2xl font-mono font-semibold ${cfg.secondaryColor}`}>
            {toDisplay(cfg.secondaryValue, cfg.secondaryQty, unitSystem).toFixed(1)}{' '}
            <span className="text-xs font-sans text-slate-500">{unitLabel(cfg.secondaryQty, unitSystem)}</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">at {cfg.secondaryIdLabel} {cfg.secondaryId}</span>
        </div>

        {/* Bar chart */}
        <div className="flex-1 flex items-center space-x-1 h-full py-4">
          <div className="w-full h-full flex items-end space-x-1.5 px-4">
            {cfg.barData.map((d, i) => (
              <div
                key={i}
                className={`flex-1 ${cfg.barColor} rounded-t transition-colors`}
                style={{ height: `${(d.value / maxBar) * 100}%` }}
                title={`${d.id}: ${toDisplay(d.value, cfg.barQty, unitSystem).toFixed(1)} ${unitLabel(cfg.barQty, unitSystem)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

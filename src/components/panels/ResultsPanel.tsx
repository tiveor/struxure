import { useResultsStore } from '../../store/results-store';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, toDisplay } from '../../utils/units';

export function ResultsPanel() {
  const analysisResults = useResultsStore((s) => s.analysisResults);
  const designResults = useResultsStore((s) => s.designResults);
  const isAnalyzed = useResultsStore((s) => s.isAnalyzed);
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const unitSystem = useUIStore((s) => s.unitSystem);

  if (!isAnalyzed || !analysisResults) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="material-icons-round text-slate-500 mb-3" style={{ fontSize: '32px' }}>bar_chart</span>
        <p className="text-sm text-slate-400 font-medium">No results yet</p>
        <p className="text-xs text-slate-500 mt-1">Run analysis to see results</p>
      </div>
    );
  }

  const dispUnit = unitLabel('displacement', unitSystem);
  const forceUnit = unitLabel('force', unitSystem);
  const momentUnit = unitLabel('moment', unitSystem);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Node Displacements */}
        <ResultTable title="Node Displacements" columns={['Node', `ux (${dispUnit})`, `uy (${dispUnit})`, `uz (${dispUnit})`]}>
          {nodes.map((node) => {
            const d = analysisResults.nodeDisplacements.get(node.id);
            if (!d) return null;
            return (
              <tr key={node.id} className="hover:bg-slate-800 transition-colors">
                <td className="px-4 py-2 font-mono font-bold text-accent">{node.id}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(d[0], 'displacement', unitSystem).toExponential(3)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(d[1], 'displacement', unitSystem).toExponential(3)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(d[2], 'displacement', unitSystem).toExponential(3)}</td>
              </tr>
            );
          })}
        </ResultTable>

        {/* Reactions */}
        <ResultTable title="Reactions" columns={['Node', `Rx (${forceUnit})`, `Ry (${forceUnit})`, `Rz (${forceUnit})`]}>
          {Array.from(analysisResults.reactions.entries()).map(([nodeId, r]) => (
            <tr key={nodeId} className="hover:bg-slate-800 transition-colors">
              <td className="px-4 py-2 font-mono font-bold text-accent">{nodeId}</td>
              <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(r[0], 'force', unitSystem).toFixed(3)}</td>
              <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(r[1], 'force', unitSystem).toFixed(3)}</td>
              <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(r[2], 'force', unitSystem).toFixed(3)}</td>
            </tr>
          ))}
        </ResultTable>

        {/* Element Forces */}
        <ResultTable title="Element Forces" columns={['Elem', `Axial (${forceUnit})`, `Shear Y (${forceUnit})`, `Moment Z (${momentUnit})`]}>
          {elements.map((elem) => {
            const f = analysisResults.elementForces.get(elem.id);
            if (!f) return null;
            return (
              <tr key={elem.id} className="hover:bg-slate-800 transition-colors">
                <td className="px-4 py-2 font-mono font-bold text-accent">{elem.id}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(f.startForces[0], 'force', unitSystem).toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(f.startForces[1], 'force', unitSystem).toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-400">{toDisplay(f.startForces[5], 'moment', unitSystem).toFixed(2)}</td>
              </tr>
            );
          })}
        </ResultTable>

        {/* Design Results */}
        {designResults.length > 0 && (
          <div className="p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Design Results (D/C)</h3>
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-1 shadow-sm">
                <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                  <th className="px-4 py-2">Element</th>
                  <th className="px-4 py-2">Material</th>
                  <th className="px-4 py-2 text-right">D/C Ratio</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/50">
                {designResults.map((dr) => {
                  const isPass = dr.status === 'pass';
                  return (
                    <tr key={dr.elementId} className="hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-2 font-mono font-bold text-accent">{dr.elementId}</td>
                      <td className="px-4 py-2 text-slate-400">{dr.material}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{dr.ratio.toFixed(3)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isPass ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultTable({
  title,
  columns,
  children,
}: {
  title: string;
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 py-2 bg-slate-800/50 border-y border-slate-800">
        <span className="text-xs font-bold text-slate-400 uppercase">{title}</span>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-surface-1 shadow-sm">
          <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
            <th className="px-4 py-2 text-left">{columns[0]}</th>
            {columns.slice(1).map((col) => (
              <th key={col} className="px-4 py-2 text-right font-medium">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">{children}</tbody>
      </table>
    </div>
  );
}

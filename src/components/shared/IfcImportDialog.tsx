import type { IfcImportResult } from '../../utils/ifc-import';

interface IfcImportDialogProps {
  result: IfcImportResult;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function IfcImportDialog({ result, fileName, onConfirm, onCancel }: IfcImportDialogProps) {
  const { stats } = result;

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 p-6 w-[420px] max-w-[90vw]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <span className="material-icons-round text-emerald-400" style={{ fontSize: '24px' }}>apartment</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Import IFC</h3>
            <p className="text-xs text-slate-400 truncate max-w-[300px]">{fileName}</p>
          </div>
        </div>

        {/* Strategy badge */}
        <div className="mb-3">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
            stats.strategy === 'analytical'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {stats.strategy === 'analytical' ? 'Analytical Model' : 'Physical Elements'}
          </span>
        </div>

        {/* Stats */}
        <div className="bg-slate-900 rounded-lg p-3 mb-4 space-y-1">
          {stats.beamsFound > 0 && <StatRow label="Beams found" value={stats.beamsFound} />}
          {stats.columnsFound > 0 && <StatRow label="Columns found" value={stats.columnsFound} />}
          {stats.membersFound > 0 && <StatRow label="Members found" value={stats.membersFound} />}
          <div className="border-t border-slate-700 my-1 pt-1">
            <StatRow label="Nodes created" value={stats.nodesCreated} />
            <StatRow label="Elements created" value={stats.elementsCreated} />
          </div>
          {stats.duplicatesMerged > 0 && (
            <StatRow label="Duplicates merged" value={stats.duplicatesMerged} />
          )}
          {stats.sectionsCreated > 0 && (
            <StatRow label="Sections detected" value={stats.sectionsCreated} />
          )}
          {stats.materialsFound > 0 && (
            <StatRow label="Materials detected" value={stats.materialsFound} />
          )}
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-2 mb-4 max-h-24 overflow-y-auto">
            {result.warnings.slice(0, 10).map((w, i) => (
              <p key={i} className="text-xs text-amber-300">{w}</p>
            ))}
            {result.warnings.length > 10 && (
              <p className="text-xs text-amber-400 font-bold mt-1">
                +{result.warnings.length - 10} more warnings
              </p>
            )}
          </div>
        )}

        {/* Sections preview */}
        {result.sections.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-1">Sections:</p>
            <div className="flex flex-wrap gap-1">
              {result.sections.slice(0, 8).map((s) => (
                <span key={s.id} className="px-2 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded">
                  {s.name}
                </span>
              ))}
              {result.sections.length > 8 && (
                <span className="px-2 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded">
                  +{result.sections.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={stats.elementsCreated === 0}
            className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>download</span>
            Import ({stats.elementsCreated} elements)
          </button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs text-white font-mono">{value}</span>
    </div>
  );
}

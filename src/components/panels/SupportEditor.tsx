import { useState } from 'react';
import { useModelStore } from '../../store/model-store';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 focus:ring-accent focus:border-accent';
const labelCls = 'block text-[10px] font-semibold text-slate-500 mb-1 uppercase';

export function SupportEditor() {
  const nodes = useModelStore((s) => s.nodes);
  const supports = useModelStore((s) => s.supports);
  const addSupport = useModelStore((s) => s.addSupport);
  const removeSupport = useModelStore((s) => s.removeSupport);

  const [nodeId, setNodeId] = useState('');
  const [type, setType] = useState<'fixed' | 'pin' | 'roller'>('fixed');

  const handleAdd = () => {
    if (!nodeId) return;
    if (supports.find((s) => s.nodeId === nodeId)) return alert('Support already exists on this node');

    let support;
    switch (type) {
      case 'fixed':
        support = { nodeId, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true };
        break;
      case 'pin':
        support = { nodeId, dx: true, dy: true, dz: true, rx: false, ry: false, rz: false };
        break;
      case 'roller':
        support = { nodeId, dx: false, dy: true, dz: true, rx: false, ry: false, rz: false };
        break;
    }
    addSupport(support);
  };

  const availableNodes = nodes.filter((n) => !supports.find((s) => s.nodeId === n.id));

  return (
    <div className="flex flex-col h-full">
      {/* Add Support form */}
      <div className="p-4 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Add Support</h3>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Node</label>
            <select className={inputCls} value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
              <option value="">Select...</option>
              {availableNodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as 'fixed' | 'pin' | 'roller')}>
              <option value="fixed">Fixed (all DOFs)</option>
              <option value="pin">Pin (translations only)</option>
              <option value="roller">Roller (Y+Z only)</option>
            </select>
          </div>
          <button
            className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer"
            onClick={handleAdd}
          >
            ADD SUPPORT
          </button>
        </div>
      </div>

      {/* Support list */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 bg-slate-800/50 border-y border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase">Supports ({supports.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1 shadow-sm">
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                <th className="px-4 py-2">Node</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-800/50">
              {supports.map((s) => {
                const isFixed = s.dx && s.dy && s.dz && s.rx && s.ry && s.rz;
                const isPin = s.dx && s.dy && s.dz && !s.rx && !s.ry && !s.rz;
                const label = isFixed ? 'Fixed' : isPin ? 'Pin' : 'Roller';
                const badgeColor = isFixed
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : isPin
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                return (
                  <tr key={s.nodeId} className="node-list-item hover:bg-slate-800 group transition-colors">
                    <td className="px-4 py-2 text-accent font-bold font-mono">{s.nodeId}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeColor}`}>{label}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                        onClick={() => removeSupport(s.nodeId)}
                        title="Delete support"
                      >
                        delete
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

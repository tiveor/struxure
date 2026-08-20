import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, toDisplay, fromDisplay } from '../../utils/units';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 focus:ring-accent focus:border-accent';
const numCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm p-1.5 text-center font-mono text-slate-200 focus:ring-accent focus:border-accent';
const labelCls = 'block text-[10px] font-semibold text-slate-500 mb-1 uppercase';

type LoadTab = 'nodal' | 'distributed';

export function LoadEditor() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const nodalLoads = useModelStore((s) => s.nodalLoads);
  const distributedLoads = useModelStore((s) => s.distributedLoads);
  const addNodalLoad = useModelStore((s) => s.addNodalLoad);
  const removeNodalLoad = useModelStore((s) => s.removeNodalLoad);
  const addDistributedLoad = useModelStore((s) => s.addDistributedLoad);
  const removeDistributedLoad = useModelStore((s) => s.removeDistributedLoad);
  const unitSystem = useUIStore((s) => s.unitSystem);

  const [activeTab, setActiveTab] = useState<LoadTab>('nodal');

  // Nodal load form
  const [nodeId, setNodeId] = useState('');
  const [fx, setFx] = useState('0');
  const [fy, setFy] = useState('0');
  const [fz, setFz] = useState('0');
  const [mx, setMx] = useState('0');
  const [my, setMy] = useState('0');
  const [mz, setMz] = useState('0');

  // Distributed load form
  const [elemId, setElemId] = useState('');
  const [wx, setWx] = useState('0');
  const [wy, setWy] = useState('0');
  const [wz, setWz] = useState('0');

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

  const handleAddNodal = () => {
    if (!nodeId) return;
    const id = `L${nodalLoads.length + 1}`;
    addNodalLoad({
      id, nodeId,
      fx: fromDisplay(num(fx), 'force', unitSystem),
      fy: fromDisplay(num(fy), 'force', unitSystem),
      fz: fromDisplay(num(fz), 'force', unitSystem),
      mx: fromDisplay(num(mx), 'moment', unitSystem),
      my: fromDisplay(num(my), 'moment', unitSystem),
      mz: fromDisplay(num(mz), 'moment', unitSystem),
    });
    setFx('0'); setFy('0'); setFz('0');
    setMx('0'); setMy('0'); setMz('0');
  };

  const handleAddDistributed = () => {
    if (!elemId) return;
    const id = `DL${distributedLoads.length + 1}`;
    addDistributedLoad({
      id, elementId: elemId,
      wx: fromDisplay(num(wx), 'forcePerLength', unitSystem),
      wy: fromDisplay(num(wy), 'forcePerLength', unitSystem),
      wz: fromDisplay(num(wz), 'forcePerLength', unitSystem),
    });
    setWx('0'); setWy('0'); setWz('0');
  };

  const tabs: { key: LoadTab; label: string; icon: string }[] = [
    { key: 'nodal', label: 'Nodal', icon: 'location_on' },
    { key: 'distributed', label: 'Distributed', icon: 'view_timeline' },
  ];

  const totalLoads = nodalLoads.length + distributedLoads.length;

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Add Load</h3>
        <div className="flex gap-1 bg-slate-900 rounded-lg p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-accent/15 text-accent'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="material-icons-round" style={{ fontSize: '13px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Nodal Load form */}
        {activeTab === 'nodal' && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Node</label>
              <select className={inputCls} value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                <option value="">Select...</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Forces ({unitLabel('force', unitSystem)})</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <label className={labelCls}>Fx</label>
                  <input type="number" className={numCls} value={fx} onChange={(e) => setFx(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Fy</label>
                  <input type="number" className={numCls} value={fy} onChange={(e) => setFy(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Fz</label>
                  <input type="number" className={numCls} value={fz} onChange={(e) => setFz(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Moments ({unitLabel('moment', unitSystem)})</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <label className={labelCls}>Mx</label>
                  <input type="number" className={numCls} value={mx} onChange={(e) => setMx(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>My</label>
                  <input type="number" className={numCls} value={my} onChange={(e) => setMy(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Mz</label>
                  <input type="number" className={numCls} value={mz} onChange={(e) => setMz(e.target.value)} />
                </div>
              </div>
            </div>

            <button
              className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer"
              onClick={handleAddNodal}
            >
              ADD NODAL LOAD
            </button>
          </div>
        )}

        {/* Distributed Load form */}
        {activeTab === 'distributed' && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Element</label>
              <select className={inputCls} value={elemId} onChange={(e) => setElemId(e.target.value)}>
                <option value="">Select...</option>
                {elements.map((el) => (
                  <option key={el.id} value={el.id}>{el.id} ({el.nodeI} → {el.nodeJ})</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Intensity ({unitLabel('forcePerLength', unitSystem)})</label>
              <p className="text-[9px] text-slate-600 mb-2">Local element coordinates. Negative Wy = gravity.</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Wx</label>
                  <input type="number" className={numCls} value={wx} onChange={(e) => setWx(e.target.value)} step="any" />
                </div>
                <div>
                  <label className={labelCls}>Wy</label>
                  <input type="number" className={numCls} value={wy} onChange={(e) => setWy(e.target.value)} step="any" />
                </div>
                <div>
                  <label className={labelCls}>Wz</label>
                  <input type="number" className={numCls} value={wz} onChange={(e) => setWz(e.target.value)} step="any" />
                </div>
              </div>
            </div>

            <button
              className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer"
              onClick={handleAddDistributed}
            >
              ADD DISTRIBUTED LOAD
            </button>
          </div>
        )}
      </div>

      {/* Load list */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 bg-slate-800/50 border-y border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase">Loads ({totalLoads})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Nodal loads */}
          {nodalLoads.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-slate-800/30">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Nodal ({nodalLoads.length})</span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-1 shadow-sm">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                    <th className="px-4 py-1.5 w-12">ID</th>
                    <th className="px-4 py-1.5">Node</th>
                    <th className="px-4 py-1.5">Forces</th>
                    <th className="px-4 py-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono divide-y divide-slate-800/50">
                  {nodalLoads.map((l) => (
                    <tr key={l.id} className="node-list-item hover:bg-slate-800 group transition-colors">
                      <td className="px-4 py-1.5 text-accent font-bold">{l.id}</td>
                      <td className="px-4 py-1.5 text-slate-400">{l.nodeId}</td>
                      <td className="px-4 py-1.5 text-slate-400 text-xs">
                        ({toDisplay(l.fx, 'force', unitSystem).toFixed(1)}, {toDisplay(l.fy, 'force', unitSystem).toFixed(1)}, {toDisplay(l.fz, 'force', unitSystem).toFixed(1)})
                      </td>
                      <td className="px-4 py-1.5">
                        <span
                          className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                          onClick={() => removeNodalLoad(l.id)}
                          title="Delete load"
                        >
                          delete
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Distributed loads */}
          {distributedLoads.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-slate-800/30">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Distributed ({distributedLoads.length})</span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-1 shadow-sm">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                    <th className="px-4 py-1.5 w-12">ID</th>
                    <th className="px-4 py-1.5">Elem</th>
                    <th className="px-4 py-1.5">W ({unitLabel('forcePerLength', unitSystem)})</th>
                    <th className="px-4 py-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono divide-y divide-slate-800/50">
                  {distributedLoads.map((dl) => (
                    <tr key={dl.id} className="node-list-item hover:bg-slate-800 group transition-colors">
                      <td className="px-4 py-1.5 text-accent font-bold">{dl.id}</td>
                      <td className="px-4 py-1.5 text-slate-400">{dl.elementId}</td>
                      <td className="px-4 py-1.5 text-slate-400 text-xs">
                        ({toDisplay(dl.wx, 'forcePerLength', unitSystem).toFixed(3)}, {toDisplay(dl.wy, 'forcePerLength', unitSystem).toFixed(3)}, {toDisplay(dl.wz, 'forcePerLength', unitSystem).toFixed(3)})
                      </td>
                      <td className="px-4 py-1.5">
                        <span
                          className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                          onClick={() => removeDistributedLoad(dl.id)}
                          title="Delete load"
                        >
                          delete
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

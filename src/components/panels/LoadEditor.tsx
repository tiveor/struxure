import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, formatQuantity } from '../../utils/units';
import { QuantityInput } from '../shared/QuantityInput';

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

  // Form drafts are held in internal units (kip, kip-in, kip/in), so a
  // unit switch mid-edit re-renders them in the new unit instead of saving
  // a number typed for the old one.

  // Nodal load form
  const [nodeId, setNodeId] = useState('');
  const [fx, setFx] = useState(0);
  const [fy, setFy] = useState(0);
  const [fz, setFz] = useState(0);
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);
  const [mz, setMz] = useState(0);

  // Distributed load form
  const [elemId, setElemId] = useState('');
  const [wx, setWx] = useState(0);
  const [wy, setWy] = useState(0);
  const [wz, setWz] = useState(0);

  const handleAddNodal = () => {
    if (!nodeId) return;
    const id = `L${nodalLoads.length + 1}`;
    addNodalLoad({ id, nodeId, fx, fy, fz, mx, my, mz });
    setFx(0); setFy(0); setFz(0);
    setMx(0); setMy(0); setMz(0);
  };

  const handleAddDistributed = () => {
    if (!elemId) return;
    const id = `DL${distributedLoads.length + 1}`;
    addDistributedLoad({ id, elementId: elemId, wx, wy, wz });
    setWx(0); setWy(0); setWz(0);
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
              <label className={labelCls} htmlFor="load-node">Node</label>
              <select id="load-node" className={inputCls} value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                <option value="">Select...</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
              </select>
            </div>

            <div>
              <div className={labelCls}>Forces ({unitLabel('force', unitSystem)})</div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <label className={labelCls} htmlFor="load-fx">Fx</label>
                  <QuantityInput id="load-fx" qty="force" unitSystem={unitSystem} className={numCls} value={fx} onChange={setFx} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="load-fy">Fy</label>
                  <QuantityInput id="load-fy" qty="force" unitSystem={unitSystem} className={numCls} value={fy} onChange={setFy} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="load-fz">Fz</label>
                  <QuantityInput id="load-fz" qty="force" unitSystem={unitSystem} className={numCls} value={fz} onChange={setFz} />
                </div>
              </div>
            </div>

            <div>
              <div className={labelCls}>Moments ({unitLabel('moment', unitSystem)})</div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <label className={labelCls} htmlFor="load-mx">Mx</label>
                  <QuantityInput id="load-mx" qty="moment" unitSystem={unitSystem} className={numCls} value={mx} onChange={setMx} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="load-my">My</label>
                  <QuantityInput id="load-my" qty="moment" unitSystem={unitSystem} className={numCls} value={my} onChange={setMy} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="load-mz">Mz</label>
                  <QuantityInput id="load-mz" qty="moment" unitSystem={unitSystem} className={numCls} value={mz} onChange={setMz} />
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
              <label className={labelCls} htmlFor="load-element">Element</label>
              <select id="load-element" className={inputCls} value={elemId} onChange={(e) => setElemId(e.target.value)}>
                <option value="">Select...</option>
                {elements.map((el) => (
                  <option key={el.id} value={el.id}>{el.id} ({el.nodeI} → {el.nodeJ})</option>
                ))}
              </select>
            </div>

            <div>
              <div className={labelCls}>Intensity ({unitLabel('forcePerLength', unitSystem)})</div>
              <p className="text-[9px] text-slate-600 mb-2">Local element coordinates. Negative Wy = gravity.</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls} htmlFor="load-wx">Wx</label>
                  <QuantityInput id="load-wx" qty="forcePerLength" unitSystem={unitSystem} className={numCls} value={wx} onChange={setWx} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="load-wy">Wy</label>
                  <QuantityInput id="load-wy" qty="forcePerLength" unitSystem={unitSystem} className={numCls} value={wy} onChange={setWy} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="load-wz">Wz</label>
                  <QuantityInput id="load-wz" qty="forcePerLength" unitSystem={unitSystem} className={numCls} value={wz} onChange={setWz} />
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
                    <th className="px-4 py-1.5">Forces ({unitLabel('force', unitSystem)})</th>
                    <th className="px-4 py-1.5">Moments ({unitLabel('moment', unitSystem)})</th>
                    <th className="px-4 py-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono divide-y divide-slate-800/50">
                  {nodalLoads.map((l) => (
                    <tr key={l.id} className="node-list-item hover:bg-slate-800 group transition-colors">
                      <td className="px-4 py-1.5 text-accent font-bold">{l.id}</td>
                      <td className="px-4 py-1.5 text-slate-400">{l.nodeId}</td>
                      <td className="px-4 py-1.5 text-slate-400 text-xs">
                        ({formatQuantity(l.fx, 'force', unitSystem, 1)}, {formatQuantity(l.fy, 'force', unitSystem, 1)}, {formatQuantity(l.fz, 'force', unitSystem, 1)})
                      </td>
                      <td className="px-4 py-1.5 text-slate-400 text-xs">
                        ({formatQuantity(l.mx, 'moment', unitSystem, 1)}, {formatQuantity(l.my, 'moment', unitSystem, 1)}, {formatQuantity(l.mz, 'moment', unitSystem, 1)})
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
                        ({formatQuantity(dl.wx, 'forcePerLength', unitSystem)}, {formatQuantity(dl.wy, 'forcePerLength', unitSystem)}, {formatQuantity(dl.wz, 'forcePerLength', unitSystem)})
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

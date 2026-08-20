import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, toDisplay, fromDisplay } from '../../utils/units';
import { MATERIAL_LIBRARY } from '../../utils/material-library';
import type { LibraryMaterial } from '../../utils/material-library';
import type { MaterialType } from '../../core/types';
import { newId } from '../../utils/id';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent';
const numCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm p-1.5 text-center font-mono text-slate-200 focus:ring-accent focus:border-accent';
const labelCls = 'block text-[10px] font-semibold text-slate-500 mb-1 uppercase';

type LibTab = 'steel' | 'concrete' | 'custom';

export function MaterialEditor() {
  const materials = useModelStore((s) => s.materials);
  const addMaterial = useModelStore((s) => s.addMaterial);
  const removeMaterial = useModelStore((s) => s.removeMaterial);
  const unitSystem = useUIStore((s) => s.unitSystem);

  const [activeTab, setActiveTab] = useState<LibTab>('steel');

  // Custom form state
  const [name, setName] = useState('');
  const [type, setType] = useState<MaterialType>('steel');
  const [E, setE] = useState(29000);
  const [G, setG] = useState(11200);
  const [fy, setFy] = useState(50);
  const [fc, setFc] = useState(4);

  const handleAddFromLibrary = (lib: LibraryMaterial) => {
    // Check if a material with the same name already exists
    if (materials.find((m) => m.name === lib.name)) {
      alert(`"${lib.name}" is already in your model`);
      return;
    }
    const id = newId('mat');
    const { category: _, ...matProps } = lib;
    addMaterial({ id, ...matProps });
  };

  const handleAddCustom = () => {
    if (!name) return;
    const id = newId('mat');
    const mat = type === 'steel'
      ? { id, name, type: 'steel' as const, E, G, density: 0.000284, fy, fu: fy * 1.3 }
      : { id, name, type: 'concrete' as const, E, G, density: 0.0000868, fc };
    addMaterial(mat);
    setName('');
  };

  const tabs: { key: LibTab; label: string; icon: string }[] = [
    { key: 'steel', label: 'Steel', icon: 'hardware' },
    { key: 'concrete', label: 'Concrete', icon: 'square' },
    { key: 'custom', label: 'Custom', icon: 'tune' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Library / Custom tabs */}
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Material Library</h3>
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

        {/* Steel Library */}
        {activeTab === 'steel' && (
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
            {MATERIAL_LIBRARY.steel.map((lib) => {
              const alreadyAdded = materials.some((m) => m.name === lib.name);
              return (
                <button
                  key={lib.name}
                  className={`text-left p-2 rounded-lg border transition-all cursor-pointer ${
                    alreadyAdded
                      ? 'border-accent/30 bg-accent/5 opacity-60'
                      : 'border-slate-700 bg-slate-800/50 hover:border-accent/50 hover:bg-slate-800'
                  }`}
                  onClick={() => handleAddFromLibrary(lib)}
                  title={alreadyAdded ? 'Already in model' : `Add ${lib.name}`}
                >
                  <div className="text-xs font-bold text-slate-200 leading-tight">{lib.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{lib.category}</div>
                  <div className="text-[10px] font-mono text-accent mt-1">
                    Fy={lib.fy} {unitLabel('stress', 'imperial')}
                  </div>
                  {alreadyAdded && (
                    <span className="text-[9px] text-accent font-bold">ADDED</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Concrete Library */}
        {activeTab === 'concrete' && (
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
            {MATERIAL_LIBRARY.concrete.map((lib) => {
              const alreadyAdded = materials.some((m) => m.name === lib.name);
              return (
                <button
                  key={lib.name}
                  className={`text-left p-2 rounded-lg border transition-all cursor-pointer ${
                    alreadyAdded
                      ? 'border-accent/30 bg-accent/5 opacity-60'
                      : 'border-slate-700 bg-slate-800/50 hover:border-accent/50 hover:bg-slate-800'
                  }`}
                  onClick={() => handleAddFromLibrary(lib)}
                  title={alreadyAdded ? 'Already in model' : `Add ${lib.name}`}
                >
                  <div className="text-xs font-bold text-slate-200 leading-tight">{lib.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{lib.category}</div>
                  <div className="text-[10px] font-mono text-accent mt-1">
                    E={lib.E} {unitLabel('stress', 'imperial')}
                  </div>
                  {alreadyAdded && (
                    <span className="text-[9px] text-accent font-bold">ADDED</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Custom form */}
        {activeTab === 'custom' && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} placeholder="e.g. A992 Steel" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as MaterialType)}>
                <option value="steel">Steel</option>
                <option value="concrete">Concrete</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>E ({unitLabel('stress', unitSystem)})</label>
                <input type="number" className={numCls} value={+toDisplay(E, 'stress', unitSystem).toFixed(1)} onChange={(e) => setE(fromDisplay(+e.target.value, 'stress', unitSystem))} />
              </div>
              <div>
                <label className={labelCls}>G ({unitLabel('stress', unitSystem)})</label>
                <input type="number" className={numCls} value={+toDisplay(G, 'stress', unitSystem).toFixed(1)} onChange={(e) => setG(fromDisplay(+e.target.value, 'stress', unitSystem))} />
              </div>
            </div>
            {type === 'steel' && (
              <div>
                <label className={labelCls}>Fy ({unitLabel('stress', unitSystem)})</label>
                <input type="number" className={numCls} value={+toDisplay(fy, 'stress', unitSystem).toFixed(1)} onChange={(e) => setFy(fromDisplay(+e.target.value, 'stress', unitSystem))} />
              </div>
            )}
            {type === 'concrete' && (
              <div>
                <label className={labelCls}>f'c ({unitLabel('stress', unitSystem)})</label>
                <input type="number" className={numCls} value={+toDisplay(fc, 'stress', unitSystem).toFixed(2)} onChange={(e) => setFc(fromDisplay(+e.target.value, 'stress', unitSystem))} />
              </div>
            )}
            <button
              className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer"
              onClick={handleAddCustom}
            >
              ADD CUSTOM MATERIAL
            </button>
          </div>
        )}
      </div>

      {/* Material list */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 bg-slate-800/50 border-y border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase">In Model ({materials.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1 shadow-sm">
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">E ({unitLabel('stress', unitSystem)})</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono divide-y divide-slate-800/50">
              {materials.map((m) => (
                <tr key={m.id} className="node-list-item hover:bg-slate-800 group transition-colors">
                  <td className="px-4 py-2 text-accent font-bold font-sans">{m.name}</td>
                  <td className="px-4 py-2 text-slate-400 capitalize font-sans">{m.type}</td>
                  <td className="px-4 py-2 text-slate-400">{toDisplay(m.E, 'stress', unitSystem).toFixed(0)}</td>
                  <td className="px-4 py-2">
                    <span
                      className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                      onClick={() => removeMaterial(m.id)}
                      title="Delete material"
                    >
                      delete
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

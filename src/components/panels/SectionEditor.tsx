import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, toDisplay, fromDisplay } from '../../utils/units';
import { SectionPicker } from './SectionPicker';
import { newId } from '../../utils/id';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent';
const numCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm p-1.5 text-center font-mono text-slate-200 focus:ring-accent focus:border-accent';
const labelCls = 'block text-[10px] font-semibold text-slate-500 mb-1 uppercase';

export function SectionEditor() {
  const sections = useModelStore((s) => s.sections);
  const addSection = useModelStore((s) => s.addSection);
  const removeSection = useModelStore((s) => s.removeSection);
  const unitSystem = useUIStore((s) => s.unitSystem);

  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState('');
  const [A, setA] = useState(10);
  const [Ix, setIx] = useState(100);
  const [Iy, setIy] = useState(50);
  const [J, setJ] = useState(5);

  const handleAdd = () => {
    if (!name) return;
    const id = newId('sec');
    addSection({ id, name, A, Ix, Iy, J });
    setName('');
  };

  if (showPicker) {
    return <SectionPicker onClose={() => setShowPicker(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* AISC Library button */}
      <div className="px-4 pt-4 pb-2">
        <button
          className="w-full py-2 bg-accent text-white text-sm font-bold rounded hover:bg-accent/80 transition-opacity cursor-pointer flex items-center justify-center gap-2"
          onClick={() => setShowPicker(true)}
        >
          <span className="material-icons-round" style={{ fontSize: '16px' }}>menu_book</span>
          AISC LIBRARY
        </button>
      </div>

      {/* Add Section form */}
      <div className="p-4 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custom Section</h3>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} placeholder="e.g. W12x26" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>A ({unitLabel('area', unitSystem)})</label>
              <input type="number" className={numCls} value={+toDisplay(A, 'area', unitSystem).toFixed(2)} onChange={(e) => setA(fromDisplay(+e.target.value, 'area', unitSystem))} />
            </div>
            <div>
              <label className={labelCls}>Ix ({unitLabel('momentOfInertia', unitSystem)})</label>
              <input type="number" className={numCls} value={+toDisplay(Ix, 'momentOfInertia', unitSystem).toFixed(0)} onChange={(e) => setIx(fromDisplay(+e.target.value, 'momentOfInertia', unitSystem))} />
            </div>
            <div>
              <label className={labelCls}>Iy ({unitLabel('momentOfInertia', unitSystem)})</label>
              <input type="number" className={numCls} value={+toDisplay(Iy, 'momentOfInertia', unitSystem).toFixed(0)} onChange={(e) => setIy(fromDisplay(+e.target.value, 'momentOfInertia', unitSystem))} />
            </div>
            <div>
              <label className={labelCls}>J ({unitLabel('momentOfInertia', unitSystem)})</label>
              <input type="number" className={numCls} value={+toDisplay(J, 'momentOfInertia', unitSystem).toFixed(0)} onChange={(e) => setJ(fromDisplay(+e.target.value, 'momentOfInertia', unitSystem))} />
            </div>
          </div>
          <button
            className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer"
            onClick={handleAdd}
          >
            ADD SECTION
          </button>
        </div>
      </div>

      {/* Section list */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 bg-slate-800/50 border-y border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase">Sections ({sections.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1 shadow-sm">
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">A</th>
                <th className="px-4 py-2">Ix</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono divide-y divide-slate-800/50">
              {sections.map((s) => (
                <tr key={s.id} className="node-list-item hover:bg-slate-800 group transition-colors">
                  <td className="px-4 py-2 text-accent font-bold font-sans">{s.name}</td>
                  <td className="px-4 py-2 text-slate-400">{toDisplay(s.A, 'area', unitSystem).toFixed(2)}</td>
                  <td className="px-4 py-2 text-slate-400">{toDisplay(s.Ix, 'momentOfInertia', unitSystem).toFixed(0)}</td>
                  <td className="px-4 py-2">
                    <span
                      className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                      onClick={() => removeSection(s.id)}
                      title="Delete section"
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

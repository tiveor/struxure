import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, toDisplay, fromDisplay } from '../../utils/units';
import { SectionPicker } from './SectionPicker';
import { newId } from '../../utils/id';
import type { ColumnReinforcement, Section } from '../../core/types';
import {
  DEFAULT_REBAR_FY,
  LONGITUDINAL_BAR_SIZES,
  TIE_BAR_SIZES,
  reinforcementErrors,
  totalBars,
  totalSteelArea,
} from '../../design/aci318/rebar';
import { describeReinforcement, rectangleProperties } from '../../utils/rect-section';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent';
const numCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm p-1.5 text-center font-mono text-slate-200 focus:ring-accent focus:border-accent';
const labelCls = 'block text-[10px] font-semibold text-slate-500 mb-1 uppercase';
const checkLabelCls = 'flex items-center gap-2 text-xs text-slate-300 cursor-pointer';

export function SectionEditor() {
  const sections = useModelStore((s) => s.sections);
  const elements = useModelStore((s) => s.elements);
  const addSection = useModelStore((s) => s.addSection);
  const removeSection = useModelStore((s) => s.removeSection);
  const unitSystem = useUIStore((s) => s.unitSystem);

  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState('');
  const [A, setA] = useState(10);
  const [Ix, setIx] = useState(100);
  const [Iy, setIy] = useState(50);
  const [J, setJ] = useState(5);

  // Rectangular concrete section, with optional column reinforcement.
  const [isRect, setIsRect] = useState(false);
  const [b, setB] = useState(16);
  const [h, setH] = useState(16);
  const [hasReinf, setHasReinf] = useState(false);
  const [cover, setCover] = useState(1.5);
  const [barSize, setBarSize] = useState(8);
  const [tieSize, setTieSize] = useState(3);
  const [barsAlongB, setBarsAlongB] = useState(3);
  const [barsAlongH, setBarsAlongH] = useState(3);
  const [rebarFy, setRebarFy] = useState(DEFAULT_REBAR_FY);

  const reinforcement: ColumnReinforcement = { cover, barSize, tieSize, barsAlongB, barsAlongH, fy: rebarFy };
  const reinfErrors = isRect && hasReinf ? reinforcementErrors({ b, h, reinforcement }) : [];
  const rectErrors = isRect && !(b > 0 && h > 0) ? ['b and h must be positive'] : [];
  const formErrors = rectErrors.length > 0 ? rectErrors : reinfErrors;

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Sections render by name in the element table and in exports, so two
    // entries sharing a name would be indistinguishable.
    if (sections.some((s) => s.name === trimmed)) {
      alert(`"${trimmed}" is already in your model`);
      return;
    }
    if (formErrors.length > 0) return;
    const id = newId('sec');
    let section: Section = { id, name: trimmed, A, Ix, Iy, J };
    if (isRect) {
      section = { id, name: trimmed, ...rectangleProperties(b, h), b, h };
      if (hasReinf) section.reinforcement = reinforcement;
    }
    addSection(section);
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
            <label htmlFor="sec-name" className={labelCls}>Name</label>
            <input id="sec-name" className={inputCls} placeholder="e.g. W12x26" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <label htmlFor="sec-rect" className={checkLabelCls}>
            <input id="sec-rect" type="checkbox" checked={isRect} onChange={(e) => setIsRect(e.target.checked)} />
            Rectangular concrete (b x h)
          </label>
          {isRect ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="sec-b" className={labelCls}>b ({unitLabel('length', unitSystem)})</label>
                <input id="sec-b" type="number" min={0} className={numCls} value={+toDisplay(b, 'length', unitSystem).toFixed(2)} onChange={(e) => setB(fromDisplay(+e.target.value, 'length', unitSystem))} />
              </div>
              <div>
                <label htmlFor="sec-h" className={labelCls}>h ({unitLabel('length', unitSystem)})</label>
                <input id="sec-h" type="number" min={0} className={numCls} value={+toDisplay(h, 'length', unitSystem).toFixed(2)} onChange={(e) => setH(fromDisplay(+e.target.value, 'length', unitSystem))} />
              </div>
              <p className="col-span-2 text-[10px] leading-snug text-slate-500">
                h is the depth for strong-axis bending. A, Ix, Iy and J are computed from b and h.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="sec-A" className={labelCls}>A ({unitLabel('area', unitSystem)})</label>
                <input id="sec-A" type="number" className={numCls} value={+toDisplay(A, 'area', unitSystem).toFixed(2)} onChange={(e) => setA(fromDisplay(+e.target.value, 'area', unitSystem))} />
              </div>
              <div>
                <label htmlFor="sec-Ix" className={labelCls}>Ix ({unitLabel('momentOfInertia', unitSystem)})</label>
                <input id="sec-Ix" type="number" className={numCls} value={+toDisplay(Ix, 'momentOfInertia', unitSystem).toFixed(0)} onChange={(e) => setIx(fromDisplay(+e.target.value, 'momentOfInertia', unitSystem))} />
              </div>
              <div>
                <label htmlFor="sec-Iy" className={labelCls}>Iy ({unitLabel('momentOfInertia', unitSystem)})</label>
                <input id="sec-Iy" type="number" className={numCls} value={+toDisplay(Iy, 'momentOfInertia', unitSystem).toFixed(0)} onChange={(e) => setIy(fromDisplay(+e.target.value, 'momentOfInertia', unitSystem))} />
              </div>
              <div>
                <label htmlFor="sec-J" className={labelCls}>J ({unitLabel('momentOfInertia', unitSystem)})</label>
                <input id="sec-J" type="number" className={numCls} value={+toDisplay(J, 'momentOfInertia', unitSystem).toFixed(0)} onChange={(e) => setJ(fromDisplay(+e.target.value, 'momentOfInertia', unitSystem))} />
              </div>
            </div>
          )}
          {isRect && (
            <label htmlFor="sec-reinf" className={checkLabelCls}>
              <input id="sec-reinf" type="checkbox" checked={hasReinf} onChange={(e) => setHasReinf(e.target.checked)} />
              Column reinforcement (ACI 318)
            </label>
          )}
          {isRect && hasReinf && (
            <fieldset className="space-y-2">
              <legend className="sr-only">Column reinforcement</legend>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sec-bar-size" className={labelCls}>Bar size</label>
                  <select id="sec-bar-size" className={numCls} value={barSize} onChange={(e) => setBarSize(+e.target.value)}>
                    {LONGITUDINAL_BAR_SIZES.map((n) => <option key={n} value={n}>#{n}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="sec-tie-size" className={labelCls}>Tie size</label>
                  <select id="sec-tie-size" className={numCls} value={tieSize} onChange={(e) => setTieSize(+e.target.value)}>
                    {TIE_BAR_SIZES.map((n) => <option key={n} value={n}>#{n}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="sec-bars-b" className={labelCls}>Bars per b face</label>
                  <input id="sec-bars-b" type="number" min={2} step={1} className={numCls} value={barsAlongB} onChange={(e) => setBarsAlongB(+e.target.value)} />
                </div>
                <div>
                  <label htmlFor="sec-bars-h" className={labelCls}>Bars per h face</label>
                  <input id="sec-bars-h" type="number" min={2} step={1} className={numCls} value={barsAlongH} onChange={(e) => setBarsAlongH(+e.target.value)} />
                </div>
                <div>
                  <label htmlFor="sec-cover" className={labelCls}>Clear cover ({unitLabel('length', unitSystem)})</label>
                  <input id="sec-cover" type="number" min={0} className={numCls} value={+toDisplay(cover, 'length', unitSystem).toFixed(2)} onChange={(e) => setCover(fromDisplay(+e.target.value, 'length', unitSystem))} />
                </div>
                <div>
                  <label htmlFor="sec-rebar-fy" className={labelCls}>Rebar fy ({unitLabel('stress', unitSystem)})</label>
                  <input id="sec-rebar-fy" type="number" min={0} className={numCls} value={+toDisplay(rebarFy, 'stress', unitSystem).toFixed(1)} onChange={(e) => setRebarFy(fromDisplay(+e.target.value, 'stress', unitSystem))} />
                </div>
              </div>
              <p className="text-[10px] leading-snug text-slate-500">
                Counts include the corner bars. Bars are spaced evenly along each face. Cover is clear cover to the ties.
              </p>
              {formErrors.length === 0 && (
                <p className="text-[10px] text-slate-400">
                  {totalBars(reinforcement)} bars, As = {toDisplay(totalSteelArea(reinforcement), 'area', unitSystem).toFixed(2)} {unitLabel('area', unitSystem)},
                  {' '}rho = {((100 * totalSteelArea(reinforcement)) / (b * h)).toFixed(2)}%
                </p>
              )}
            </fieldset>
          )}
          {formErrors.length > 0 && (
            <ul role="alert" className="text-[10px] text-red-400 list-disc pl-4">
              {formErrors.map((err) => <li key={err}>{err}</li>)}
            </ul>
          )}
          <button
            className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAdd}
            disabled={formErrors.length > 0}
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
                  <td className="px-4 py-2 text-accent font-bold font-sans">
                    {s.name}
                    {s.reinforcement && (
                      <span className="block text-[10px] font-normal text-slate-500">{describeReinforcement(s.reinforcement)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{toDisplay(s.A, 'area', unitSystem).toFixed(2)}</td>
                  <td className="px-4 py-2 text-slate-400">{toDisplay(s.Ix, 'momentOfInertia', unitSystem).toFixed(0)}</td>
                  <td className="px-4 py-2">
                    <span
                      className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                      onClick={() => {
                        if (!removeSection(s.id)) {
                          const usedBy = elements.filter((e) => e.sectionId === s.id).length;
                          alert(`"${s.name}" is used by ${usedBy} element${usedBy === 1 ? '' : 's'} — reassign or delete them first.`);
                        }
                      }}
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

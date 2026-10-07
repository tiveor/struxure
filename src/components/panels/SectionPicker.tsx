import { useState, useMemo } from 'react';
import { AISC_SECTIONS, searchSections, aiscToSection } from '../../data/aisc-sections';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, formatQuantity } from '../../utils/units';
import type { AISCSection } from '../../data/aisc-sections';

// One filter per shape family that the library actually contains.
const TYPE_FILTERS = ['all', 'W', 'HSS'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

export function SectionPicker({ onClose }: { onClose: () => void }) {
  const addSection = useModelStore((s) => s.addSection);
  const sections = useModelStore((s) => s.sections);
  const unitSystem = useUIStore((s) => s.unitSystem);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filteredSections = useMemo(() => {
    let results = query ? searchSections(query) : AISC_SECTIONS;
    if (typeFilter !== 'all') {
      results = results.filter((s) => s.type === typeFilter);
    }
    return results;
  }, [query, typeFilter]);

  const handleSelect = (aisc: AISCSection) => {
    // Check if section already exists
    if (sections.some((s) => s.id === aisc.name)) return;
    const section = aiscToSection(aisc);
    addSection(section);
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">AISC Library</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
        <input
          className="w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent"
          placeholder="Search... (e.g. W14, W12x26)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="flex gap-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                typeFilter === t
                  ? 'bg-accent text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 self-center ml-auto">
            {filteredSections.length} sections
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-surface-1 shadow-sm">
            <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
              <th className="px-3 py-1.5">Section</th>
              <th className="px-2 py-1.5 text-right">d ({unitLabel('sectionDimension', unitSystem)})</th>
              <th className="px-2 py-1.5 text-right">bf ({unitLabel('sectionDimension', unitSystem)})</th>
              <th className="px-2 py-1.5 text-right">A ({unitLabel('area', unitSystem)})</th>
              <th className="px-2 py-1.5 text-right">Ix ({unitLabel('momentOfInertia', unitSystem)})</th>
              <th className="px-2 py-1.5 text-right">wt ({unitLabel('weightPerLength', unitSystem)})</th>
            </tr>
          </thead>
          <tbody className="text-xs font-mono divide-y divide-slate-800/50">
            {filteredSections.map((s) => {
              const exists = sections.some((sec) => sec.id === s.name);
              return (
                <tr
                  key={s.name}
                  className={`transition-colors ${
                    exists
                      ? 'bg-slate-800/50 text-slate-600'
                      : 'hover:bg-slate-800 cursor-pointer'
                  }`}
                  onClick={() => !exists && handleSelect(s)}
                >
                  <td className="px-3 py-1.5 text-accent font-bold font-sans text-xs">{s.name}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400">{formatQuantity(s.d, 'sectionDimension', unitSystem, { imperial: 1, metric: 0 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400">{formatQuantity(s.bf, 'sectionDimension', unitSystem, { imperial: 1, metric: 0 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-300">{formatQuantity(s.A, 'area', unitSystem, { imperial: 1 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400">{formatQuantity(s.Ix, 'momentOfInertia', unitSystem, { imperial: 0 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-500">{unitSystem === 'imperial' ? s.weight : formatQuantity(s.weight, 'weightPerLength', unitSystem)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

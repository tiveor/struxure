import { useState, useMemo } from 'react';
import { AISC_SECTIONS, searchSections, aiscToSection } from '../../data/aisc-sections';
import { EURO_FAMILIES, searchEuroSections, euroToSection, euroWeightLbPerFt } from '../../data/euro-sections';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, formatQuantity } from '../../utils/units';
import type { Section } from '../../core/types';

type Library = 'AISC' | 'EN';

const LIBRARIES: { id: Library; label: string; placeholder: string }[] = [
  { id: 'AISC', label: 'AISC', placeholder: 'Search... (e.g. W14, W12x26)' },
  { id: 'EN', label: 'EN', placeholder: 'Search... (e.g. IPE300, HEB 200)' },
];

// One filter per shape family that each library actually contains.
const FAMILY_FILTERS: Record<Library, readonly string[]> = {
  AISC: ['all', 'W', 'HSS'],
  EN: ['all', ...EURO_FAMILIES],
};

/** A library row: the converted Section plus what the table shows. */
interface Row {
  section: Section;
  family: string;
  /** Weight per length in lb/ft, the app's internal unit for it. */
  weight: number;
  /** AISC tables publish lb/ft as whole numbers; show those as published. */
  publishedLbFt?: number;
}

const AISC_ROWS = new Map<string, Row>(
  AISC_SECTIONS.map((s) => [s.name, { section: aiscToSection(s), family: s.type, weight: s.weight, publishedLbFt: s.weight }]),
);

function rowsFor(library: Library, query: string): Row[] {
  if (library === 'AISC') {
    const found = query ? searchSections(query) : AISC_SECTIONS;
    return found.map((s) => AISC_ROWS.get(s.name)!);
  }
  return searchEuroSections(query).map((s) => ({
    section: euroToSection(s),
    family: s.family,
    weight: euroWeightLbPerFt(s),
  }));
}

export function SectionPicker({ onClose }: { onClose: () => void }) {
  const addSection = useModelStore((s) => s.addSection);
  const sections = useModelStore((s) => s.sections);
  const unitSystem = useUIStore((s) => s.unitSystem);

  // Metric users most often want the European shapes.
  const [library, setLibrary] = useState<Library>(unitSystem === 'metric' ? 'EN' : 'AISC');
  const [query, setQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');

  const rows = useMemo(() => {
    const all = rowsFor(library, query);
    return familyFilter === 'all' ? all : all.filter((r) => r.family === familyFilter);
  }, [library, query, familyFilter]);

  const switchLibrary = (next: Library) => {
    setLibrary(next);
    setFamilyFilter('all');
  };

  const handleSelect = (section: Section) => {
    // Check if section already exists
    if (sections.some((s) => s.id === section.id)) return;
    addSection(section);
    onClose();
  };

  const dimLabel = unitLabel('sectionDimension', unitSystem);
  const placeholder = LIBRARIES.find((l) => l.id === library)!.placeholder;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Section Library</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
        <div role="tablist" aria-label="Section library" className="flex gap-1">
          {LIBRARIES.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={library === l.id}
              className={`flex-1 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                library === l.id ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              onClick={() => switchLibrary(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <input
          aria-label="Search sections"
          className="w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="flex gap-1">
          {FAMILY_FILTERS[library].map((t) => (
            <button
              key={t}
              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                familyFilter === t
                  ? 'bg-accent text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              onClick={() => setFamilyFilter(t)}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 self-center ml-auto">
            {rows.length} sections
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-surface-1 shadow-sm">
            <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
              <th className="px-3 py-1.5">Section</th>
              <th className="px-2 py-1.5 text-right">d ({dimLabel})</th>
              <th className="px-2 py-1.5 text-right">bf ({dimLabel})</th>
              <th className="px-2 py-1.5 text-right">A ({unitLabel('area', unitSystem)})</th>
              <th className="px-2 py-1.5 text-right">Ix ({unitLabel('momentOfInertia', unitSystem)})</th>
              <th className="px-2 py-1.5 text-right">wt ({unitLabel('weightPerLength', unitSystem)})</th>
            </tr>
          </thead>
          <tbody className="text-xs font-mono divide-y divide-slate-800/50">
            {rows.map(({ section: s, weight, publishedLbFt }) => {
              const exists = sections.some((sec) => sec.id === s.id);
              return (
                <tr
                  key={s.id}
                  className={`transition-colors ${
                    exists
                      ? 'bg-slate-800/50 text-slate-600'
                      : 'hover:bg-slate-800 cursor-pointer'
                  }`}
                  onClick={() => !exists && handleSelect(s)}
                >
                  <td className="px-3 py-1.5 text-accent font-bold font-sans text-xs">{s.name}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400">{formatQuantity(s.d ?? 0, 'sectionDimension', unitSystem, { imperial: 1, metric: 0 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400">{formatQuantity(s.bf ?? 0, 'sectionDimension', unitSystem, { imperial: 1, metric: 0 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-300">{formatQuantity(s.A, 'area', unitSystem, { imperial: 1 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-400">{formatQuantity(s.Ix, 'momentOfInertia', unitSystem, { imperial: 0 })}</td>
                  <td className="px-2 py-1.5 text-right text-slate-500">
                    {unitSystem === 'imperial' && publishedLbFt !== undefined
                      ? publishedLbFt
                      : formatQuantity(weight, 'weightPerLength', unitSystem)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

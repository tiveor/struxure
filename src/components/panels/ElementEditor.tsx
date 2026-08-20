import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 focus:ring-accent focus:border-accent';
const labelCls = 'block text-[10px] font-semibold text-slate-500 mb-1 uppercase';

function ElementForm() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const materials = useModelStore((s) => s.materials);
  const sections = useModelStore((s) => s.sections);
  const addElement = useModelStore((s) => s.addElement);
  const updateElement = useModelStore((s) => s.updateElement);
  const removeElement = useModelStore((s) => s.removeElement);
  const selectElement = useUIStore((s) => s.selectElement);
  const selectedElementId = useUIStore((s) => s.selectedElementId);

  const selectedElement = elements.find((e) => e.id === selectedElementId) ?? null;

  // This component is remounted via a `key` from its parent whenever the
  // selected element changes, so these initial values are re-derived per
  // mount instead of being synced from an effect.
  const [nodeI, setNodeI] = useState(selectedElement?.nodeI ?? '');
  const [nodeJ, setNodeJ] = useState(selectedElement?.nodeJ ?? '');
  const [materialId, setMaterialId] = useState(selectedElement?.materialId ?? materials[0]?.id ?? '');
  const [sectionId, setSectionId] = useState(selectedElement?.sectionId ?? sections[0]?.id ?? '');

  const handleAdd = () => {
    if (!nodeI || !nodeJ) return alert('Select both nodes');
    if (nodeI === nodeJ) return alert('Nodes must be different');
    const id = `E${elements.length + 1}`;
    addElement({ id, nodeI, nodeJ, materialId, sectionId, betaAngle: 0 });
    setNodeI(''); setNodeJ('');
  };

  const handleUpdate = () => {
    if (!selectedElement) return;
    if (!nodeI || !nodeJ) return alert('Select both nodes');
    if (nodeI === nodeJ) return alert('Nodes must be different');
    updateElement(selectedElement.id, { nodeI, nodeJ, materialId, sectionId });
  };

  const handleDelete = () => {
    if (!selectedElement) return;
    removeElement(selectedElement.id);
    selectElement(null);
  };

  const handleCancelEdit = () => {
    selectElement(null);
    setNodeI('');
    setNodeJ('');
    setMaterialId(materials[0]?.id || '');
    setSectionId(sections[0]?.id || '');
  };

  const isEditing = !!selectedElement;

  // Add / Edit Element form
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {isEditing ? `Edit Element — ${selectedElement.id}` : 'Add Element'}
        </h3>
        {isEditing && (
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={handleDelete}
              title="Delete element"
            >
              <span className="material-icons-round text-sm text-accent-error">delete</span>
            </button>
            <button
              className="p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={handleCancelEdit}
              title="Cancel editing"
            >
              <span className="material-icons-round text-sm text-slate-400">close</span>
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Node I</label>
            <select className={inputCls} value={nodeI} onChange={(e) => setNodeI(e.target.value)}>
              <option value="">Select...</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Node J</label>
            <select className={inputCls} value={nodeJ} onChange={(e) => setNodeJ(e.target.value)}>
              <option value="">Select...</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Material</label>
          <select className={inputCls} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Section</label>
          <select className={inputCls} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {isEditing ? (
          <button
            className="w-full py-2 bg-accent text-white text-sm font-bold rounded hover:bg-accent-hover transition-colors cursor-pointer"
            onClick={handleUpdate}
          >
            UPDATE ELEMENT
          </button>
        ) : (
          <button
            className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer"
            onClick={handleAdd}
          >
            ADD ELEMENT
          </button>
        )}
      </div>
    </div>
  );
}

export function ElementEditor() {
  const elements = useModelStore((s) => s.elements);
  const removeElement = useModelStore((s) => s.removeElement);
  const selectElement = useUIStore((s) => s.selectElement);
  const selectedElementId = useUIStore((s) => s.selectedElementId);

  return (
    <div className="flex flex-col h-full">
      <ElementForm key={selectedElementId ?? 'new'} />

      {/* Element list */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 bg-slate-800/50 border-y border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase">Elements ({elements.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1 shadow-sm">
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                <th className="px-4 py-2 w-14">ID</th>
                <th className="px-4 py-2">Nodes</th>
                <th className="px-4 py-2">Material</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono divide-y divide-slate-800/50">
              {elements.map((elem) => {
                const isSelected = selectedElementId === elem.id;
                return (
                  <tr
                    key={elem.id}
                    className={`node-list-item hover:bg-slate-800 group transition-colors cursor-pointer ${
                      isSelected ? 'bg-accent/10' : ''
                    }`}
                    onClick={() => selectElement(isSelected ? null : elem.id)}
                  >
                    <td className="px-4 py-2 text-accent font-bold">{elem.id}</td>
                    <td className="px-4 py-2 text-slate-400">{elem.nodeI} → {elem.nodeJ}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs font-sans">{elem.materialId}</td>
                    <td className="px-4 py-2">
                      <span
                        className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                        onClick={(e) => { e.stopPropagation(); removeElement(elem.id); if (isSelected) selectElement(null); }}
                        title="Delete element"
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

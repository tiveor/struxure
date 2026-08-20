import { useState } from 'react';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { unitLabel, toDisplay, fromDisplay } from '../../utils/units';
import type { UnitSystem } from '../../utils/units';

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded text-sm p-1.5 text-center font-mono text-slate-200 focus:ring-accent focus:border-accent';
const labelCls = 'block text-[10px] font-semibold text-slate-500 mb-1 uppercase';

/** Rounds a stored length to 4 decimals in the user's display units. */
function toDisplayLength(v: number, unit: UnitSystem): number {
  return +toDisplay(v, 'length', unit).toFixed(4);
}

function NodeForm() {
  const nodes = useModelStore((s) => s.nodes);
  const addNode = useModelStore((s) => s.addNode);
  const removeNode = useModelStore((s) => s.removeNode);
  const updateNode = useModelStore((s) => s.updateNode);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const selectNode = useUIStore((s) => s.selectNode);
  const unitSystem = useUIStore((s) => s.unitSystem);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // This component is remounted via a `key` from its parent whenever the
  // selected node changes, so these initial values are re-derived per
  // mount instead of being synced from an effect.
  const [newId, setNewId] = useState(selectedNode?.id ?? '');
  const [x, setX] = useState(() => (selectedNode ? toDisplayLength(selectedNode.x, unitSystem) : 0));
  const [y, setY] = useState(() => (selectedNode ? toDisplayLength(selectedNode.y, unitSystem) : 0));
  const [z, setZ] = useState(() => (selectedNode ? toDisplayLength(selectedNode.z, unitSystem) : 0));

  const handleAdd = () => {
    const id = newId || `N${nodes.length + 1}`;
    if (nodes.find((n) => n.id === id)) {
      alert(`Node "${id}" already exists`);
      return;
    }
    addNode({
      id,
      x: fromDisplay(x, 'length', unitSystem),
      y: fromDisplay(y, 'length', unitSystem),
      z: fromDisplay(z, 'length', unitSystem),
    });
    setNewId('');
    setX(0); setY(0); setZ(0);
  };

  const handleUpdate = () => {
    if (!selectedNode) return;
    updateNode(selectedNode.id, {
      x: fromDisplay(x, 'length', unitSystem),
      y: fromDisplay(y, 'length', unitSystem),
      z: fromDisplay(z, 'length', unitSystem),
    });
  };

  const handleDelete = () => {
    if (!selectedNode) return;
    removeNode(selectedNode.id);
    selectNode(null);
  };

  const handleCancelEdit = () => {
    selectNode(null);
    setNewId('');
    setX(0); setY(0); setZ(0);
  };

  const isEditing = !!selectedNode;

  // Add / Edit Node form
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {isEditing ? `Edit Node — ${selectedNode.id}` : 'Add Node'}
        </h3>
        {isEditing && (
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={handleDelete}
              title="Delete node"
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
        {!isEditing && (
          <div>
            <label className={labelCls}>Node ID</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent"
              placeholder="Auto-generate ID"
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>X ({unitLabel('length', unitSystem)})</label>
            <input
              className={inputCls}
              type="number"
              value={x}
              onChange={(e) => setX(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={labelCls}>Y ({unitLabel('length', unitSystem)})</label>
            <input
              className={inputCls}
              type="number"
              value={y}
              onChange={(e) => setY(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className={labelCls}>Z ({unitLabel('length', unitSystem)})</label>
            <input
              className={inputCls}
              type="number"
              value={z}
              onChange={(e) => setZ(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        {isEditing ? (
          <button
            className="w-full py-2 bg-accent text-white text-sm font-bold rounded hover:bg-accent-hover transition-colors cursor-pointer"
            onClick={handleUpdate}
          >
            UPDATE NODE
          </button>
        ) : (
          <button
            className="w-full py-2 bg-slate-100 text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity cursor-pointer"
            onClick={handleAdd}
          >
            ADD NODE
          </button>
        )}
      </div>
    </div>
  );
}

export function NodeEditor() {
  const nodes = useModelStore((s) => s.nodes);
  const removeNode = useModelStore((s) => s.removeNode);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const selectNode = useUIStore((s) => s.selectNode);
  const unitSystem = useUIStore((s) => s.unitSystem);

  return (
    <div className="flex flex-col h-full">
      <NodeForm key={selectedNodeId ?? 'new'} />

      {/* Node list table */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 bg-slate-800/50 border-y border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase">Nodes ({nodes.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1 shadow-sm">
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                <th className="px-4 py-2 w-12">ID</th>
                <th className="px-4 py-2">Coordinates (X, Y, Z)</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono divide-y divide-slate-800/50">
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                return (
                  <tr
                    key={node.id}
                    className={`node-list-item hover:bg-slate-800 group transition-colors cursor-pointer ${
                      isSelected ? 'bg-accent/10' : ''
                    }`}
                    onClick={() => selectNode(isSelected ? null : node.id)}
                  >
                    <td className="px-4 py-2 text-accent font-bold">{node.id}</td>
                    <td className="px-4 py-2 text-slate-400">({toDisplay(node.x, 'length', unitSystem).toFixed(1)}, {toDisplay(node.y, 'length', unitSystem).toFixed(1)}, {toDisplay(node.z, 'length', unitSystem).toFixed(1)})</td>
                    <td className="px-4 py-2">
                      <span
                        className="material-icons-round text-sm opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-red-400"
                        onClick={(e) => { e.stopPropagation(); removeNode(node.id); if (isSelected) selectNode(null); }}
                        title="Delete node"
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

import { useUIStore } from '../../store/ui-store';
import type { ActivePanel } from '../../store/ui-store';
import { Tooltip } from '../shared/Tooltip';
import { NodeEditor } from '../panels/NodeEditor';
import { ElementEditor } from '../panels/ElementEditor';
import { MaterialEditor } from '../panels/MaterialEditor';
import { SectionEditor } from '../panels/SectionEditor';
import { LoadEditor } from '../panels/LoadEditor';
import { SupportEditor } from '../panels/SupportEditor';
import { ResultsPanel } from '../panels/ResultsPanel';

const panels: { key: ActivePanel; label: string; icon: string }[] = [
  { key: 'nodes', label: 'Nodes', icon: 'scatter_plot' },
  { key: 'elements', label: 'Elements', icon: 'linear_scale' },
  { key: 'materials', label: 'Materials', icon: 'layers' },
  { key: 'loads', label: 'Loads', icon: 'arrow_downward' },
  { key: 'supports', label: 'Supports', icon: 'push_pin' },
  { key: 'sections', label: 'Sections', icon: 'crop_square' },
  { key: 'results', label: 'Results', icon: 'analytics' },
];

export function Sidebar() {
  const activePanel = useUIStore((s) => s.activePanel);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`border-r border-slate-800 bg-surface-1 flex flex-col shrink-0 transition-all duration-300 ${
        collapsed ? 'w-12' : 'w-80'
      }`}
    >
      {/* Collapse toggle */}
      <div className={`flex items-center border-b border-slate-800 shrink-0 ${collapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'}`}>
        {!collapsed && (
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model</span>
        )}
        <Tooltip label={collapsed ? 'Expand' : 'Collapse'} position="right">
          <button
            className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer"
            onClick={toggleSidebar}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </Tooltip>
      </div>

      {collapsed ? (
        /* Collapsed: icon-only vertical tabs */
        <div className="flex flex-col items-center py-2 gap-1">
          {panels.map((p) => (
            <Tooltip key={p.key} label={p.label} position="right">
              <button
                className={`p-2 rounded transition-colors cursor-pointer ${
                  activePanel === p.key
                    ? 'text-accent bg-slate-700'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                }`}
                onClick={() => { setActivePanel(p.key); toggleSidebar(); }}
              >
                <span className="material-icons-round" style={{ fontSize: '20px' }}>{p.icon}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      ) : (
        <>
          {/* Tab row - scrollable horizontally */}
          <div className="flex p-2 space-x-1 border-b border-slate-800 overflow-x-auto shrink-0 hide-scrollbar">
            {panels.map((p) => (
              <button
                key={p.key}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
                  activePanel === p.key
                    ? 'bg-slate-700 text-accent'
                    : 'text-slate-500 hover:bg-slate-700/50'
                }`}
                onClick={() => setActivePanel(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {activePanel === 'nodes' && <NodeEditor />}
            {activePanel === 'elements' && <ElementEditor />}
            {activePanel === 'materials' && <MaterialEditor />}
            {activePanel === 'sections' && <SectionEditor />}
            {activePanel === 'loads' && <LoadEditor />}
            {activePanel === 'supports' && <SupportEditor />}
            {activePanel === 'results' && <ResultsPanel />}
          </div>
        </>
      )}
    </aside>
  );
}

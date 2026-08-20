import { useState } from 'react';

interface ReportDialogProps {
  onClose: () => void;
  onGenerate: (options: { projectName: string; engineer: string; description: string }) => Promise<void>;
}

export function ReportDialog({ onClose, onGenerate }: ReportDialogProps) {
  const [projectName, setProjectName] = useState('Structural Analysis');
  const [engineer, setEngineer] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate({ projectName, engineer, description });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 p-6 w-[420px] max-w-[90vw]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <span className="material-icons-round text-accent" style={{ fontSize: '24px' }}>picture_as_pdf</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Export PDF Report</h3>
            <p className="text-xs text-slate-400">Generate a professional analysis report</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Project Name</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent"
              placeholder="e.g. Industrial Warehouse"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Engineer</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent"
              placeholder="Name (optional)"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Description</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent resize-none"
              placeholder="Brief project description (optional)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
            disabled={generating}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/80 rounded-lg transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <span className="material-icons-round animate-spin" style={{ fontSize: '16px' }}>hourglass_empty</span>
                Generating...
              </>
            ) : (
              <>
                <span className="material-icons-round" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                Generate PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

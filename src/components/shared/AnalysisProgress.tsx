import { useResultsStore } from '../../store/results-store';
import type { SolverStep } from '../../core/solver-manager';

const STEP_LABELS: Record<SolverStep, string> = {
  assembly: 'Assembling stiffness matrix',
  boundaries: 'Applying boundary conditions',
  solving: 'Solving system of equations',
  postprocess: 'Post-processing results',
  complete: 'Complete',
};

const STEP_ORDER: SolverStep[] = ['assembly', 'boundaries', 'solving', 'postprocess', 'complete'];

export function AnalysisProgress({ onCancel }: { onCancel: () => void }) {
  const isSolving = useResultsStore((s) => s.isSolving);
  const solverStep = useResultsStore((s) => s.solverStep);
  const solverProgress = useResultsStore((s) => s.solverProgress);

  if (!isSolving) return null;

  const progressPercent = Math.round(solverProgress * 100);
  const currentStepIdx = solverStep ? STEP_ORDER.indexOf(solverStep) : -1;

  return (
    <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 p-6 w-80">
        <h3 className="text-lg font-bold text-white mb-3">Analyzing...</h3>

        {/* Progress bar */}
        <div className="w-full bg-slate-700 rounded-full h-2.5 mb-4">
          <div
            className="bg-accent h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 text-right mb-3">{progressPercent}%</p>

        {/* Step list */}
        <div className="space-y-2 mb-4">
          {STEP_ORDER.filter((s) => s !== 'complete').map((step, i) => {
            const isDone = currentStepIdx > i;
            const isCurrent = currentStepIdx === i;
            return (
              <div key={step} className="flex items-center gap-2">
                {isDone ? (
                  <span className="material-icons-round text-green-400" style={{ fontSize: '16px' }}>check_circle</span>
                ) : isCurrent ? (
                  <span className="material-icons-round text-accent animate-spin" style={{ fontSize: '16px' }}>autorenew</span>
                ) : (
                  <span className="material-icons-round text-slate-600" style={{ fontSize: '16px' }}>radio_button_unchecked</span>
                )}
                <span className={`text-xs ${isDone ? 'text-slate-400' : isCurrent ? 'text-white' : 'text-slate-600'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

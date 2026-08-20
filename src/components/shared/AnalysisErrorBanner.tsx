import { useResultsStore } from '../../store/results-store';

export function AnalysisErrorBanner() {
  const error = useResultsStore((s) => s.analysisError);
  const clearError = () => useResultsStore.setState({ analysisError: null });

  if (!error) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-red-950/80 border-b border-red-800/50 text-red-200 text-sm shrink-0">
      <span className="material-icons-round text-red-400" style={{ fontSize: '18px' }}>
        warning
      </span>
      <span className="flex-1">{error}</span>
      <button
        className="text-red-400 hover:text-red-200 transition-colors cursor-pointer"
        onClick={clearError}
        title="Dismiss"
      >
        <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
      </button>
    </div>
  );
}

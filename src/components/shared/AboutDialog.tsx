interface AboutDialogProps {
  onClose: () => void;
  /** Mobile uses `active:` variants; desktop uses `hover:`. */
  variant?: 'desktop' | 'mobile';
}

export function AboutDialog({ onClose, variant = 'desktop' }: AboutDialogProps) {
  const linkHover = variant === 'mobile' ? 'active:text-accent' : 'hover:text-accent transition-colors';
  const buttonHover = variant === 'mobile' ? 'active:bg-slate-600' : 'hover:bg-slate-600 transition-colors';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4 p-2">
          <img src={`${import.meta.env.BASE_URL}favicon_white.svg`} alt="Struxure" className="w-full h-full" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-1">STRUXURE</h2>
        <p className="text-slate-400 text-sm mb-4">Structural FEA in the Browser</p>
        <div className="inline-block bg-slate-800 text-slate-300 text-sm font-mono px-3 py-1 rounded-lg mb-6">
          v{__APP_VERSION__}
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-2">
          <p className="text-sm text-slate-300">
            Built by{' '}
            <a href="https://alvarotech.dev/portfolio" target="_blank" rel="noopener noreferrer" className={`font-semibold text-white ${linkHover} underline underline-offset-2`}>
              alvarotech.dev
            </a>{' '}
            + <span className="font-semibold text-blue-400">Claude Code</span>
          </p>
          <p className="text-xs text-slate-500">React &middot; Three.js &middot; TypeScript &middot; Vite</p>
          <p className="text-xs text-slate-500">
            Open source under{' '}
            <a href="https://github.com/tiveor/struxure/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${linkHover}`}>
              Apache-2.0
            </a>
          </p>
        </div>

        <div className="border-t border-slate-700 mt-4 pt-4">
          <p className="text-xs text-amber-300/90 leading-relaxed text-left">
            <span className="font-semibold">For education and preliminary design only.</span>{' '}
            Results are not independently verified and are not a substitute for
            review by a licensed professional engineer. Provided without warranty
            of any kind.
          </p>
        </div>

        <button
          className={`mt-6 px-6 py-2 bg-slate-700 ${buttonHover} text-white rounded-lg text-sm font-medium cursor-pointer`}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

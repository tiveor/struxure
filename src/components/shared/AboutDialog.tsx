import { useEscapeKey } from '../../hooks/use-escape-key';
interface AboutDialogProps {
  onClose: () => void;
  /** Mobile uses `active:` variants; desktop uses `hover:`. */
  variant?: 'desktop' | 'mobile';
}

export function AboutDialog({ onClose, variant = 'desktop' }: AboutDialogProps) {
  const linkHover = variant === 'mobile' ? 'active:text-accent' : 'hover:text-accent transition-colors';
  const buttonHover = variant === 'mobile' ? 'active:bg-slate-600' : 'hover:bg-slate-600 transition-colors';

  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      {/* Click-outside catcher. Keyboard users dismiss with Escape instead, so
          it carries no accessible name and stays out of the tab order. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
        className="relative bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4 p-2">
          <img src={`${import.meta.env.BASE_URL}favicon_white.svg`} alt="Struxure" className="w-full h-full" />
        </div>
        <h2 id="about-dialog-title" className="text-2xl font-bold text-white tracking-tight mb-1">STRUXURE</h2>
        <p className="text-slate-400 text-sm mb-4">Structural FEA in the Browser</p>
        <div className="inline-block bg-slate-800 text-slate-300 text-sm font-mono px-3 py-1 rounded-lg mb-6">
          v{__APP_VERSION__}
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-2">
          <p className="text-sm text-slate-300">
            Built by{' '}
            <a href="https://alvarotech.dev" target="_blank" rel="noopener noreferrer" className={`font-semibold text-white ${linkHover} underline underline-offset-2`}>
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
          <div className="flex items-center justify-center gap-4 pt-2">
            <a
              href="https://github.com/tiveor/struxure"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-xs text-slate-300 ${linkHover}`}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="w-4 h-4 fill-current">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://buymeacoffee.com/tiveor"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-xs text-slate-300 ${linkHover}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8h1a4 4 0 010 8h-1" />
                <path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
                <path d="M6 2v2M10 2v2M14 2v2" />
              </svg>
              Buy me a coffee
            </a>
          </div>
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

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'struxure-install-dismissed';

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(
    () => !isStandalone() && !sessionStorage.getItem(DISMISSED_KEY) && isIos(),
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem(DISMISSED_KEY) || isIos()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    handleDismiss();
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosPrompt(false);
    sessionStorage.setItem(DISMISSED_KEY, '1');
  };

  if (dismissed || isStandalone()) return null;
  if (!deferredPrompt && !showIosPrompt) return null;

  return (
    <div className="mx-4 mb-3 rounded-xl bg-slate-800/95 backdrop-blur-md border border-slate-700 p-3 animate-in slide-in-from-bottom">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
          <span className="material-icons-round text-white" style={{ fontSize: '22px' }}>install_mobile</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install Struxure</p>
          {showIosPrompt ? (
            <p className="text-xs text-slate-400 mt-0.5">
              Tap{' '}
              <span className="material-icons-round align-middle text-accent" style={{ fontSize: '14px' }}>ios_share</span>
              {' '}then <strong className="text-slate-300">"Add to Home Screen"</strong>
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">Add to your home screen for quick access</p>
          )}
        </div>
        <button onClick={handleDismiss} className="p-1 -mt-0.5 -mr-1 text-slate-500 active:text-slate-300">
          <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
        </button>
      </div>
      {deferredPrompt && (
        <button
          onClick={handleInstall}
          className="mt-2.5 w-full py-2 rounded-lg bg-accent text-white text-sm font-semibold active:opacity-80"
        >
          Install App
        </button>
      )}
    </div>
  );
}

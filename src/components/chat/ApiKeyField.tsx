import { useId } from 'react';
import { useChatStore } from '../../store/chat-store';
import type { ApiKeyStorage } from '../../store/chat-store';

const STORAGE_OPTIONS: { value: ApiKeyStorage; label: string; where: string }[] = [
  {
    value: 'session',
    label: 'This tab only',
    where: 'Kept in session storage until you close this tab.',
  },
  {
    value: 'device',
    label: 'Remember on this device',
    where: 'Kept in local storage on this device until you clear it.',
  },
  {
    value: 'memory',
    label: "Don't store",
    where: 'Kept in memory only. You will re-enter it after a reload.',
  },
];

/** API key input with the storage choice and a warning about where the key lives. */
export function ApiKeyField({ placeholder }: { placeholder: string }) {
  const apiKey = useChatStore((s) => s.settings.onlineApiKey);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const mode = useChatStore((s) => s.apiKeyStorage);
  const setMode = useChatStore((s) => s.setApiKeyStorage);
  const inputId = useId();
  const warningId = useId();
  const current = STORAGE_OPTIONS.find((o) => o.value === mode) ?? STORAGE_OPTIONS[0];

  return (
    <div className="space-y-1.5">
      <div>
        <label htmlFor={inputId} className="text-[10px] text-slate-400 block mb-0.5">API Key</label>
        <input
          id={inputId}
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => updateSettings({ onlineApiKey: e.target.value })}
          placeholder={placeholder}
          aria-describedby={warningId}
          className="w-full bg-slate-900 border border-slate-700 rounded text-xs px-2.5 py-1.5 text-slate-200 placeholder:text-slate-600 focus:ring-accent focus:border-accent"
        />
      </div>

      <fieldset>
        <legend className="text-[10px] text-slate-400 mb-0.5">Key storage</legend>
        <div className="flex gap-1">
          {STORAGE_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex-1 text-center px-1.5 py-1 text-[10px] font-medium rounded border transition-colors cursor-pointer ${
                mode === o.value
                  ? 'bg-accent/20 text-accent border-accent/40'
                  : 'text-slate-400 border-slate-700 hover:bg-slate-700/50'
              }`}
            >
              <input
                type="radio"
                name="api-key-storage"
                value={o.value}
                checked={mode === o.value}
                onChange={() => setMode(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <p
        id={warningId}
        role="note"
        className="flex gap-1.5 text-[10px] leading-relaxed text-amber-400/90 bg-amber-950/20 border border-amber-800/40 rounded p-2"
      >
        <span className="material-icons-round shrink-0" style={{ fontSize: '12px' }} aria-hidden="true">warning</span>
        <span>
          {current.where} Any script running on this site can read it, so use a key you can revoke.
        </span>
      </p>
    </div>
  );
}

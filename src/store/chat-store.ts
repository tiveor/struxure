import { create } from 'zustand';

export type AiProvider = 'local' | 'online';
export type AiTab = 'local' | 'online' | 'settings';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  error?: string;
  modelLoaded?: boolean;
}

export interface AiSettings {
  // Local (LM Studio)
  localEndpoint: string;
  localModelName: string;
  localTemperature: number;
  // Online (any OpenAI-compatible endpoint; defaults to OpenRouter)
  onlineEndpoint: string;
  onlineApiKey: string;
  onlineModel: string;
  onlineTemperature: number;
}

const DEFAULT_SETTINGS: AiSettings = {
  localEndpoint: 'http://localhost:1234/v1/chat/completions',
  localModelName: '',
  localTemperature: 0.3,
  onlineEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  onlineApiKey: '',
  onlineModel: 'anthropic/claude-sonnet-4',
  onlineTemperature: 0.3,
};

/**
 * Where the online provider's API key is kept.
 * - `session`: sessionStorage, cleared when the tab closes (default).
 * - `device`: localStorage, survives browser restarts (explicit opt-in).
 * - `memory`: never written to storage, lost on reload.
 */
export type ApiKeyStorage = 'session' | 'device' | 'memory';

export const DEFAULT_API_KEY_STORAGE: ApiKeyStorage = 'session';

/** Non-secret settings plus the chosen key mode, in localStorage. Never holds the key. */
export const SETTINGS_STORAGE_KEY = 'struxure-ai-settings';
/** The API key itself, in sessionStorage or localStorage depending on the mode. */
export const API_KEY_STORAGE_KEY = 'struxure-ai-key';

const API_KEY_STORAGE_MODES: readonly string[] = ['session', 'device', 'memory'];

function isApiKeyStorage(v: unknown): v is ApiKeyStorage {
  return typeof v === 'string' && API_KEY_STORAGE_MODES.includes(v);
}

/** Storage can be missing (Node) or throw on access (blocked site data). */
function getStorage(kind: 'local' | 'session'): Storage | undefined {
  try {
    return (kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage) ?? undefined;
  } catch {
    return undefined;
  }
}

function safeGet(storage: Storage | undefined, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

function safeSet(storage: Storage | undefined, key: string, value: string): void {
  try { storage?.setItem(key, value); } catch { /* ignore */ }
}

function safeRemove(storage: Storage | undefined, key: string): void {
  try { storage?.removeItem(key); } catch { /* ignore */ }
}

/**
 * Writes the key to the storage its mode selects and removes it from every
 * other storage, so moving to a less persistent mode leaves no stale copy.
 */
function writeApiKey(mode: ApiKeyStorage, key: string): void {
  const local = getStorage('local');
  const session = getStorage('session');
  const target = mode === 'device' ? local : mode === 'session' ? session : undefined;
  for (const storage of [local, session]) {
    if (storage && storage === target && key) safeSet(storage, API_KEY_STORAGE_KEY, key);
    else safeRemove(storage, API_KEY_STORAGE_KEY);
  }
}

/** Persists the non-secret settings. The key is stripped and handled by writeApiKey. */
function writeSettings(settings: AiSettings, mode: ApiKeyStorage): void {
  const { onlineApiKey: _key, ...rest } = settings;
  safeSet(getStorage('local'), SETTINGS_STORAGE_KEY, JSON.stringify({ ...rest, apiKeyStorage: mode }));
}

/**
 * Reads settings and the key. Older versions stored the key in plaintext
 * inside `struxure-ai-settings` in localStorage. That legacy key is moved to
 * the new default (session storage) and the persistent copy is deleted: the
 * user keeps working this session and can opt back in to "remember".
 */
function loadAiState(): { settings: AiSettings; apiKeyStorage: ApiKeyStorage } {
  const local = getStorage('local');
  const session = getStorage('session');

  let stored: Record<string, unknown> = {};
  try {
    const raw = safeGet(local, SETTINGS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') stored = parsed as Record<string, unknown>;
  } catch { /* ignore corrupt settings */ }

  const { onlineApiKey: legacyKey, apiKeyStorage: storedMode, ...rest } = stored;
  const apiKeyStorage = isApiKeyStorage(storedMode) ? storedMode : DEFAULT_API_KEY_STORAGE;

  const saved =
    apiKeyStorage === 'device' ? safeGet(local, API_KEY_STORAGE_KEY)
    : apiKeyStorage === 'session' ? safeGet(session, API_KEY_STORAGE_KEY)
    : null;
  const key = saved || (typeof legacyKey === 'string' ? legacyKey : '');

  const settings: AiSettings = { ...DEFAULT_SETTINGS, ...(rest as Partial<AiSettings>), onlineApiKey: key };

  // Rewriting drops the legacy plaintext field; writeApiKey also removes any
  // copy sitting in a storage the current mode does not use.
  if (legacyKey !== undefined) writeSettings(settings, apiKeyStorage);
  writeApiKey(apiKeyStorage, key);

  return { settings, apiKeyStorage };
}

const initial = loadAiState();

interface ChatState {
  // Panel
  collapsed: boolean;
  togglePanel: () => void;
  activeTab: AiTab;
  setActiveTab: (tab: AiTab) => void;

  // Messages (per provider)
  localMessages: ChatMessage[];
  onlineMessages: ChatMessage[];
  addMessage: (provider: AiProvider, msg: ChatMessage) => void;
  updateMessage: (provider: AiProvider, id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: (provider: AiProvider) => void;

  // Generation state
  isGenerating: boolean;
  setGenerating: (v: boolean) => void;

  // Settings
  settings: AiSettings;
  updateSettings: (updates: Partial<AiSettings>) => void;
  apiKeyStorage: ApiKeyStorage;
  setApiKeyStorage: (mode: ApiKeyStorage) => void;

  // Connection
  connectionStatus: 'unknown' | 'connected' | 'error';
  setConnectionStatus: (s: 'unknown' | 'connected' | 'error') => void;
}

export const useChatStore = create<ChatState>((set) => ({
  collapsed: true,
  togglePanel: () => set((s) => ({ collapsed: !s.collapsed })),
  // Local (LM Studio) is the default: it needs no API key.
  activeTab: 'local',
  setActiveTab: (tab) => set({ activeTab: tab }),

  localMessages: [],
  onlineMessages: [],
  addMessage: (provider, msg) =>
    set((s) => provider === 'local'
      ? { localMessages: [...s.localMessages, msg] }
      : { onlineMessages: [...s.onlineMessages, msg] }),
  updateMessage: (provider, id, updates) =>
    set((s) => {
      const key = provider === 'local' ? 'localMessages' : 'onlineMessages';
      return { [key]: s[key].map((m) => m.id === id ? { ...m, ...updates } : m) };
    }),
  clearMessages: (provider) =>
    set(provider === 'local' ? { localMessages: [] } : { onlineMessages: [] }),

  isGenerating: false,
  setGenerating: (v) => set({ isGenerating: v }),

  settings: initial.settings,
  updateSettings: (updates) =>
    set((s) => {
      const next = { ...s.settings, ...updates };
      writeSettings(next, s.apiKeyStorage);
      if ('onlineApiKey' in updates) writeApiKey(s.apiKeyStorage, next.onlineApiKey);
      return { settings: next };
    }),
  apiKeyStorage: initial.apiKeyStorage,
  setApiKeyStorage: (mode) =>
    set((s) => {
      writeSettings(s.settings, mode);
      writeApiKey(mode, s.settings.onlineApiKey);
      return { apiKeyStorage: mode };
    }),

  connectionStatus: 'unknown',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SETTINGS = 'struxure-ai-settings';
const KEY = 'struxure-ai-key';
const SECRET = 'sk-test-not-a-real-key';

/** Minimal in-memory Storage so each test controls both storages explicitly. */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  /** Every stored value joined, to assert a secret appears nowhere. */
  dump() { return [...this.data.values()].join('\n'); }
}

let local: MemoryStorage;
let session: MemoryStorage;

/** Re-imports the store so it runs its load and migration against the current storages. */
async function loadStore() {
  vi.resetModules();
  const mod = await import('../chat-store');
  return mod.useChatStore;
}

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI settings defaults', () => {
  it('opens on the local (LM Studio) provider and keeps the key for this session', async () => {
    const store = await loadStore();
    expect(store.getState().activeTab).toBe('local');
    expect(store.getState().apiKeyStorage).toBe('session');
    expect(store.getState().settings.onlineApiKey).toBe('');
  });

  it('never writes the key to localStorage by default', async () => {
    const store = await loadStore();
    store.getState().updateSettings({ onlineApiKey: SECRET });
    store.getState().updateSettings({ onlineModel: 'gpt-4o' });

    expect(local.dump()).not.toContain(SECRET);
    expect(session.getItem(KEY)).toBe(SECRET);
    expect(JSON.parse(local.getItem(SETTINGS)!)).toMatchObject({ onlineModel: 'gpt-4o', apiKeyStorage: 'session' });
  });
});

describe('API key storage modes', () => {
  it('session: survives a reload in the same tab, not in localStorage', async () => {
    let store = await loadStore();
    store.getState().updateSettings({ onlineApiKey: SECRET });

    store = await loadStore();
    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
    expect(local.dump()).not.toContain(SECRET);
  });

  it('session: is gone once the session storage is gone (new tab or restart)', async () => {
    let store = await loadStore();
    store.getState().updateSettings({ onlineApiKey: SECRET });

    session.clear();
    store = await loadStore();
    expect(store.getState().settings.onlineApiKey).toBe('');
  });

  it('device: persists in localStorage across sessions', async () => {
    let store = await loadStore();
    store.getState().setApiKeyStorage('device');
    store.getState().updateSettings({ onlineApiKey: SECRET });

    expect(local.getItem(KEY)).toBe(SECRET);
    expect(session.getItem(KEY)).toBeNull();

    session.clear();
    store = await loadStore();
    expect(store.getState().apiKeyStorage).toBe('device');
    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
  });

  it('memory: writes the key to no storage and forgets it on reload', async () => {
    let store = await loadStore();
    store.getState().setApiKeyStorage('memory');
    store.getState().updateSettings({ onlineApiKey: SECRET });

    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
    expect(local.dump()).not.toContain(SECRET);
    expect(session.dump()).not.toContain(SECRET);

    store = await loadStore();
    expect(store.getState().apiKeyStorage).toBe('memory');
    expect(store.getState().settings.onlineApiKey).toBe('');
  });

  it('clearing the key removes it from storage', async () => {
    const store = await loadStore();
    store.getState().setApiKeyStorage('device');
    store.getState().updateSettings({ onlineApiKey: SECRET });
    store.getState().updateSettings({ onlineApiKey: '' });

    expect(local.getItem(KEY)).toBeNull();
  });
});

describe('switching modes clears the previous storage', () => {
  it('device -> session removes the localStorage copy', async () => {
    const store = await loadStore();
    store.getState().setApiKeyStorage('device');
    store.getState().updateSettings({ onlineApiKey: SECRET });

    store.getState().setApiKeyStorage('session');
    expect(local.dump()).not.toContain(SECRET);
    expect(session.getItem(KEY)).toBe(SECRET);
    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
  });

  it('device -> memory removes it from both storages', async () => {
    const store = await loadStore();
    store.getState().setApiKeyStorage('device');
    store.getState().updateSettings({ onlineApiKey: SECRET });

    store.getState().setApiKeyStorage('memory');
    expect(local.dump()).not.toContain(SECRET);
    expect(session.dump()).not.toContain(SECRET);
    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
  });

  it('session -> device moves it and removes the sessionStorage copy', async () => {
    const store = await loadStore();
    store.getState().updateSettings({ onlineApiKey: SECRET });

    store.getState().setApiKeyStorage('device');
    expect(local.getItem(KEY)).toBe(SECRET);
    expect(session.getItem(KEY)).toBeNull();
  });

  it('on load, a copy left in a storage the mode does not use is removed', async () => {
    local.setItem(SETTINGS, JSON.stringify({ apiKeyStorage: 'session' }));
    local.setItem(KEY, 'stale-copy');
    session.setItem(KEY, SECRET);

    const store = await loadStore();
    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
    expect(local.getItem(KEY)).toBeNull();
  });
});

describe('migration from the plaintext localStorage layout', () => {
  beforeEach(() => {
    local.setItem(SETTINGS, JSON.stringify({
      localEndpoint: 'http://localhost:1234/v1/chat/completions',
      onlineEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
      onlineModel: 'llama-3.3-70b-versatile',
      onlineApiKey: SECRET,
    }));
  });

  it('keeps the key usable this session but removes the persistent plaintext copy', async () => {
    const store = await loadStore();

    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
    expect(store.getState().apiKeyStorage).toBe('session');
    expect(session.getItem(KEY)).toBe(SECRET);
    expect(local.dump()).not.toContain(SECRET);
  });

  it('preserves the non-secret settings', async () => {
    const store = await loadStore();
    const stored = JSON.parse(local.getItem(SETTINGS)!);

    expect(store.getState().settings.onlineModel).toBe('llama-3.3-70b-versatile');
    expect(stored.onlineEndpoint).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(stored).not.toHaveProperty('onlineApiKey');
  });

  it('lets the user opt back in to remembering the key', async () => {
    const store = await loadStore();
    store.getState().setApiKeyStorage('device');

    expect(local.getItem(KEY)).toBe(SECRET);
    expect(session.getItem(KEY)).toBeNull();
  });
});

describe('storage failures', () => {
  it('loads defaults when storage is unavailable', async () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('sessionStorage', undefined);

    const store = await loadStore();
    store.getState().updateSettings({ onlineApiKey: SECRET });
    expect(store.getState().settings.onlineApiKey).toBe(SECRET);
  });

  it('ignores corrupt settings JSON', async () => {
    local.setItem(SETTINGS, '{not json');
    const store = await loadStore();
    expect(store.getState().settings.localTemperature).toBe(0.3);
  });
});

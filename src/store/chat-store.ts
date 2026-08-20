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
  // Online (Claude API — future)
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

function loadSettings(): AiSettings {
  try {
    const stored = localStorage.getItem('struxure-ai-settings');
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

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

  // Connection
  connectionStatus: 'unknown' | 'connected' | 'error';
  setConnectionStatus: (s: 'unknown' | 'connected' | 'error') => void;
}

export const useChatStore = create<ChatState>((set) => ({
  collapsed: true,
  togglePanel: () => set((s) => ({ collapsed: !s.collapsed })),
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

  settings: loadSettings(),
  updateSettings: (updates) =>
    set((s) => {
      const next = { ...s.settings, ...updates };
      localStorage.setItem('struxure-ai-settings', JSON.stringify(next));
      return { settings: next };
    }),

  connectionStatus: 'unknown',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));

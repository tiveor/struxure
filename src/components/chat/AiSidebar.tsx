import { useRef, useEffect, useState } from 'react';
import { Tooltip } from '../shared/Tooltip';
import { useChatStore } from '../../store/chat-store';
import type { AiTab, AiProvider, ChatMessage } from '../../store/chat-store';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import { useResultsStore } from '../../store/results-store';
import { chatCompletionStream, pingServer, testConnection } from '../../utils/ai-client';
import type { ConnectionTestResult } from '../../utils/ai-client';
import { SYSTEM_PROMPT, buildUserMessage } from '../../utils/ai-system-prompt';
import { newId } from '../../utils/id';
import { extractAndValidateModel } from '../../utils/ai-model-validator';

const EXAMPLE_PROMPTS = [
  'Simple beam, 30ft span, 20 kip center load',
  'Cantilever, 15ft, W12x26, 5 kip tip load',
  'Portal frame, 2 stories, 3 bays, 20ft spans, 12ft height',
  '3D building, 2x2 bays, 3 stories, fixed bases',
];

const tabs: { key: AiTab; label: string; icon: string }[] = [
  { key: 'local', label: 'Local', icon: 'computer' },
  { key: 'online', label: 'Online', icon: 'cloud' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export function AiSidebar() {
  const collapsed = useChatStore((s) => s.collapsed);
  const togglePanel = useChatStore((s) => s.togglePanel);
  const activeTab = useChatStore((s) => s.activeTab);
  const setActiveTab = useChatStore((s) => s.setActiveTab);

  return (
    <aside
      className={`border-l border-slate-800 bg-surface-1 flex flex-col shrink-0 transition-all duration-300 ${
        collapsed ? 'w-12' : 'w-96'
      }`}
    >
      {/* Collapse toggle */}
      <div className={`flex items-center border-b border-slate-800 shrink-0 ${collapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'}`}>
        {!collapsed && (
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Assistant <span className="text-slate-600 normal-case">(beta)</span></span>
        )}
        <Tooltip label={collapsed ? 'Expand' : 'Collapse'} position="left">
          <button
            className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer"
            onClick={togglePanel}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>
              {collapsed ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
        </Tooltip>
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center py-2 gap-1">
          {tabs.map((t) => (
            <Tooltip key={t.key} label={t.label} position="left">
              <button
                className={`p-2 rounded transition-colors cursor-pointer ${
                  activeTab === t.key
                    ? 'text-accent bg-slate-700'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                }`}
                onClick={() => { setActiveTab(t.key); togglePanel(); }}
              >
                <span className="material-icons-round" style={{ fontSize: '20px' }}>{t.icon}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      ) : (
        <>
          {/* Tab row */}
          <div className="flex p-2 space-x-1 border-b border-slate-800 shrink-0">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
                  activeTab === t.key
                    ? 'bg-slate-700 text-accent'
                    : 'text-slate-500 hover:bg-slate-700/50'
                }`}
                onClick={() => setActiveTab(t.key)}
              >
                <span className="material-icons-round" style={{ fontSize: '14px' }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTab === 'local' && <ChatTab provider="local" />}
            {activeTab === 'online' && <ChatTab provider="online" />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </>
      )}
    </aside>
  );
}

// ─── Chat Tab ────────────────────────────────────────────────

function ChatTab({ provider }: { provider: AiProvider }) {
  const messages = useChatStore((s) => provider === 'local' ? s.localMessages : s.onlineMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const setGenerating = useChatStore((s) => s.setGenerating);
  const settings = useChatStore((s) => s.settings);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const setConnectionStatus = useChatStore((s) => s.setConnectionStatus);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ping server on mount for local provider
  useEffect(() => {
    if (provider === 'local') {
      pingServer(settings.localEndpoint).then((ok) =>
        setConnectionStatus(ok ? 'connected' : 'error')
      );
    }
  }, [provider, settings.localEndpoint, setConnectionStatus]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: newId('msg'),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(provider, userMsg);

    // Build API messages
    const currentModel = useModelStore.getState().getModel();
    const hasModel = currentModel.nodes.length > 0;
    const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      {
        role: 'user',
        content: buildUserMessage(text, hasModel ? JSON.stringify(currentModel) : null),
      },
    ];

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: newId('msg'),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(provider, assistantMsg);
    setGenerating(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const endpoint = provider === 'local' ? settings.localEndpoint : settings.onlineEndpoint;
      const modelName = provider === 'local' ? settings.localModelName : settings.onlineModel;
      const temperature = provider === 'local' ? settings.localTemperature : settings.onlineTemperature;
      const apiKey = provider === 'online' ? settings.onlineApiKey : undefined;

      const response = await chatCompletionStream(
        { messages: apiMessages, endpoint, modelName, temperature, apiKey, signal: abort.signal },
        (partial) => updateMessage(provider, assistantMsg.id, { content: partial }),
      );

      if (provider === 'local') setConnectionStatus('connected');

      // Try to extract and validate model
      const validation = extractAndValidateModel(response);

      if (validation.success && validation.model) {
        updateMessage(provider, assistantMsg.id, {
          content: `Model generated: ${validation.model.nodes.length} nodes, ${validation.model.elements.length} elements`,
          modelLoaded: true,
        });

        // Load model (no auto-analyze — user decides when to run analysis)
        useModelStore.getState().loadModel(validation.model);
        useUIStore.getState().setModelName('AI Generated');
        useResultsStore.getState().clearResults();
        window.dispatchEvent(new Event('zoom-extents'));
      } else {
        updateMessage(provider, assistantMsg.id, {
          content: response.slice(0, 500),
          error: validation.errors.join('\n'),
        });
      }
    } catch (err) {
      if (provider === 'local') setConnectionStatus('error');
      const msg = err instanceof Error ? err.message : 'Connection failed';
      updateMessage(provider, assistantMsg.id, {
        content: '',
        error: msg.includes('fetch') || msg.includes('Failed')
          ? `Could not connect to ${provider === 'local' ? 'LM Studio' : 'API'}. Make sure the server is running.`
          : msg,
      });
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOnlineDisabled = provider === 'online' && !settings.onlineApiKey;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Connection status */}
      {provider === 'local' && (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] border-b border-slate-800 ${
          connectionStatus === 'connected' ? 'text-emerald-400' : connectionStatus === 'error' ? 'text-red-400' : 'text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-400' : connectionStatus === 'error' ? 'bg-red-400' : 'bg-slate-500'
          }`} />
          {connectionStatus === 'connected' ? 'LM Studio connected' : connectionStatus === 'error' ? 'LM Studio not reachable' : 'Checking...'}
          <button
            className="ml-auto text-slate-500 hover:text-slate-300 cursor-pointer"
            onClick={() => pingServer(settings.localEndpoint).then((ok) => setConnectionStatus(ok ? 'connected' : 'error'))}
          >
            <span className="material-icons-round" style={{ fontSize: '12px' }}>refresh</span>
          </button>
        </div>
      )}

      {provider === 'online' && !isOnlineDisabled && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-emerald-400 border-b border-slate-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Online ready — {settings.onlineModel || 'default model'}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          provider === 'online' && isOnlineDisabled ? (
            <SetupGuideOnline />
          ) : (
            <div className="py-6 px-1">
              <span className="material-icons-round text-slate-700 block mb-2 text-center" style={{ fontSize: '36px' }}>smart_toy</span>
              <p className="text-xs text-slate-500 text-center mb-3">Describe a structure</p>
              <div className="space-y-1.5">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); }}
                    className="w-full text-left text-[11px] text-slate-400 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg px-3 py-2 cursor-pointer transition-colors leading-snug"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isGenerating && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[10px] text-slate-500">Streaming...</span>
            <button onClick={handleCancel} className="ml-auto text-[10px] text-slate-500 hover:text-red-400 cursor-pointer flex items-center gap-0.5">
              <span className="material-icons-round" style={{ fontSize: '12px' }}>stop</span>
              Stop
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => clearMessages(provider)}
              className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Clear chat
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 5 * 20) + 'px';
              }
            }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a structure..."
            rows={1}
            disabled={isGenerating || isOnlineDisabled}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg text-sm px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:ring-accent focus:border-accent resize-none disabled:opacity-50 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating || isOnlineDisabled}
            className="p-2 bg-accent text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 self-end"
          >
            <span className="material-icons-round" style={{ fontSize: '20px' }}>send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
        isUser
          ? 'bg-accent/20 text-slate-100 border border-accent/30'
          : message.error
            ? 'bg-red-950/30 text-red-300 border border-red-800/50'
            : 'bg-slate-800 text-slate-200 border border-slate-700'
      }`}>
        {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
        {message.modelLoaded && (
          <div className="flex items-center gap-1 mt-1.5 text-emerald-400">
            <span className="material-icons-round" style={{ fontSize: '12px' }}>check_circle</span>
            <span className="text-[10px]">Model loaded &amp; analyzed</span>
          </div>
        )}
        {message.error && (
          <div className="mt-1.5">
            <p className="text-[10px] text-red-400 whitespace-pre-wrap">{message.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────

function SettingsTab() {
  const [settingsTab, setSettingsTab] = useState<'local' | 'online'>('local');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-tabs */}
      <div className="flex p-2 gap-1 border-b border-slate-800 shrink-0">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
            settingsTab === 'local' ? 'bg-slate-700 text-accent' : 'text-slate-500 hover:bg-slate-700/50'
          }`}
          onClick={() => setSettingsTab('local')}
        >
          <span className="material-icons-round" style={{ fontSize: '12px' }}>computer</span>
          Local
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
            settingsTab === 'online' ? 'bg-slate-700 text-accent' : 'text-slate-500 hover:bg-slate-700/50'
          }`}
          onClick={() => setSettingsTab('online')}
        >
          <span className="material-icons-round" style={{ fontSize: '12px' }}>cloud</span>
          Online
        </button>
      </div>

      {settingsTab === 'local' ? <SettingsLocalPanel /> : <SettingsOnlinePanel />}
    </div>
  );
}

function SettingsLocalPanel() {
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const setConnectionStatus = useChatStore((s) => s.setConnectionStatus);
  const [localTest, setLocalTest] = useState<{ testing: boolean; result?: ConnectionTestResult }>({ testing: false });

  const handleTestLocal = async () => {
    setLocalTest({ testing: true });
    const result = await testConnection(settings.localEndpoint);
    setLocalTest({ testing: false, result });
    setConnectionStatus(result.ok ? 'connected' : 'error');
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <SettingsInput
        label="Endpoint"
        value={settings.localEndpoint}
        onChange={(v) => updateSettings({ localEndpoint: v })}
        placeholder="http://localhost:1234/v1/chat/completions"
      />
      <SettingsInput
        label="Model name (optional)"
        value={settings.localModelName}
        onChange={(v) => updateSettings({ localModelName: v })}
        placeholder="Auto-detect"
      />
      <SettingsSlider
        label="Temperature"
        value={settings.localTemperature}
        onChange={(v) => updateSettings({ localTemperature: v })}
        min={0}
        max={1}
        step={0.1}
      />
      <TestConnectionButton testing={localTest.testing} result={localTest.result} onTest={handleTestLocal} guide="local" />
      <p className="text-[10px] text-slate-600 pt-1">
        Connects to LM Studio, Ollama, or any local OpenAI-compatible server. No API key needed.
      </p>
    </div>
  );
}

function SettingsOnlinePanel() {
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const [onlineTest, setOnlineTest] = useState<{ testing: boolean; result?: ConnectionTestResult }>({ testing: false });

  const handleTestOnline = async () => {
    if (!settings.onlineApiKey) {
      setOnlineTest({ testing: false, result: { ok: false, error: 'No API key set. Enter your API key above to connect.' } });
      return;
    }
    setOnlineTest({ testing: true });
    const result = await testConnection(settings.onlineEndpoint, settings.onlineApiKey);
    setOnlineTest({ testing: false, result });
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div>
        <label className="text-[10px] text-slate-400 block mb-1">Provider preset</label>
        <div className="flex gap-1">
          {[
            { label: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
            { label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'anthropic/claude-sonnet-4' },
            { label: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => updateSettings({ onlineEndpoint: preset.endpoint, onlineModel: preset.model })}
              className={`flex-1 px-2 py-1 text-[10px] font-medium rounded border transition-colors cursor-pointer ${
                settings.onlineEndpoint === preset.endpoint
                  ? 'bg-accent/20 text-accent border-accent/40'
                  : 'text-slate-400 border-slate-700 hover:bg-slate-700/50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <SettingsInput
        label="Endpoint"
        value={settings.onlineEndpoint}
        onChange={(v) => updateSettings({ onlineEndpoint: v })}
        placeholder="https://api.groq.com/openai/v1/chat/completions"
      />
      <SettingsInput
        label="API Key"
        value={settings.onlineApiKey}
        onChange={(v) => updateSettings({ onlineApiKey: v })}
        placeholder={settings.onlineEndpoint.includes('groq') ? 'gsk_...' : settings.onlineEndpoint.includes('openrouter') ? 'sk-or-...' : 'sk-...'}
        type="password"
      />
      <SettingsInput
        label="Model"
        value={settings.onlineModel}
        onChange={(v) => updateSettings({ onlineModel: v })}
        placeholder="llama-3.3-70b-versatile"
      />
      <SettingsSlider
        label="Temperature"
        value={settings.onlineTemperature}
        onChange={(v) => updateSettings({ onlineTemperature: v })}
        min={0}
        max={1}
        step={0.1}
      />
      <TestConnectionButton testing={onlineTest.testing} result={onlineTest.result} onTest={handleTestOnline} endpoint={settings.onlineEndpoint} />
      <p className="text-[10px] text-slate-600 pt-1">
        Works with OpenRouter, Together, Groq, OpenAI, or any OpenAI-compatible API. Your key is stored locally.
      </p>
    </div>
  );
}

function TestConnectionButton({ testing, result, onTest, endpoint, guide }: {
  testing: boolean; result?: ConnectionTestResult; onTest: () => void; endpoint?: string; guide?: 'local';
}) {
  const [showGuide, setShowGuide] = useState(false);
  const guideContent = guide === 'local' ? getLocalGuideContent() : endpoint ? getProviderGuideContent(endpoint) : null;

  return (
    <div className="pt-1 space-y-2">
      <div className="flex gap-1.5">
        <button
          onClick={onTest}
          disabled={testing}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded border border-slate-700 text-slate-300 hover:bg-slate-700/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={`material-icons-round ${testing ? 'animate-spin' : ''}`} style={{ fontSize: '13px' }}>
            {testing ? 'sync' : 'wifi_tethering'}
          </span>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {guideContent && (
          <button
            onClick={() => setShowGuide((v) => !v)}
            className={`px-2 py-1.5 rounded border transition-colors cursor-pointer ${
              showGuide ? 'bg-accent/20 text-accent border-accent/40' : 'text-slate-400 border-slate-700 hover:bg-slate-700/50 hover:text-slate-300'
            }`}
          >
            <span className="material-icons-round" style={{ fontSize: '15px' }}>help_outline</span>
          </button>
        )}
      </div>

      {showGuide && guideContent && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2 text-[10px] text-slate-400 leading-relaxed">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px]">
              <span className="material-icons-round" style={{ fontSize: '13px', color: guideContent.color }}>{guideContent.icon}</span>
              {guideContent.title}
            </div>
            <button onClick={() => setShowGuide(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
              <span className="material-icons-round" style={{ fontSize: '14px' }}>close</span>
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            {guideContent.steps.map((step, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
            ))}
          </ol>
          <p className="text-slate-500">{guideContent.note}</p>
        </div>
      )}

      {result && (
        result.ok ? (
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="material-icons-round" style={{ fontSize: '13px' }}>check_circle</span>
              <span className="text-[11px] font-medium">Connected</span>
            </div>
            {result.warning && (
              <div className="flex items-center gap-1.5 text-amber-400 mt-1">
                <span className="material-icons-round" style={{ fontSize: '12px' }}>warning</span>
                <span className="text-[10px]">{result.warning}</span>
              </div>
            )}
            {result.models && result.models.length > 0 && (
              <div className="text-[10px] text-slate-400">
                <span className="text-slate-500">Available models:</span>
                <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                  {result.models.slice(0, 10).map((m) => (
                    <div key={m} className="text-slate-300 font-mono truncate">{m}</div>
                  ))}
                  {result.models.length > 10 && (
                    <div className="text-slate-500">+{result.models.length - 10} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="material-icons-round" style={{ fontSize: '13px' }}>error</span>
              <span className="text-[11px] font-medium">Connection failed</span>
            </div>
            <p className="text-[10px] text-red-300/80 leading-relaxed">{result.error}</p>
          </div>
        )
      )}
    </div>
  );
}

function SettingsInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-slate-400 block mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 rounded text-xs px-2.5 py-1.5 text-slate-200 placeholder:text-slate-600 focus:ring-accent focus:border-accent"
      />
    </div>
  );
}

function SettingsSlider({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number;
}) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <label className="text-[10px] text-slate-400">{label}</label>
        <span className="text-[10px] text-slate-500">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

// ─── Setup Guides ────────────────────────────────────────────

function GuideStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 w-4 h-4 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center mt-0.5">{n}</span>
      <div className="text-[11px] text-slate-400 leading-relaxed">{children}</div>
    </div>
  );
}

type GuideContent = { icon: string; color: string; title: string; steps: string[]; note: string };

function getLocalGuideContent(): GuideContent {
  return {
    icon: 'computer', color: '#60a5fa', title: 'LM Studio Setup — Free, fully local',
    steps: [
      'Download & install <a href="https://lmstudio.ai" target="_blank" rel="noopener" style="color:var(--color-accent)">LM Studio</a>',
      'Search and download a model: <strong style="color:#cbd5e1">Qwen 2.5 Coder 7B Instruct</strong> (recommended)',
      'Go to the <strong style="color:#cbd5e1">Local Server</strong> tab (icon on the left)',
      'Enable <strong style="color:#cbd5e1">CORS</strong> in server settings (required for browser access)',
      'Click <strong style="color:#cbd5e1">Start Server</strong> — it runs on port 1234 by default',
      'Come back here and click <strong style="color:#cbd5e1">Test Connection</strong>',
    ],
    note: 'No API key needed. Runs 100% on your machine, no data leaves your computer.',
  };
}

function getProviderGuideContent(endpoint: string): GuideContent | null {
  if (endpoint.includes('groq')) {
    return {
      icon: 'bolt', color: '#34d399', title: 'Groq Setup — Free, no credit card',
      steps: [
        'Go to <a href="https://console.groq.com" target="_blank" rel="noopener" style="color:var(--color-accent)">console.groq.com</a> and sign up',
        'Click <strong style="color:#cbd5e1">API Keys</strong> in the left menu',
        'Click <strong style="color:#cbd5e1">Create API Key</strong>, copy it',
        'Paste it in the <strong style="color:#cbd5e1">API Key</strong> field above',
      ],
      note: 'Free tier: 30 requests/min, 70B model included',
    };
  }
  if (endpoint.includes('openrouter')) {
    return {
      icon: 'hub', color: '#60a5fa', title: 'OpenRouter Setup',
      steps: [
        'Go to <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" style="color:var(--color-accent)">openrouter.ai/keys</a> and sign up',
        'Click <strong style="color:#cbd5e1">Create Key</strong>, copy it',
        'Paste it in the <strong style="color:#cbd5e1">API Key</strong> field above',
        'Add credits ($5 min) for paid models like Claude',
      ],
      note: 'Some free models available with rate limits',
    };
  }
  if (endpoint.includes('openai.com')) {
    return {
      icon: 'auto_awesome', color: '#4ade80', title: 'OpenAI Setup',
      steps: [
        'Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style="color:var(--color-accent)">platform.openai.com/api-keys</a>',
        'Click <strong style="color:#cbd5e1">Create new secret key</strong>, copy it',
        'Paste it in the <strong style="color:#cbd5e1">API Key</strong> field above',
      ],
      note: 'Requires billing setup, pay-per-use',
    };
  }
  return null;
}

function SetupGuideOnline() {
  const setActiveTab = useChatStore((s) => s.setActiveTab);

  return (
    <div className="py-4 px-1 space-y-4">
      <div className="text-center">
        <span className="material-icons-round text-slate-600 block mb-1" style={{ fontSize: '32px' }}>cloud</span>
        <h3 className="text-xs font-bold text-slate-300">Online API Setup</h3>
        <p className="text-[10px] text-slate-500 mt-0.5">Cloud LLMs via OpenAI-compatible APIs</p>
      </div>

      <div className="space-y-3 px-1">
        <GuideStep n={1}>
          Get an API key from a provider:
          <div className="mt-1.5 space-y-1">
            {[
              { name: 'Groq', url: 'https://console.groq.com', note: 'Free, no credit card, fast', recommended: true },
              { name: 'OpenRouter', url: 'https://openrouter.ai', note: 'Multi-model, some free' },
              { name: 'Together', url: 'https://together.ai', note: 'Fast open-source models' },
              { name: 'OpenAI', url: 'https://platform.openai.com', note: 'GPT-4o' },
            ].map((p) => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener"
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  (p as { recommended?: boolean }).recommended ? 'text-accent font-medium' : 'text-slate-300 hover:text-accent'
                }`}>
                <span className="material-icons-round" style={{ fontSize: '10px' }}>
                  {(p as { recommended?: boolean }).recommended ? 'star' : 'open_in_new'}
                </span>
                <span className="font-medium">{p.name}</span>
                <span className="text-slate-600">— {p.note}</span>
              </a>
            ))}
          </div>
        </GuideStep>
        <GuideStep n={2}>
          Go to{' '}
          <button onClick={() => setActiveTab('settings')} className="text-accent hover:underline cursor-pointer">Settings</button>
          {' '}and paste your API key
        </GuideStep>
        <GuideStep n={3}>
          Come back here and describe a structure
        </GuideStep>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-2.5 mx-1 space-y-1.5">
        <p className="text-[10px] text-slate-500">
          <span className="material-icons-round align-middle mr-0.5" style={{ fontSize: '11px' }}>recommend</span>
          <span className="text-slate-400 font-medium">Quickest start:</span> <span className="text-slate-300">Groq</span> — free, no credit card, use model <span className="text-slate-300 font-mono">llama-3.3-70b-versatile</span>
        </p>
        <p className="text-[10px] text-slate-500">
          <span className="material-icons-round align-middle mr-0.5" style={{ fontSize: '11px' }}>star</span>
          <span className="text-slate-400 font-medium">Best quality:</span> OpenRouter with <span className="text-slate-300">anthropic/claude-sonnet-4</span>
        </p>
        <p className="text-[10px] text-slate-500">
          <span className="material-icons-round align-middle mr-0.5" style={{ fontSize: '11px' }}>lock</span>
          Your API key is stored locally in your browser, never sent to our servers
        </p>
      </div>
    </div>
  );
}



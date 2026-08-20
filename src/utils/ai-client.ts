export interface ChatCompletionOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  endpoint: string;
  modelName?: string;
  temperature?: number;
  apiKey?: string;
  signal?: AbortSignal;
}

/** Non-streaming: returns the full response string. */
export async function chatCompletion(opts: ChatCompletionOptions): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) {
    headers['Authorization'] = `Bearer ${opts.apiKey}`;
  }

  const response = await fetch(opts.endpoint, {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.modelName || 'local-model',
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM server error: ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/** Streaming: calls onToken for each chunk, returns full response when done. */
export async function chatCompletionStream(
  opts: ChatCompletionOptions,
  onToken: (partial: string) => void,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) {
    headers['Authorization'] = `Bearer ${opts.apiKey}`;
  }

  const response = await fetch(opts.endpoint, {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.modelName || 'local-model',
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM server error: ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onToken(full);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return full;
}

export async function pingServer(endpoint: string): Promise<boolean> {
  const result = await testConnection(endpoint);
  return result.ok;
}

export interface ConnectionTestResult {
  ok: boolean;
  models?: string[];
  error?: string;
  warning?: string;
}

export async function testConnection(endpoint: string, apiKey?: string): Promise<ConnectionTestResult> {
  try {
    const modelsUrl = endpoint.replace('/chat/completions', '/models');
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: `Authentication failed (401). Check your API key.` };
      if (res.status === 403) return { ok: false, error: `Access denied (403). Your API key may lack permissions.` };
      if (res.status === 404) return { ok: false, error: `Endpoint not found (404). Check the URL — it should end with /v1/chat/completions` };
      return { ok: false, error: `Server returned ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 150)}` : ''}` };
    }

    try {
      const data = await res.json();
      const models = (data.data as Array<{ id: string }> | undefined)?.map((m) => m.id) ?? [];

      // OpenRouter's /models endpoint is public — a 200 doesn't prove the key is valid.
      // Verify the key with their auth endpoint.
      if (apiKey && endpoint.includes('openrouter.ai')) {
        try {
          const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          if (!authRes.ok) {
            return { ok: false, error: 'API key is invalid. Check your OpenRouter key.' };
          }
        } catch {
          // Auth endpoint unreachable — fall through with a warning
          return { ok: true, models, warning: 'Connected, but could not verify API key.' };
        }
      }

      return { ok: true, models };
    } catch {
      return { ok: true, models: [] };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timeout') || msg.includes('Timeout'))
      return { ok: false, error: 'Connection timed out. Is the server running?' };
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
      return { ok: false, error: 'Could not connect. Check the URL and make sure the server is running. If using LM Studio, enable CORS in the Local Server settings.' };
    if (msg.includes('CORS') || msg.includes('cors'))
      return { ok: false, error: 'CORS error. Enable CORS in LM Studio: Local Server tab → enable the CORS toggle, then restart the server.' };
    return { ok: false, error: msg };
  }
}

# AI Assistant — Struxure

## Overview

The AI Assistant generates 3D structural models from natural language descriptions. Describe a structure in plain text and the AI returns a valid StructuralModel JSON that is loaded directly into the 3D viewport.

Supports two modes:

- **Local** — LM Studio (free, private, runs on your machine)
- **Online** — Groq, OpenRouter, OpenAI, or any OpenAI-compatible API

---

## Architecture

```
User Input → System Prompt + Schema → LLM API → JSON Response → Validator/Coercion → loadModel()
```

### Files

| File | Purpose |
|------|---------|
| `src/components/chat/AiSidebar.tsx` | UI: sidebar, chat tabs, settings, setup guides |
| `src/store/chat-store.ts` | Zustand store: messages, settings, connection status |
| `src/utils/ai-system-prompt.ts` | System prompt with schema, units, examples, rules |
| `src/utils/ai-client.ts` | `chatCompletionStream()`, `testConnection()`, SSE parser |
| `src/utils/ai-model-validator.ts` | `extractAndValidateModel()`, `coerceModel()` |

### Flow

1. User types a description (e.g., "portal frame, 2 stories, 3 bays")
2. System prompt + user message are sent to the LLM endpoint via `chatCompletionStream()`
3. Response streams in real-time (SSE) to the chat bubble
4. `extractAndValidateModel()` extracts JSON from code fences, parses it
5. `coerceModel()` auto-fixes common LLM mistakes (see below)
6. Cross-reference validation checks all IDs
7. If valid, model is loaded into the viewport via `loadModel()`

### Conversational Context

Follow-up messages include the current model state as JSON in the user message, so the LLM can modify the existing structure (e.g., "add wind loads", "change columns to W14x48").

---

## Setup: Local (LM Studio)

1. Download & install [LM Studio](https://lmstudio.ai)
2. Download a model: **Qwen 2.5 Coder 7B Instruct** (recommended for structured JSON)
3. Go to the **Local Server** tab
4. **Enable CORS** in server settings (required for browser access)
5. Click **Start Server** (default: `localhost:1234`)
6. In Struxure: Settings → Local → Test Connection

### Recommended Models

| Model | Size | Notes |
|-------|------|-------|
| Qwen 2.5 Coder 7B Instruct | 4-5 GB | Best JSON output at 7B size |
| Llama 3 8B Instruct | 5 GB | Good general purpose |
| DeepSeek Coder V2 Lite | 3 GB | Lightweight alternative |

For Apple Silicon: use MLX 4-bit quantizations for best performance.

### CORS

LM Studio must have CORS enabled for browser access. Without it, the browser blocks requests to `localhost:1234`. Enable it in LM Studio: Local Server → CORS toggle → restart server.

---

## Setup: Online

### Groq (Free, no credit card)

1. Go to [console.groq.com](https://console.groq.com), sign up
2. Click **API Keys** → **Create API Key**, copy it
3. In Struxure: Settings → Online → click **Groq** preset → paste API key
4. Model: `llama-3.3-70b-versatile` (auto-filled)

Free tier: 30 requests/min, 70B model included.

### OpenRouter (Multi-model)

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys), sign up
2. Create Key, copy it
3. In Struxure: Settings → Online → click **OpenRouter** preset → paste API key
4. Model: `anthropic/claude-sonnet-4` (best JSON quality, paid)

Add credits ($5 min) for paid models. Some free models available with rate limits.

### OpenAI

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create new secret key, copy it
3. In Struxure: Settings → Online → click **OpenAI** preset → paste API key
4. Model: `gpt-4o` (auto-filled)

Requires billing setup, pay-per-use.

### Any OpenAI-Compatible API

Any API that implements the OpenAI `/v1/chat/completions` endpoint works. Set custom endpoint and model in Settings → Online.

---

## UI Structure

### Sidebar Tabs

- **Local** — Chat with local LLM (LM Studio)
- **Online** — Chat with cloud LLM
- **Settings** — Configuration with Local/Online sub-tabs

### Settings Sub-tabs

**Local:**
- Endpoint (default: `http://localhost:1234/v1/chat/completions`)
- Model name (optional, auto-detected)
- Temperature (default: 0.3)
- Test Connection + Help (`?`) button

**Online:**
- Provider presets (Groq / OpenRouter / OpenAI) — one-click auto-fill
- Endpoint, API Key, Model, Temperature
- Test Connection + Help (`?`) button

### Chat Features

- Example prompt chips when chat is empty
- Streaming responses (SSE) with real-time token display
- Stop button during generation
- Connection status indicator (green/red dot)
- Clear chat button
- Validation errors shown inline in red

---

## System Prompt

Located in `src/utils/ai-system-prompt.ts`. Defines:

- **Units**: Imperial (kip-in-ksi)
- **Schema**: Full `StructuralModel` TypeScript interface
- **Coordinate system**: X (horizontal), Y (vertical up), Z (depth)
- **Default material**: A992 Steel
- **Common sections**: W12x26, W14x22, W10x49, HSS6x6x3/8
- **Support types**: Fixed, Pin, Roller
- **Conversions**: ft→in, klf→kip/in
- **Example**: Simply supported beam (30 ft span, 20 kip center load)
- **13 rules** for valid output

---

## Validator & Coercion

Located in `src/utils/ai-model-validator.ts`.

### JSON Extraction

Extracts JSON from LLM responses using regex:
1. ` ```json ... ``` ` code fences (preferred)
2. ` ``` ... ``` ` generic code fences
3. `{ ... }` raw JSON

### Coercion (`coerceModel`)

Auto-fixes common LLM type mistakes before validation:

| Problem | Fix |
|---------|-----|
| Numeric node IDs (`1`, `2`) | Prefix with `N` → `"N1"`, `"N2"` |
| Numeric element IDs | Prefix with `E` → `"E1"` |
| Numeric material IDs | Prefix with `M` → `"M1"` |
| Numeric section IDs | Prefix with `S` → `"S1"` |
| `0/1` for support booleans | Convert to `false/true` |
| String booleans `"true"/"1"` | Convert to `true` |
| All supports `false` | Default to fixed (all `true`) |
| Missing `betaAngle` | Default to `0` |
| Missing force/moment fields | Default to `0` |
| Missing load IDs | Auto-generate `"L1"`, `"L2"`, etc. |
| Missing distributed load IDs | Auto-generate `"DL1"`, `"DL2"`, etc. |

### Cross-Reference Validation

After coercion, validates:
- All `nodeI`/`nodeJ` in elements reference existing nodes
- All `materialId`/`sectionId` in elements reference existing materials/sections
- All `nodeId` in supports reference existing nodes
- All `nodeId` in loads reference existing nodes
- All `elementId` in distributed loads reference existing elements
- At least one node, element, and support exist

---

## Chat Store

Located in `src/store/chat-store.ts`.

### State

- Separate message arrays per provider (`localMessages`, `onlineMessages`)
- Settings persisted to `localStorage` with key `struxure-ai-settings`
- Connection status: `unknown | connected | error`

### Default Settings

```typescript
{
  localEndpoint: 'http://localhost:1234/v1/chat/completions',
  localModelName: '',           // auto-detect
  localTemperature: 0.3,
  onlineEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  onlineApiKey: '',
  onlineModel: 'anthropic/claude-sonnet-4',
  onlineTemperature: 0.3,
}
```

---

## API Client

Located in `src/utils/ai-client.ts`.

### `chatCompletionStream(opts, onToken)`

Sends POST to OpenAI-compatible endpoint with `stream: true`. Parses SSE `data:` chunks and calls `onToken(fullText)` for each delta. Returns full response when done.

### `testConnection(endpoint, apiKey?)`

Hits `/v1/models` endpoint. Returns `{ ok, models?, error? }` with specific diagnostics:
- 401: Authentication failed
- 403: Access denied
- 404: Wrong URL
- CORS: Enable CORS in LM Studio
- Timeout: Server not running
- Network: Connection refused

---

## Example Prompts

Built-in suggestions shown in empty chat state:

- "Simple beam, 30ft span, 20 kip center load"
- "Cantilever, 15ft, W12x26, 5 kip tip load"
- "Portal frame, 2 stories, 3 bays, 20ft spans, 12ft height"
- "3D building, 2x2 bays, 3 stories, fixed bases"

### Follow-up Examples

After a model is loaded, users can say:
- "Add wind loads of 5 kips at each floor"
- "Change columns to W14x48"
- "Add a distributed load of 1 klf on all beams"
- "Make it 3 stories instead of 2"

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Could not connect" (Local) | LM Studio not running | Start LM Studio server |
| "Could not connect" (Local) | CORS disabled | Enable CORS in LM Studio Local Server settings |
| "Connection failed" (Online) | Wrong API key | Check key in Settings |
| "Authentication failed (401)" | Invalid or expired key | Generate new API key |
| "Endpoint not found (404)" | Wrong URL | URL should end with `/v1/chat/completions` |
| Invalid JSON errors | Model produces bad output | Try a different/larger model |
| Missing nodes/elements | Model ignores schema | Temperature too high (lower to 0.2-0.3) |
| Numeric IDs instead of strings | Common LLM mistake | Auto-fixed by coercion layer |

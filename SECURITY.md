# Security Policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository:
**Security → Report a vulnerability**. If that is unavailable to you, email
**alvaro@tivelabs.com**.

Please do not open a public issue for a security problem.

Expect an acknowledgement within 7 days. Struxure is maintained by one person, so
please allow reasonable time for a fix before public disclosure.

## Supported versions

Only the latest release on `main` receives security fixes.

## Threat model

Struxure runs entirely in the browser. There is no backend, no account system and
no server-side storage. Models, analysis results and settings never leave the
user's device unless the user exports a file or configures an online AI provider.
Struxure registers a service worker for offline asset caching; it caches only
static application assets from its own origin, never model data, settings or
replies from AI providers, and persists until the browser unregisters it.

## Known risks

### AI Assistant API keys

The AI Assistant defaults to a local provider such as LM Studio, which needs no
key. When an online provider is configured, its API key is sent only to the
endpoint the user enters. Where the key is kept is a choice under
**AI Assistant → Settings → Online → Key storage**:

| Option | Storage | Lifetime |
| --- | --- | --- |
| This tab only (default) | `sessionStorage`, key `struxure-ai-key` | Until the tab closes |
| Remember on this device | `localStorage`, key `struxure-ai-key` | Until the user clears it |
| Don't store | Memory only | Until the page reloads |

Other AI settings (endpoints, model names, temperature and the chosen key
storage option) are not secret and stay in `localStorage` under
`struxure-ai-settings`. The key is never written there. Switching options
removes the key from the storage it leaves, and clearing the field removes it
from storage entirely (`src/store/chat-store.ts`). A key belongs to one
provider: moving the endpoint to a different host, by a preset or by hand,
clears it, so a key for one provider is never sent to another.

**Migration.** Earlier versions stored the key in plaintext inside
`struxure-ai-settings` in `localStorage`. On first load after upgrading, that
key is moved to the default (this tab only) and deleted from `localStorage`.
It keeps working for the current session; users who want it remembered must
opt in again. Struxure does not assume the old behavior was a choice.

**Remaining risk.** Any script running on the same origin can read the key
in every mode, including from memory. A malicious dependency or a cross-site
scripting flaw could exfiltrate it. The settings panel says so where the key
is entered. Scope the key as narrowly as the provider allows, avoid
"Remember on this device" on shared machines, and rotate the key if in doubt.

### Model files

`.json` model files are checked field by field before they load
(`src/utils/model-validator.ts`): wrong types, unknown references and
non-finite numbers are rejected. Files over 50 MB, and models with more than
20,000 nodes or elements, are refused before parsing goes further, so a
hostile file cannot freeze the tab (`src/utils/import-limits.ts`). There is no
code execution path, since the data is only ever read as geometry and numbers.

A model file can still carry text meant for the AI Assistant, such as a
section name that reads like an instruction. The current model is sent to the
provider marked as data, not instructions, but no prompt is immune: review an
AI-generated model before relying on it, especially one built from a file
someone else shared.

### Third-party model files

DXF and IFC files are parsed in the browser by `dxf-parser` and `web-ifc`
(a C++ WebAssembly module). Parsing an untrusted file exercises third-party code.
The size limits above apply to them too. Malformed files may still crash the
tab. Open files from sources you trust.

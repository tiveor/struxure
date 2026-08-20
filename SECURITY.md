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
static application assets, never model data or settings, and persists until the
browser unregisters it.

## Known risks

### AI Assistant API keys are stored in localStorage

When the AI Assistant is configured with an online provider, the API key is
persisted in browser `localStorage` under the key `struxure-ai-settings`
(`src/store/chat-store.ts`). It is sent only to the endpoint the user configures.

`localStorage` is readable by any script running on the same origin. If a
malicious dependency or a cross-site scripting flaw were introduced, the key
could be exfiltrated.

**Recommendation:** prefer a local provider such as LM Studio, which needs no
key. If you use an online provider, scope the key as narrowly as the provider
allows and rotate it if you use Struxure on a shared machine.

This is tracked publicly and contributions are welcome.

### Model files are loaded without schema validation

`.json` model files are parsed with `JSON.parse` and loaded into application
state without schema or shape validation. A malformed or hostile file may
crash the tab, or load a model whose values are silently wrong. There is no
code execution path — the data is only ever read as geometry and numbers —
but do not open model files from sources you do not trust.

### Third-party model files

DXF and IFC files are parsed in the browser by `dxf-parser` and `web-ifc`
(a C++ WebAssembly module). Parsing an untrusted file exercises third-party code.
Malformed files may crash the tab. Open files from sources you trust.

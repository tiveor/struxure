declare const __APP_VERSION__: string;

/**
 * Injected only when a build sets VITE_UMAMI_ID (see vite/umami-plugin.ts).
 * Analytics are off by default, so on most builds this binding does not exist
 * at all — and TypeScript cannot express that difference.
 *
 * Never call it directly. `umami?.track()` looks safe but throws
 * `ReferenceError: umami is not defined` when the binding is absent, because
 * optional chaining guards the value, not the declaration. Use `track()` from
 * `src/utils/analytics.ts`, which guards with `typeof`.
 */
declare const umami: {
  track(event: string, data?: Record<string, string | number>): void;
} | undefined;

/**
 * Fires an analytics event, if analytics are enabled on this deployment.
 *
 * `umami` is a global that exists only when a build sets `VITE_UMAMI_ID`
 * (see `vite/umami-plugin.ts`). Analytics are off by default, so on most
 * builds the global is never declared at all.
 *
 * Optional chaining is NOT enough to guard that: `umami?.track()` protects
 * against `umami` being `null` or `undefined` as a *value*, but throws
 * `ReferenceError: umami is not defined` when the binding does not exist.
 * `typeof` is the only check that is safe on an undeclared identifier.
 *
 * The call is also wrapped, so a blocked, proxied or half-loaded analytics
 * script can never break a user action.
 */
export function track(event: string, data?: Record<string, string | number>): void {
  if (typeof umami === 'undefined' || umami === null) return;
  try {
    umami.track(event, data);
  } catch {
    // Analytics are never worth interrupting the user for.
  }
}

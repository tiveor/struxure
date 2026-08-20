/**
 * Generates a short unique id, optionally prefixed.
 *
 * Deliberately truncated to 8 hex characters rather than a full UUID: these
 * ids are rendered to users in the Elements panel, in PDF report tables and
 * in IFC element names, where a 36-character UUID is unreadable. 32 bits of
 * entropy is far more than a single in-browser model needs.
 */
export function newId(prefix?: string): string {
  const short = crypto.randomUUID().slice(0, 8);
  return prefix ? `${prefix}-${short}` : short;
}

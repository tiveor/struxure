/**
 * Generates a short unique id, optionally prefixed.
 *
 * Deliberately truncated to 8 hex characters rather than a full UUID: these
 * ids are user-facing, not just an internal key — element, node and load ids
 * label rows in the panels and in every PDF report table, and the element id
 * becomes the IFC member `Name`. They also appear as the fallback when a
 * referenced material or section no longer exists. A 36-character UUID would
 * be unreadable in all of those places, and 32 bits of entropy is far more
 * than a single in-browser model needs.
 */
export function newId(prefix?: string): string {
  const short = crypto.randomUUID().slice(0, 8);
  return prefix ? `${prefix}-${short}` : short;
}

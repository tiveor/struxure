import { describe, it, expect, afterEach, vi } from 'vitest';
import { track } from '../analytics';

type UmamiGlobal = { umami?: { track: (e: string, d?: Record<string, string | number>) => void } };
const g = globalThis as unknown as UmamiGlobal;

afterEach(() => {
  delete g.umami;
});

describe('track', () => {
  it('does not throw when the umami global was never declared', () => {
    // This is the real-world default: analytics are opt-in, so on most builds
    // the script is never injected and the binding does not exist.
    expect(() => track('analyze')).not.toThrow();
  });

  it('forwards the event and its data when analytics are enabled', () => {
    const spy = vi.fn();
    g.umami = { track: spy };

    track('template_load', { template: 'Portal Frame' });

    expect(spy).toHaveBeenCalledWith('template_load', { template: 'Portal Frame' });
  });

  it('forwards an event with no data', () => {
    const spy = vi.fn();
    g.umami = { track: spy };

    track('analyze');

    expect(spy).toHaveBeenCalledWith('analyze', undefined);
  });

  it('does not throw when the analytics script itself throws', () => {
    g.umami = { track: () => { throw new Error('blocked by extension'); } };

    expect(() => track('export_pdf')).not.toThrow();
  });
});

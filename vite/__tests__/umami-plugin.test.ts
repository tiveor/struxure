import { describe, it, expect } from 'vitest';
import { umamiPlugin } from '../umami-plugin';

const HTML = '<!doctype html><html><head><title>x</title></head><body></body></html>';
const SRC = 'https://cloud.umami.is/script.js';

function render(id: string | undefined, src = SRC): string {
  const hook = umamiPlugin(id, src).transformIndexHtml;
  const fn = typeof hook === 'function' ? hook : hook!.handler;
  return fn.call(null as never, HTML, null as never) as string;
}

describe('umamiPlugin', () => {
  it('injects nothing when no website id is configured', () => {
    expect(render(undefined)).toBe(HTML);
  });

  it('injects nothing when the website id is an empty string', () => {
    expect(render('')).toBe(HTML);
  });

  it('injects the script when a website id is configured', () => {
    const out = render('a3cab2f7-0000-0000-0000-000000000000');
    expect(out).toContain('data-website-id="a3cab2f7-0000-0000-0000-000000000000"');
    expect(out).toContain(`src="${SRC}"`);
  });

  it('injects the script inside head', () => {
    const out = render('abc');
    const tagAt = out.indexOf('data-website-id');
    // Assert presence before ordering: indexOf returns -1 when absent, and
    // -1 < indexOf('</head>') would pass vacuously against a no-op plugin.
    expect(tagAt).toBeGreaterThan(-1);
    expect(tagAt).toBeLessThan(out.indexOf('</head>'));
  });

  it('honours a custom script source', () => {
    expect(render('abc', 'https://analytics.example.test/s.js'))
      .toContain('src="https://analytics.example.test/s.js"');
  });
});

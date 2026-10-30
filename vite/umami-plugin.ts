import type { Plugin } from 'vite';

/** Escapes a value for use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Injects the Umami analytics script only when a website id is configured.
 *
 * Struxure ships no analytics by default: forks, self-hosted instances and local
 * development send nothing unless the operator sets VITE_UMAMI_ID themselves.
 * The script runs with the app's origin, so its source must be https and the
 * configured values are escaped rather than pasted into the HTML.
 */
export function umamiPlugin(websiteId: string | undefined, scriptSrc: string): Plugin {
  return {
    name: 'struxure:umami',
    transformIndexHtml(html: string): string {
      if (!websiteId) return html;
      let protocol = '';
      try {
        protocol = new URL(scriptSrc).protocol;
      } catch {
        // Falls through to the error below.
      }
      if (protocol !== 'https:') {
        throw new Error(`VITE_UMAMI_SRC must be an https URL, got "${scriptSrc}"`);
      }
      const tag = `    <script defer src="${escapeAttr(scriptSrc)}" data-website-id="${escapeAttr(websiteId)}"></script>\n`;
      return html.replace('</head>', `${tag}  </head>`);
    },
  };
}

import type { Plugin } from 'vite';

/**
 * Injects the Umami analytics script only when a website id is configured.
 *
 * Struxure ships no analytics by default: forks, self-hosted instances and local
 * development send nothing unless the operator sets VITE_UMAMI_ID themselves.
 */
export function umamiPlugin(websiteId: string | undefined, scriptSrc: string): Plugin {
  return {
    name: 'struxure:umami',
    transformIndexHtml(html: string): string {
      if (!websiteId) return html;
      const tag = `    <script defer src="${scriptSrc}" data-website-id="${websiteId}"></script>\n`;
      return html.replace('</head>', `${tag}  </head>`);
    },
  };
}

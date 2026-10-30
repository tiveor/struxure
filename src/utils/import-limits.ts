/**
 * Upper bounds for files the user opens. Struxure recommends ~200 nodes, so
 * these sit two orders of magnitude above any real model: they only stop a
 * hostile or corrupt file from freezing or crashing the tab.
 */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_MODEL_NODES = 20_000;
export const MAX_MODEL_ELEMENTS = 20_000;

/** Error message when a file is too large to open, or null when it is fine. */
export function fileSizeError(file: Pick<File, 'name' | 'size'>): string | null {
  if (file.size <= MAX_IMPORT_BYTES) return null;
  const mb = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;
  return `${file.name} is ${mb(file.size)}; files over ${mb(MAX_IMPORT_BYTES)} are not opened.`;
}

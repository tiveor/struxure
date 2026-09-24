import { isRecord, validateModelShape } from './model-validator';
import type { ValidationResult } from './model-validator';

export type { ValidationResult };

/**
 * Coerce common LLM mistakes before validation:
 * - Numeric IDs → strings
 * - 0/1 → false/true for booleans
 * - Missing betaAngle → default 0
 * - Missing moment fields → default 0
 */
function coerceModel(parsed: Record<string, unknown>): void {
  // Every loop skips non-object items — validateModelShape reports them
  // afterwards, and dereferencing fields on `null` here would throw first.
  // Coerce node IDs to strings
  const nodes = parsed.nodes as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(nodes)) {
    for (const n of nodes) {
      if (!isRecord(n)) continue;
      if (typeof n.id === 'number') n.id = `N${n.id}`;
    }
  }

  // Coerce element fields
  const elements = parsed.elements as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(elements)) {
    for (const e of elements) {
      if (!isRecord(e)) continue;
      if (typeof e.id === 'number') e.id = `E${e.id}`;
      if (typeof e.nodeI === 'number') e.nodeI = `N${e.nodeI}`;
      if (typeof e.nodeJ === 'number') e.nodeJ = `N${e.nodeJ}`;
      if (typeof e.materialId === 'number') e.materialId = `M${e.materialId}`;
      if (typeof e.sectionId === 'number') e.sectionId = `S${e.sectionId}`;
      if (e.betaAngle === undefined || e.betaAngle === null) e.betaAngle = 0;
    }
  }

  // Coerce material IDs
  const materials = parsed.materials as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(materials)) {
    for (const m of materials) {
      if (!isRecord(m)) continue;
      if (typeof m.id === 'number') m.id = `M${m.id}`;
    }
  }

  // Coerce section IDs
  const sections = parsed.sections as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(sections)) {
    for (const s of sections) {
      if (!isRecord(s)) continue;
      if (typeof s.id === 'number') s.id = `S${s.id}`;
    }
  }

  // Coerce support booleans and nodeId
  const supports = parsed.supports as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(supports)) {
    for (const sup of supports) {
      if (!isRecord(sup)) continue;
      if (typeof sup.nodeId === 'number') sup.nodeId = `N${sup.nodeId}`;
      for (const key of ['dx', 'dy', 'dz', 'rx', 'ry', 'rz']) {
        const v = sup[key];
        if (typeof v === 'number') sup[key] = v !== 0;
        if (typeof v === 'string') sup[key] = v === 'true' || v === '1';
      }
      // If all supports are false, default to fixed (common LLM mistake)
      const allFalse = ['dx', 'dy', 'dz', 'rx', 'ry', 'rz'].every((k) => !sup[k]);
      if (allFalse) {
        sup.dx = true; sup.dy = true; sup.dz = true;
        sup.rx = true; sup.ry = true; sup.rz = true;
      }
    }
  }

  // Coerce nodal load IDs and add missing fields
  const nodalLoads = parsed.nodalLoads as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(nodalLoads)) {
    for (let i = 0; i < nodalLoads.length; i++) {
      const load = nodalLoads[i];
      if (!isRecord(load)) continue;
      if (typeof load.id === 'number') load.id = `L${load.id}`;
      if (!load.id) load.id = `L${i + 1}`;
      if (typeof load.nodeId === 'number') load.nodeId = `N${load.nodeId}`;
      for (const key of ['fx', 'fy', 'fz', 'mx', 'my', 'mz']) {
        if (load[key] === undefined || load[key] === null) load[key] = 0;
      }
    }
  }

  // Coerce distributed load IDs
  const distLoads = parsed.distributedLoads as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(distLoads)) {
    for (let i = 0; i < distLoads.length; i++) {
      const dl = distLoads[i];
      if (!isRecord(dl)) continue;
      if (typeof dl.id === 'number') dl.id = `DL${dl.id}`;
      if (!dl.id) dl.id = `DL${i + 1}`;
      if (typeof dl.elementId === 'number') dl.elementId = `E${dl.elementId}`;
      for (const key of ['wx', 'wy', 'wz']) {
        if (dl[key] === undefined || dl[key] === null) dl[key] = 0;
      }
    }
  }
}

export function extractAndValidateModel(llmResponse: string): ValidationResult {
  // 1. Extract JSON from code fences or raw
  const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)```/)
    || llmResponse.match(/```\s*([\s\S]*?)```/)
    || llmResponse.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    return { success: false, errors: ['No JSON found in response'] };
  }

  const rawJson = jsonMatch[1].trim();

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    return { success: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : e}`] };
  }

  if (!isRecord(parsed)) {
    return { success: false, errors: ['Response does not contain a model object'] };
  }

  // 3. Coerce common LLM type mistakes, then validate shape,
  //    cross-references and sanity against the shared model validator.
  coerceModel(parsed);
  return validateModelShape(parsed);
}

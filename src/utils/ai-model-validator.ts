import type { StructuralModel } from '../core/types';

export interface ValidationResult {
  success: boolean;
  model?: StructuralModel;
  errors: string[];
}

/**
 * Coerce common LLM mistakes before validation:
 * - Numeric IDs → strings
 * - 0/1 → false/true for booleans
 * - Missing betaAngle → default 0
 * - Missing moment fields → default 0
 */
function coerceModel(parsed: Record<string, unknown>): void {
  // Coerce node IDs to strings
  const nodes = parsed.nodes as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(nodes)) {
    for (const n of nodes) {
      if (typeof n.id === 'number') n.id = `N${n.id}`;
    }
  }

  // Coerce element fields
  const elements = parsed.elements as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(elements)) {
    for (const e of elements) {
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
      if (typeof m.id === 'number') m.id = `M${m.id}`;
    }
  }

  // Coerce section IDs
  const sections = parsed.sections as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(sections)) {
    for (const s of sections) {
      if (typeof s.id === 'number') s.id = `S${s.id}`;
    }
  }

  // Coerce support booleans and nodeId
  const supports = parsed.supports as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(supports)) {
    for (const sup of supports) {
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
  const errors: string[] = [];

  // 1. Extract JSON from code fences or raw
  const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)```/)
    || llmResponse.match(/```\s*([\s\S]*?)```/)
    || llmResponse.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    return { success: false, errors: ['No JSON found in response'] };
  }

  const rawJson = jsonMatch[1].trim();

  // 2. Parse JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    return { success: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : e}`] };
  }

  // 3. Ensure required arrays exist
  const requiredArrays = ['nodes', 'elements', 'materials', 'sections', 'supports', 'nodalLoads'];
  for (const key of requiredArrays) {
    if (!Array.isArray(parsed[key])) {
      errors.push(`Missing or invalid "${key}" array`);
    }
  }
  // distributedLoads is optional
  if (!Array.isArray(parsed.distributedLoads)) {
    parsed.distributedLoads = [];
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 3.5. Coerce common LLM type mistakes
  coerceModel(parsed);

  const model = parsed as unknown as StructuralModel;

  // 4. Cross-reference validation
  const nodeIds = new Set(model.nodes.map((n) => n.id));
  const materialIds = new Set(model.materials.map((m) => m.id));
  const sectionIds = new Set(model.sections.map((s) => s.id));
  const elementIds = new Set(model.elements.map((e) => e.id));

  for (const elem of model.elements) {
    if (!nodeIds.has(elem.nodeI)) errors.push(`Element ${elem.id}: nodeI "${elem.nodeI}" not found`);
    if (!nodeIds.has(elem.nodeJ)) errors.push(`Element ${elem.id}: nodeJ "${elem.nodeJ}" not found`);
    if (!materialIds.has(elem.materialId)) errors.push(`Element ${elem.id}: materialId "${elem.materialId}" not found`);
    if (!sectionIds.has(elem.sectionId)) errors.push(`Element ${elem.id}: sectionId "${elem.sectionId}" not found`);
  }

  for (const sup of model.supports) {
    if (!nodeIds.has(sup.nodeId)) errors.push(`Support: nodeId "${sup.nodeId}" not found`);
  }

  for (const load of model.nodalLoads) {
    if (!nodeIds.has(load.nodeId)) errors.push(`Load ${load.id}: nodeId "${load.nodeId}" not found`);
  }

  for (const dl of model.distributedLoads) {
    if (!elementIds.has(dl.elementId)) errors.push(`DistributedLoad ${dl.id}: elementId "${dl.elementId}" not found`);
  }

  // 5. Basic sanity checks
  if (model.nodes.length === 0) errors.push('Model has no nodes');
  if (model.elements.length === 0) errors.push('Model has no elements');
  if (model.supports.length === 0) errors.push('Model has no supports — structure will be unstable');

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, model, errors: [] };
}

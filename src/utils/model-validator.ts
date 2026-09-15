import type { StructuralModel } from '../core/types';

export interface ValidationResult {
  success: boolean;
  model?: StructuralModel;
  errors: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

const REQUIRED_ARRAYS = ['nodes', 'elements', 'materials', 'sections', 'supports', 'nodalLoads'] as const;

/** Field kinds used by the strict per-field checks below. */
const FIELD_KINDS = {
  string: { test: isNonEmptyString, expect: 'a non-empty string' },
  number: { test: isFiniteNumber, expect: 'a number' },
  boolean: { test: (v: unknown) => typeof v === 'boolean', expect: 'a boolean' },
  materialType: { test: (v: unknown) => v === 'steel' || v === 'concrete', expect: '"steel" or "concrete"' },
} as const;

type FieldKind = keyof typeof FIELD_KINDS;

/**
 * Required fields for each model array, matching the interfaces in
 * `src/core/types.ts`. `optionalNumbers` are validated only when present.
 */
const ARRAY_FIELDS: Record<
  string,
  { label: string; fields: [string, FieldKind][]; optionalNumbers?: string[] }
> = {
  nodes: {
    label: 'Node',
    fields: [['id', 'string'], ['x', 'number'], ['y', 'number'], ['z', 'number']],
  },
  elements: {
    label: 'Element',
    fields: [
      ['id', 'string'], ['nodeI', 'string'], ['nodeJ', 'string'],
      ['materialId', 'string'], ['sectionId', 'string'], ['betaAngle', 'number'],
    ],
  },
  materials: {
    label: 'Material',
    fields: [
      ['id', 'string'], ['name', 'string'], ['type', 'materialType'],
      ['E', 'number'], ['G', 'number'], ['density', 'number'],
    ],
    optionalNumbers: ['fy', 'fu', 'fc'],
  },
  sections: {
    label: 'Section',
    fields: [
      ['id', 'string'], ['name', 'string'],
      ['A', 'number'], ['Ix', 'number'], ['Iy', 'number'], ['J', 'number'],
    ],
    optionalNumbers: ['Sx', 'Sy', 'Zx', 'Zy', 'rx', 'ry', 'd', 'bf', 'tf', 'tw', 'b', 'h'],
  },
  supports: {
    label: 'Support',
    fields: [
      ['nodeId', 'string'],
      ['dx', 'boolean'], ['dy', 'boolean'], ['dz', 'boolean'],
      ['rx', 'boolean'], ['ry', 'boolean'], ['rz', 'boolean'],
    ],
  },
  nodalLoads: {
    label: 'Nodal load',
    fields: [
      ['id', 'string'], ['nodeId', 'string'],
      ['fx', 'number'], ['fy', 'number'], ['fz', 'number'],
      ['mx', 'number'], ['my', 'number'], ['mz', 'number'],
    ],
  },
  distributedLoads: {
    label: 'Distributed load',
    fields: [['id', 'string'], ['elementId', 'string'], ['wx', 'number'], ['wy', 'number'], ['wz', 'number']],
  },
};

/**
 * Check that the required model arrays exist. `distributedLoads` is optional
 * and defaults to an empty array so callers always see a complete model.
 */
function checkRequiredArrays(parsed: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(parsed[key])) {
      errors.push(`Missing or invalid "${key}" array`);
    }
  }
  if (!Array.isArray(parsed.distributedLoads)) {
    parsed.distributedLoads = [];
  }
  return errors;
}

/**
 * Strict per-field type checks for each model array. Catches hand-edited or
 * malformed files that have the right arrays but wrong value types — the case
 * that otherwise loads a model with silently wrong values.
 */
function checkFieldTypes(parsed: Record<string, unknown>): string[] {
  const errors: string[] = [];

  for (const [key, spec] of Object.entries(ARRAY_FIELDS)) {
    const items = parsed[key];
    if (!Array.isArray(items)) continue; // already reported by checkRequiredArrays

    items.forEach((item, i) => {
      if (!isRecord(item)) {
        errors.push(`${spec.label} ${i + 1}: expected an object`);
        return;
      }
      const ref = isNonEmptyString(item.id) ? item.id : item.nodeId;
      const tag = isNonEmptyString(ref) ? `"${ref}"` : `#${i + 1}`;
      for (const [field, kind] of spec.fields) {
        if (!FIELD_KINDS[kind].test(item[field])) {
          errors.push(`${spec.label} ${tag}: "${field}" must be ${FIELD_KINDS[kind].expect}`);
        }
      }
      for (const field of spec.optionalNumbers ?? []) {
        const value = item[field];
        if (value !== undefined && !isFiniteNumber(value)) {
          errors.push(`${spec.label} ${tag}: "${field}" must be a number`);
        }
      }
    });
  }

  return errors;
}

/**
 * Report array items that are not objects. `checkFieldTypes` covers this for
 * the strict file path, but the lenient AI path skips field checks — without
 * this guard `checkReferences` would dereference `.id` on `null` and throw
 * instead of returning errors.
 */
function checkItemsAreObjects(parsed: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [key, spec] of Object.entries(ARRAY_FIELDS)) {
    const items = parsed[key];
    if (!Array.isArray(items)) continue; // already reported by checkRequiredArrays
    items.forEach((item, i) => {
      if (!isRecord(item)) {
        errors.push(`${spec.label} ${i + 1}: expected an object`);
      }
    });
  }
  return errors;
}

/** Check that every referenced node/material/section/element ID exists. */
function checkReferences(model: StructuralModel): string[] {
  const errors: string[] = [];
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

  return errors;
}

/** Basic sanity checks — used for AI-generated models, where an empty model is never useful. */
function checkSanity(model: StructuralModel): string[] {
  const errors: string[] = [];
  if (model.nodes.length === 0) errors.push('Model has no nodes');
  if (model.elements.length === 0) errors.push('Model has no elements');
  if (model.supports.length === 0) errors.push('Model has no supports — structure will be unstable');
  return errors;
}

/**
 * Validate an already-parsed value as a structural model: required arrays,
 * cross-references and basic sanity — but no per-field type checks, so AI
 * output can be coerced into shape first (see `ai-model-validator.ts`).
 */
export function validateModelShape(parsed: unknown): ValidationResult {
  if (!isRecord(parsed)) {
    return { success: false, errors: ['Expected a model object'] };
  }

  const errors = [...checkRequiredArrays(parsed), ...checkItemsAreObjects(parsed)];
  if (errors.length > 0) {
    return { success: false, errors };
  }

  const model = parsed as unknown as StructuralModel;
  errors.push(...checkReferences(model), ...checkSanity(model));

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, model, errors: [] };
}

/**
 * Parse and strictly validate a saved `.json` model file. Unlike the AI path
 * this checks every field's type (no coercion — a saved file must match the
 * exported `StructuralModel` shape exactly) but not model completeness: an
 * empty or partially built model is valid data and must still load.
 */
export function validateModelJson(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { success: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : e}`] };
  }

  if (!isRecord(parsed)) {
    return { success: false, errors: ['File does not contain a model object'] };
  }

  const errors = [...checkRequiredArrays(parsed), ...checkFieldTypes(parsed)];
  if (errors.length > 0) {
    return { success: false, errors };
  }

  const model = parsed as unknown as StructuralModel;
  errors.push(...checkReferences(model));

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, model, errors: [] };
}

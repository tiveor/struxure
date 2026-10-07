import type {
  ColumnReinforcement,
  DistributedLoad,
  FrameElement,
  Material,
  NodalLoad,
  Section,
  StructuralModel,
  StructuralNode,
} from '../core/types';
import {
  FT_TO_M,
  IN_TO_M,
  IN_TO_MM,
  KIP_TO_KN,
  KSI_TO_MPA,
  LB_TO_KG,
} from './units';
import type { QuantityType, UnitSystem } from './units';

// ─── Unit tags ──────────────────────────────────────────────────────
//
// A unit tag names one consistent set of units for every numeric field of a
// model file. Each tag uses a single length unit for everything: node
// coordinates, section dimensions, rebar cover and the length part of every
// derived quantity (area, inertia, moment, line load).
//
//   kip-in-ksi  in, kip, kip-in, kip/in, ksi; A in^2, I and J in^4,
//               S and Z in^3; density as weight density in kip/in^3.
//               This is the internal unit system of the app.
//   kN-m-MPa    m, kN, kN-m, kN/m, MPa; A in m^2, I and J in m^4,
//               S and Z in m^3; density as mass density in kg/m^3.
//   N-mm-MPa    mm, N, N-mm, N/mm, MPa; A in mm^2, I and J in mm^4,
//               S and Z in mm^3; density as mass density in kg/m^3.
//
// Angles (betaAngle, degrees), bar designations and bar counts are unitless
// and never change.

export const MODEL_UNIT_TAGS = ['kip-in-ksi', 'kN-m-MPa', 'N-mm-MPa'] as const;

export type ModelUnitTag = (typeof MODEL_UNIT_TAGS)[number];

/** The units the model is stored and analysed in. */
export const INTERNAL_UNIT_TAG: ModelUnitTag = 'kip-in-ksi';

export function isModelUnitTag(value: unknown): value is ModelUnitTag {
  return typeof value === 'string' && (MODEL_UNIT_TAGS as readonly string[]).includes(value);
}

/** The tag a user working in a display unit system reads and writes. */
export function unitTagForSystem(system: UnitSystem): ModelUnitTag {
  return system === 'metric' ? 'kN-m-MPa' : 'kip-in-ksi';
}

// ─── Factors ────────────────────────────────────────────────────────
// Multiply an internal (kip-in-ksi) value by the factor to get the value in
// the tagged units.

const KIP_TO_N = KIP_TO_KN * 1000;
/** kip/in^3 (weight) to kg/m^3 (mass) under standard gravity. */
const DENSITY_TO_KG_M3 = (1000 * LB_TO_KG) / IN_TO_M ** 3;
/** lb/ft to kg/m. Not used by model fields today; kept for completeness. */
const WEIGHT_PER_LENGTH_TO_KG_M = LB_TO_KG / FT_TO_M;

const TAG_FACTORS: Record<ModelUnitTag, Record<QuantityType, number>> = {
  'kip-in-ksi': {
    length: 1,
    sectionDimension: 1,
    displacement: 1,
    force: 1,
    moment: 1,
    forcePerLength: 1,
    stress: 1,
    area: 1,
    momentOfInertia: 1,
    sectionModulus: 1,
    density: 1,
    weightPerLength: 1,
  },
  'kN-m-MPa': {
    length: IN_TO_M,
    sectionDimension: IN_TO_M,
    displacement: IN_TO_M,
    force: KIP_TO_KN,
    moment: KIP_TO_KN * IN_TO_M,
    forcePerLength: KIP_TO_KN / IN_TO_M,
    stress: KSI_TO_MPA,
    area: IN_TO_M ** 2,
    momentOfInertia: IN_TO_M ** 4,
    sectionModulus: IN_TO_M ** 3,
    density: DENSITY_TO_KG_M3,
    weightPerLength: WEIGHT_PER_LENGTH_TO_KG_M,
  },
  'N-mm-MPa': {
    length: IN_TO_MM,
    sectionDimension: IN_TO_MM,
    displacement: IN_TO_MM,
    force: KIP_TO_N,
    moment: KIP_TO_N * IN_TO_MM,
    forcePerLength: KIP_TO_N / IN_TO_MM,
    stress: KSI_TO_MPA,
    area: IN_TO_MM ** 2,
    momentOfInertia: IN_TO_MM ** 4,
    sectionModulus: IN_TO_MM ** 3,
    density: DENSITY_TO_KG_M3,
    weightPerLength: WEIGHT_PER_LENGTH_TO_KG_M,
  },
};

/** Convert one value of the given quantity between two unit tags. */
export function convertValue(value: number, qty: QuantityType, from: ModelUnitTag, to: ModelUnitTag): number {
  if (from === to) return value;
  return (value / TAG_FACTORS[from][qty]) * TAG_FACTORS[to][qty];
}

// ─── Field table ────────────────────────────────────────────────────

/** What a numeric model field measures. 'unitless' fields never change. */
export type FieldUnit = QuantityType | 'unitless';

/** Keys of T whose value is a number (optional or not). */
type NumericKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends number ? K : never;
}[keyof T];

/**
 * Every numeric field of T must be listed. Extra keys are allowed so fields
 * added by other changes (a section `shape`, say) can be declared ahead of
 * the type.
 */
type FieldTable<T> = Record<NumericKeys<T>, FieldUnit> & Record<string, FieldUnit>;

const NODE_FIELDS: FieldTable<StructuralNode> = {
  x: 'length',
  y: 'length',
  z: 'length',
};

const ELEMENT_FIELDS: FieldTable<FrameElement> = {
  // Degrees in every system.
  betaAngle: 'unitless',
};

const MATERIAL_FIELDS: FieldTable<Material> = {
  E: 'stress',
  G: 'stress',
  density: 'density',
  fy: 'stress',
  fu: 'stress',
  fc: 'stress',
};

const SECTION_FIELDS: FieldTable<Section> = {
  A: 'area',
  Ix: 'momentOfInertia',
  Iy: 'momentOfInertia',
  J: 'momentOfInertia',
  Sx: 'sectionModulus',
  Sy: 'sectionModulus',
  Zx: 'sectionModulus',
  Zy: 'sectionModulus',
  rx: 'sectionDimension',
  ry: 'sectionDimension',
  d: 'sectionDimension',
  bf: 'sectionDimension',
  tf: 'sectionDimension',
  tw: 'sectionDimension',
  b: 'sectionDimension',
  h: 'sectionDimension',
  // Shape family marker, not a measurement.
  shape: 'unitless',
};

const REINFORCEMENT_FIELDS: FieldTable<ColumnReinforcement> = {
  cover: 'sectionDimension',
  // Bar designations (#3 to #11) and counts.
  barSize: 'unitless',
  barsAlongB: 'unitless',
  barsAlongH: 'unitless',
  tieSize: 'unitless',
  fy: 'stress',
};

const NODAL_LOAD_FIELDS: FieldTable<NodalLoad> = {
  fx: 'force',
  fy: 'force',
  fz: 'force',
  mx: 'moment',
  my: 'moment',
  mz: 'moment',
};

const DISTRIBUTED_LOAD_FIELDS: FieldTable<DistributedLoad> = {
  wx: 'forcePerLength',
  wy: 'forcePerLength',
  wz: 'forcePerLength',
};

/**
 * The single source of truth for the units of every numeric model field,
 * by model array. Nested objects are listed under `nested`.
 */
export const MODEL_FIELD_UNITS = {
  nodes: { fields: NODE_FIELDS, nested: {} },
  elements: { fields: ELEMENT_FIELDS, nested: {} },
  materials: { fields: MATERIAL_FIELDS, nested: {} },
  sections: { fields: SECTION_FIELDS, nested: { reinforcement: REINFORCEMENT_FIELDS } },
  supports: { fields: {}, nested: {} },
  nodalLoads: { fields: NODAL_LOAD_FIELDS, nested: {} },
  distributedLoads: { fields: DISTRIBUTED_LOAD_FIELDS, nested: {} },
} as const satisfies Record<
  keyof StructuralModel,
  { fields: Record<string, FieldUnit>; nested: Record<string, Record<string, FieldUnit>> }
>;

// ─── Conversion ─────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function convertFields(
  item: Record<string, unknown>,
  fields: Record<string, FieldUnit>,
  from: ModelUnitTag,
  to: ModelUnitTag,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...item };
  for (const [key, unit] of Object.entries(fields)) {
    const value = out[key];
    if (unit !== 'unitless' && typeof value === 'number') {
      out[key] = convertValue(value, unit, from, to);
    }
  }
  return out;
}

/**
 * Convert a parsed, not yet validated model object. Arrays that are missing
 * or malformed, items that are not objects and fields that are not numbers
 * pass through untouched, so validation can report them afterwards. Returns
 * a copy; the input is not modified.
 */
export function convertRawModel(
  raw: Record<string, unknown>,
  from: ModelUnitTag,
  to: ModelUnitTag,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const [key, spec] of Object.entries(MODEL_FIELD_UNITS)) {
    const items = raw[key];
    if (!Array.isArray(items)) continue;
    out[key] = items.map((item: unknown) => {
      if (!isRecord(item)) return item;
      const converted = convertFields(item, spec.fields, from, to);
      for (const [nestedKey, nestedFields] of Object.entries(spec.nested as Record<string, Record<string, FieldUnit>>)) {
        const nested = item[nestedKey];
        if (isRecord(nested)) converted[nestedKey] = convertFields(nested, nestedFields, from, to);
      }
      return converted;
    });
  }
  return out;
}

/** Convert every numeric field of a model from one unit tag to another. */
export function convertModel(model: StructuralModel, from: ModelUnitTag, to: ModelUnitTag): StructuralModel {
  return convertRawModel(model as unknown as Record<string, unknown>, from, to) as unknown as StructuralModel;
}

/** Convert one material, e.g. a library entry stored in its native units. */
export function convertMaterial<T extends Omit<Material, 'id'>>(material: T, from: ModelUnitTag, to: ModelUnitTag): T {
  return convertFields(material as unknown as Record<string, unknown>, MATERIAL_FIELDS, from, to) as unknown as T;
}

// ─── File format ────────────────────────────────────────────────────

/** Current version of the saved model file format. */
export const MODEL_SCHEMA_VERSION = 2;

/** Model file as written by `modelToJson`: the model plus its unit tag. */
export type TaggedModel = StructuralModel & {
  schemaVersion: typeof MODEL_SCHEMA_VERSION;
  units: ModelUnitTag;
};

/** Wrap a model with the current schema version and its unit tag. */
export function tagModel(model: StructuralModel, units: ModelUnitTag = INTERNAL_UNIT_TAG): TaggedModel {
  return { schemaVersion: MODEL_SCHEMA_VERSION, units, ...model };
}

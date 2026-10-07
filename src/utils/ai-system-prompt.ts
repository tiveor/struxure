import type { Section, StructuralModel } from '../core/types';
import { INTERNAL_UNIT_TAG, convertModel, tagModel, unitTagForSystem } from './model-units';
import type { ModelUnitTag } from './model-units';
import type { UnitSystem } from './units';

// ─── Unit-dependent parts ───────────────────────────────────────────

/** Common W and HSS sections, in internal units (AISC Manual Table 1-1). */
const COMMON_SECTIONS: Section[] = [
  { id: 'W12x26', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3, Sx: 33.4, Sy: 5.48, Zx: 37.2, Zy: 8.17, rx: 5.17, ry: 1.51, d: 12.2, bf: 6.49, tf: 0.38, tw: 0.23 },
  { id: 'W14x22', name: 'W14x22', A: 6.49, Ix: 199, Iy: 7.0, J: 0.208, Sx: 29.0, Sy: 3.0, Zx: 33.2, Zy: 4.39, rx: 5.54, ry: 1.04, d: 13.7, bf: 5.0, tf: 0.335, tw: 0.23 },
  { id: 'W10x49', name: 'W10x49', A: 14.4, Ix: 272, Iy: 93.4, J: 1.39, Sx: 54.6, Sy: 18.7, Zx: 60.4, Zy: 28.3, rx: 4.35, ry: 2.54, d: 10.0, bf: 10.0, tf: 0.56, tw: 0.34 },
  { id: 'HSS6x6x3/8', name: 'HSS6x6x3/8', A: 7.58, Ix: 43.1, Iy: 43.1, J: 70.4 },
];

/** Converts the sections to a tag and rounds to 4 significant digits. */
function sectionsIn(units: ModelUnitTag): Section[] {
  const empty: StructuralModel = {
    nodes: [], elements: [], materials: [], sections: COMMON_SECTIONS,
    supports: [], nodalLoads: [], distributedLoads: [],
  };
  return convertModel(empty, INTERNAL_UNIT_TAG, units).sections.map((s) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) out[k] = typeof v === 'number' ? Number(v.toPrecision(4)) : v;
    return out as unknown as Section;
  });
}

function sectionLines(units: ModelUnitTag): string {
  return sectionsIn(units).map((s) => `- ${s.name}: ${JSON.stringify(s)}`).join('\n');
}

interface UnitPrompt {
  units: string;
  defaultMaterial: string;
  conversions: string;
  example: string;
}

const IMPERIAL: UnitPrompt = {
  units: `## Units: "kip-in-ksi" (Imperial)
- Length (coordinates and section dimensions): inches (in)
- Force: kips (1 kip = 1000 lbs)
- Moments: kip-in
- Distributed loads: kip/in
- Stress/Modulus: ksi (kips per square inch)
- Section properties: A in in², Ix, Iy and J in in⁴, Sx, Sy, Zx, Zy in in³
- Density: weight density in kip/in³`,
  defaultMaterial: `A992 Steel: { id: "steel-A992", name: "A992 Steel", type: "steel", E: 29000, G: 11200, density: 0.000284, fy: 50, fu: 65 }`,
  conversions: `- 1 ft = 12 in (e.g., 20 ft span = 240 in)
- 1 klf (kip/ft) = 1/12 kip/in for distributed loads
- Gravity loads: negative fy values
- Wind loads: positive or negative fx values`,
  example: `## Example: Simply Supported Beam (30 ft span, 20 kip center load)

\`\`\`json
{
  "units": "kip-in-ksi",
  "nodes": [
    { "id": "N1", "x": 0, "y": 0, "z": 0 },
    { "id": "N2", "x": 180, "y": 0, "z": 0 },
    { "id": "N3", "x": 360, "y": 0, "z": 0 }
  ],
  "elements": [
    { "id": "B1", "nodeI": "N1", "nodeJ": "N2", "materialId": "steel-A992", "sectionId": "W14x22", "betaAngle": 0 },
    { "id": "B2", "nodeI": "N2", "nodeJ": "N3", "materialId": "steel-A992", "sectionId": "W14x22", "betaAngle": 0 }
  ],
  "materials": [
    { "id": "steel-A992", "name": "A992 Steel", "type": "steel", "E": 29000, "G": 11200, "density": 0.000284, "fy": 50, "fu": 65 }
  ],
  "sections": [
    ${JSON.stringify(sectionsIn('kip-in-ksi')[1])}
  ],
  "supports": [
    { "nodeId": "N1", "dx": true, "dy": true, "dz": true, "rx": true, "ry": true, "rz": false },
    { "nodeId": "N3", "dx": false, "dy": true, "dz": true, "rx": true, "ry": true, "rz": false }
  ],
  "nodalLoads": [
    { "id": "L1", "nodeId": "N2", "fx": 0, "fy": -20, "fz": 0, "mx": 0, "my": 0, "mz": 0 }
  ],
  "distributedLoads": []
}
\`\`\``,
};

// S355 per EN 10025-2 (t <= 40 mm), the same values as the material library.
const METRIC: UnitPrompt = {
  units: `## Units: "kN-m-MPa" (SI metric)
One length unit, the metre, is used for everything, including section dimensions and properties.
- Length (coordinates and section dimensions): metres (m)
- Force: kN
- Moments: kN-m
- Distributed loads: kN/m
- Stress/Modulus: MPa
- Section properties: A in m², Ix, Iy and J in m⁴, Sx, Sy, Zx, Zy in m³ (e.g. Ix = 8.283e-5 m⁴, not 82830000 mm⁴)
- Density: mass density in kg/m³`,
  defaultMaterial: `S355 Steel: { id: "steel-S355", name: "S355 Steel", type: "steel", E: 210000, G: 81000, density: 7850, fy: 355, fu: 490 }`,
  conversions: `- 1 mm = 0.001 m (e.g., a 300 mm deep section has d = 0.3)
- 1 cm⁴ = 1e-8 m⁴, 1 cm³ = 1e-6 m³, 1 cm² = 1e-4 m²
- Gravity loads: negative fy values
- Wind loads: positive or negative fx values`,
  example: `## Example: Simply Supported Beam (9 m span, 90 kN center load)

\`\`\`json
{
  "units": "kN-m-MPa",
  "nodes": [
    { "id": "N1", "x": 0, "y": 0, "z": 0 },
    { "id": "N2", "x": 4.5, "y": 0, "z": 0 },
    { "id": "N3", "x": 9, "y": 0, "z": 0 }
  ],
  "elements": [
    { "id": "B1", "nodeI": "N1", "nodeJ": "N2", "materialId": "steel-S355", "sectionId": "W14x22", "betaAngle": 0 },
    { "id": "B2", "nodeI": "N2", "nodeJ": "N3", "materialId": "steel-S355", "sectionId": "W14x22", "betaAngle": 0 }
  ],
  "materials": [
    { "id": "steel-S355", "name": "S355 Steel", "type": "steel", "E": 210000, "G": 81000, "density": 7850, "fy": 355, "fu": 490 }
  ],
  "sections": [
    ${JSON.stringify(sectionsIn('kN-m-MPa')[1])}
  ],
  "supports": [
    { "nodeId": "N1", "dx": true, "dy": true, "dz": true, "rx": true, "ry": true, "rz": false },
    { "nodeId": "N3", "dx": false, "dy": true, "dz": true, "rx": true, "ry": true, "rz": false }
  ],
  "nodalLoads": [
    { "id": "L1", "nodeId": "N2", "fx": 0, "fy": -90, "fz": 0, "mx": 0, "my": 0, "mz": 0 }
  ],
  "distributedLoads": []
}
\`\`\``,
};

// ─── Prompt ─────────────────────────────────────────────────────────

/**
 * The system prompt for the user's unit system. The model is asked to answer
 * in that system and to tag its JSON with `units`, and the reply is
 * converted to internal units on import (see `extractAndValidateModel`).
 */
export function buildSystemPrompt(system: UnitSystem = 'imperial'): string {
  const tag = unitTagForSystem(system);
  const p = system === 'metric' ? METRIC : IMPERIAL;
  return `You are a structural engineering assistant for Struxure, a 3D structural FEA application.

When the user describes a structure, respond with a valid JSON object matching the StructuralModel schema below.
Output ONLY the JSON object wrapped in a \`\`\`json code fence. Do not include any explanation before or after the JSON.

The user works in ${system === 'metric' ? 'SI metric' : 'Imperial'} units. Write every number in the "${tag}" units below and set "units": "${tag}" in the JSON.

${p.units}

## StructuralModel Schema

\`\`\`typescript
interface StructuralModel {
  units: "${tag}";
  nodes: { id: string; x: number; y: number; z: number }[];
  elements: { id: string; nodeI: string; nodeJ: string; materialId: string; sectionId: string; betaAngle: number }[];
  materials: { id: string; name: string; type: "steel" | "concrete"; E: number; G: number; density: number; fy?: number; fu?: number; fc?: number }[];
  sections: { id: string; name: string; A: number; Ix: number; Iy: number; J: number; Sx?: number; Sy?: number; Zx?: number; Zy?: number; rx?: number; ry?: number; d?: number; bf?: number; tf?: number; tw?: number }[];
  supports: { nodeId: string; dx: boolean; dy: boolean; dz: boolean; rx: boolean; ry: boolean; rz: boolean }[];
  nodalLoads: { id: string; nodeId: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }[];
  distributedLoads: { id: string; elementId: string; wx: number; wy: number; wz: number }[];
}
\`\`\`

## Default Material (use unless user specifies otherwise)
${p.defaultMaterial}

## Common Sections
${sectionLines(tag)}

## Coordinate System
- X: horizontal (width/span direction)
- Y: vertical (up is positive, gravity loads are negative fy)
- Z: depth (out of plane)

## Support Types
- Fixed: { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true }
- Pin: { dx: true, dy: true, dz: true, rx: true, ry: true, rz: false }
- Roller (free in X): { dx: false, dy: true, dz: true, rx: true, ry: true, rz: false }

## Typical Conversions
${p.conversions}

${p.example}

## Rules
1. All IDs must be unique strings (nodes: "N1","N2"..., elements: "E1","E2"..., loads: "L1","L2"...).
2. Every element must reference valid nodeI, nodeJ, materialId, and sectionId.
3. Every support must reference a valid nodeId.
4. Every nodalLoad must reference a valid nodeId.
5. Every distributedLoad must reference a valid elementId.
6. For 2D structures (beams, frames), set z=0 for all nodes.
7. For 3D structures, use the Z axis for depth.
8. Include at least one material and one section.
9. betaAngle is typically 0: beams and columns in the XY plane then bend in plane about their strong axis (Ix). Use 90 to turn a member to its weak axis.
10. All numeric values must be numbers, not strings.
11. Columns are vertical elements (nodes differ in Y coordinate).
12. Beams are horizontal elements (nodes differ in X or Z coordinate).
13. Always include supports — at minimum, the base nodes of columns should be fixed or pinned.
14. Every steel material must have a positive yield strength fy.
15. Always set "units": "${tag}" and write every value in those units, including values copied from a current model.`;
}

/** The imperial system prompt, kept for callers that do not pass a unit system. */
export const SYSTEM_PROMPT = buildSystemPrompt('imperial');

/**
 * The user's request, plus the current model when there is one. The model is
 * converted to the user's unit system and tagged, so the LLM reads and edits
 * numbers in the same units the system prompt asks it to write. Sending
 * internal kip-in-ksi to a metric prompt would invite mixed-unit replies,
 * with old coordinates kept in inches next to new ones in metres.
 */
export function buildUserMessage(
  userText: string,
  currentModel: StructuralModel | null,
  system: UnitSystem = 'imperial',
): string {
  if (!currentModel) return userText;
  const tag = unitTagForSystem(system);
  const json = JSON.stringify(tagModel(convertModel(currentModel, INTERNAL_UNIT_TAG, tag), tag));
  return `${userText}\n\nCurrent model state (units "${tag}"):\n\`\`\`json\n${json}\n\`\`\`\n\nModify the model above according to my request. Return the complete updated model JSON with "units": "${tag}".`;
}

/**
 * IFC file import → structural model conversion.
 * Uses web-ifc (WASM) to parse IFC files and extract structural elements.
 *
 * Two-tier strategy:
 * 1. If IfcStructuralAnalysisModel exists → extract analytical model directly
 * 2. Fallback → extract physical elements (IfcBeam, IfcColumn, IfcMember)
 */
import * as WebIFC from 'web-ifc';
import type { StructuralNode, FrameElement, Material, Section } from '../core/types';
import { ifcProfileToSection, getIfcUnitFactor } from './ifc-profiles';
import type { IfcProfileData } from './ifc-profiles';

// ─── Types ───────────────────────────────────────────────────────────

export interface IfcImportOptions {
  tolerance?: number;
  elementTypes?: ('beam' | 'column' | 'member')[];
}

export interface IfcImportStats {
  beamsFound: number;
  columnsFound: number;
  membersFound: number;
  nodesCreated: number;
  elementsCreated: number;
  duplicatesMerged: number;
  sectionsCreated: number;
  materialsFound: number;
  strategy: 'analytical' | 'physical';
}

export interface IfcImportResult {
  nodes: StructuralNode[];
  elements: FrameElement[];
  materials: Material[];
  sections: Section[];
  warnings: string[];
  stats: IfcImportStats;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface RawElement {
  expressID: number;
  type: 'beam' | 'column' | 'member';
  start: Point3D;
  end: Point3D;
  profileId?: string;
  materialId?: string;
}

// ─── Singleton IfcAPI management ─────────────────────────────────────

let ifcApi: WebIFC.IfcAPI | null = null;

async function getIfcApi(): Promise<WebIFC.IfcAPI> {
  if (!ifcApi) {
    ifcApi = new WebIFC.IfcAPI();
    await ifcApi.Init();
  }
  return ifcApi;
}

// ─── Main import function ────────────────────────────────────────────

export async function importIfc(
  data: Uint8Array,
  options: IfcImportOptions = {},
): Promise<IfcImportResult> {
  const api = await getIfcApi();
  const modelID = api.OpenModel(data);

  try {
    return extractModel(api, modelID, options);
  } finally {
    api.CloseModel(modelID);
  }
}

// ─── Model extraction ────────────────────────────────────────────────

function extractModel(
  api: WebIFC.IfcAPI,
  modelID: number,
  options: IfcImportOptions,
): IfcImportResult {
  const tolerance = options.tolerance ?? 0.1;
  const warnings: string[] = [];

  // Detect length unit from the IFC file
  const lengthUnit = detectLengthUnit(api, modelID);
  const unitFactor = getIfcUnitFactor(lengthUnit);

  // Try analytical model first
  const analyticalIds = api.GetLineIDsWithType(modelID, WebIFC.IFCSTRUCTURALANALYSISMODEL);
  if (analyticalIds.size() > 0) {
    return extractAnalyticalModel(api, modelID, unitFactor, tolerance, warnings);
  }

  // Fallback: physical elements
  return extractPhysicalElements(api, modelID, unitFactor, tolerance, options, warnings);
}

// ─── Detect length unit ──────────────────────────────────────────────

function detectLengthUnit(api: WebIFC.IfcAPI, modelID: number): string {
  try {
    const unitAssignmentIds = api.GetLineIDsWithType(modelID, WebIFC.IFCUNITASSIGNMENT);
    if (unitAssignmentIds.size() === 0) return 'MILLIMETRE';
    const unitAssignment = api.GetLine(modelID, unitAssignmentIds.get(0), true);
    const units = unitAssignment?.Units;
    if (!Array.isArray(units)) return 'MILLIMETRE';
    for (const u of units) {
      if (u?.UnitType?.value === 'LENGTHUNIT' || u?.UnitType === 'LENGTHUNIT') {
        const name = u?.Name?.value ?? u?.Name;
        const prefix = u?.Prefix?.value ?? u?.Prefix;
        if (typeof name === 'string') {
          // Combine prefix + name: e.g. Prefix="MILLI" + Name="METRE" → "MILLIMETRE"
          const fullName = (typeof prefix === 'string' ? prefix + name : name).toUpperCase();
          return fullName;
        }
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return 'MILLIMETRE';
}

// ─── Tier 1: Analytical model extraction ─────────────────────────────

function extractAnalyticalModel(
  api: WebIFC.IfcAPI,
  modelID: number,
  unitFactor: number,
  tolerance: number,
  warnings: string[],
): IfcImportResult {
  const rawElements: RawElement[] = [];

  // Extract IfcStructuralCurveMember
  const profileMap = new Map<string, IfcProfileData>();
  const materialNames = new Map<string, { name: string; type: 'steel' | 'concrete' }>();
  const curveIds = api.GetLineIDsWithType(modelID, WebIFC.IFCSTRUCTURALCURVEMEMBER);
  for (let i = 0; i < curveIds.size(); i++) {
    const expressID = curveIds.get(i);
    try {
      const member = api.GetLine(modelID, expressID, true);
      const coords = extractCurveMemberEndpoints(api, modelID, member, unitFactor);
      if (coords) {
        // Extract profile & material
        const profileInfo = extractProfileFromElement(api, modelID, expressID);
        let profileId: string | undefined;
        if (profileInfo) {
          const key = profileInfo.name || `profile-${profileMap.size}`;
          if (!profileMap.has(key)) profileMap.set(key, profileInfo);
          profileId = key;
        }
        const matInfo = extractMaterialFromElement(api, modelID, expressID);
        let materialId: string | undefined;
        if (matInfo) {
          if (!materialNames.has(matInfo.name)) materialNames.set(matInfo.name, matInfo);
          materialId = matInfo.name;
        }

        rawElements.push({
          expressID,
          type: 'member',
          start: coords.start,
          end: coords.end,
          profileId,
          materialId,
        });
      } else {
        warnings.push(`Could not extract endpoints for IfcStructuralCurveMember #${expressID}`);
      }
    } catch {
      warnings.push(`Failed to read IfcStructuralCurveMember #${expressID}`);
    }
  }

  // Convert profiles to sections
  const sections: Section[] = [];
  let sIdx = 0;
  for (const [key, profile] of profileMap) {
    const section = ifcProfileToSection(profile, 'INCH', sIdx);
    section.id = key;
    section.name = key;
    sections.push(section);
    sIdx++;
  }

  // Convert materials
  const materials: Material[] = [];
  for (const [name, info] of materialNames) {
    materials.push(ifcMaterialToMaterial(name, info.type));
  }

  return buildResult(rawElements, materials, sections, tolerance, warnings, 'analytical');
}

function extractCurveMemberEndpoints(
  api: WebIFC.IfcAPI,
  modelID: number,
  member: Record<string, unknown>,
  unitFactor: number,
): { start: Point3D; end: Point3D } | null {
  try {
    const rep = member?.Representation as Record<string, unknown> | undefined;
    if (!rep) return null;

    const reps = rep?.Representations as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(reps) || reps.length === 0) return null;

    for (const shapeRep of reps) {
      const items = shapeRep?.Items as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        // Strategy 1a: IfcPolyline → Points array
        const points = item?.Points as unknown;
        if (Array.isArray(points) && points.length >= 2) {
          const s = extractCoords(points[0] as Record<string, unknown>, unitFactor);
          const e = extractCoords(points[points.length - 1] as Record<string, unknown>, unitFactor);
          if (s && e) return { start: s, end: e };
        }

        // Strategy 1b: IfcIndexedPolyCurve → Points (IfcCartesianPointList3D) → CoordList
        if (points && typeof points === 'object' && !Array.isArray(points)) {
          const coordList = (points as Record<string, unknown>)?.CoordList as unknown;
          const extracted = extractFromCoordList(coordList, unitFactor);
          if (extracted) return extracted;
        }

        // Strategy 2: IfcEdge → EdgeStart / EdgeEnd (flattened)
        const edgeStart = item?.EdgeStart as Record<string, unknown> | undefined;
        const edgeEnd = item?.EdgeEnd as Record<string, unknown> | undefined;
        if (edgeStart && edgeEnd) {
          const s = extractVertexPoint(edgeStart, unitFactor);
          const e = extractVertexPoint(edgeEnd, unitFactor);
          if (s && e) return { start: s, end: e };
        }

        // Strategy 3: IfcEdge returned as unresolved reference IDs
        const edgeStartRef = resolveRef(item?.EdgeStart);
        const edgeEndRef = resolveRef(item?.EdgeEnd);
        if (edgeStartRef !== null && edgeEndRef !== null) {
          const startVertex = api.GetLine(modelID, edgeStartRef, true);
          const endVertex = api.GetLine(modelID, edgeEndRef, true);
          const s = extractVertexPoint(startVertex, unitFactor);
          const e = extractVertexPoint(endVertex, unitFactor);
          if (s && e) return { start: s, end: e };
        }
      }
    }

    // Strategy 4: walk IfcRelConnectsStructuralMember to find connected point connections
    return extractEndpointsFromConnections(api, modelID, member, unitFactor);
  } catch {
    // Fall through
  }
  return null;
}

/** Resolve a web-ifc value that might be a reference ({value: expressID, type: 5}) or a plain number. */
function resolveRef(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'value' in val) {
    const v = (val as { value: unknown }).value;
    if (typeof v === 'number') return v;
  }
  return null;
}

/** Extract endpoints by walking IfcRelConnectsStructuralMember relationships. */
function extractEndpointsFromConnections(
  api: WebIFC.IfcAPI,
  modelID: number,
  member: Record<string, unknown>,
  unitFactor: number,
): { start: Point3D; end: Point3D } | null {
  try {
    const memberExpressID = (member as { expressID?: number }).expressID;
    if (!memberExpressID) return null;

    const relIds = api.GetLineIDsWithType(modelID, WebIFC.IFCRELCONNECTSSTRUCTURALMEMBER);
    const connectedPoints: Point3D[] = [];

    for (let i = 0; i < relIds.size(); i++) {
      const rel = api.GetLine(modelID, relIds.get(i), true);
      const relMember = rel?.RelatingStructuralMember as Record<string, unknown> | undefined;
      const relMemberID = (relMember as { expressID?: number })?.expressID ?? resolveRef(rel?.RelatingStructuralMember);

      if (relMemberID !== memberExpressID) continue;

      // Found a connection to this member — extract the point connection's coordinates
      const connection = rel?.RelatedStructuralConnection as Record<string, unknown> | undefined;
      if (!connection) {
        const connRef = resolveRef(rel?.RelatedStructuralConnection);
        if (connRef !== null) {
          const connLine = api.GetLine(modelID, connRef, true);
          const pt = extractPointConnectionCoords(connLine, unitFactor);
          if (pt) connectedPoints.push(pt);
        }
        continue;
      }
      const pt = extractPointConnectionCoords(connection, unitFactor);
      if (pt) connectedPoints.push(pt);
    }

    if (connectedPoints.length >= 2) {
      return { start: connectedPoints[0], end: connectedPoints[1] };
    }
  } catch {
    // Fall through
  }
  return null;
}

/** Extract coordinates from an IfcStructuralPointConnection's representation. */
function extractPointConnectionCoords(
  connection: Record<string, unknown>,
  unitFactor: number,
): Point3D | null {
  try {
    const rep = connection?.Representation as Record<string, unknown> | undefined;
    if (!rep) return null;

    const reps = rep?.Representations as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(reps)) return null;

    for (const shapeRep of reps) {
      const items = shapeRep?.Items as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        // IfcVertexPoint
        const pt = extractVertexPoint(item, unitFactor);
        if (pt) return pt;
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

// ─── Material association cache (avoids O(n²) lookups) ───────────────

interface MaterialAssocCache {
  elementToMat: Map<number, number>;
  resolvedMats: Map<number, Record<string, unknown>>;
}

/** Pre-build a map of elementId → materialRef, and resolve each unique material once. */
function buildMaterialAssocCache(api: WebIFC.IfcAPI, modelID: number): MaterialAssocCache {
  const elementToMat = new Map<number, number>();
  const matRefIds = new Set<number>();
  const relIds = api.GetLineIDsWithType(modelID, WebIFC.IFCRELASSOCIATESMATERIAL);
  for (let i = 0; i < relIds.size(); i++) {
    try {
      // Non-recursive: avoids resolving RelatedObjects (which include elements with body geometry)
      const rel = api.GetLine(modelID, relIds.get(i), false) as Record<string, unknown>;
      const relatedObjects = rel?.RelatedObjects as unknown[];
      const matRef = resolveRef(rel?.RelatingMaterial);
      if (!Array.isArray(relatedObjects) || matRef === null) continue;
      matRefIds.add(matRef);
      for (const obj of relatedObjects) {
        const eid = resolveRef(obj);
        if (eid !== null) elementToMat.set(eid, matRef);
      }
    } catch { /* skip */ }
  }
  // Resolve each unique material entity once (materials are small)
  const resolvedMats = new Map<number, Record<string, unknown>>();
  for (const ref of matRefIds) {
    try {
      resolvedMats.set(ref, api.GetLine(modelID, ref, true) as Record<string, unknown>);
    } catch { /* skip */ }
  }
  return { elementToMat, resolvedMats };
}

function extractProfileFromCache(elementId: number, cache: MaterialAssocCache): IfcProfileData | null {
  const matRef = cache.elementToMat.get(elementId);
  if (matRef === undefined) return null;
  const mat = cache.resolvedMats.get(matRef);
  return extractProfileFromMaterial(mat);
}

function extractMaterialFromCache(elementId: number, cache: MaterialAssocCache): { name: string; type: 'steel' | 'concrete' } | null {
  const matRef = cache.elementToMat.get(elementId);
  if (matRef === undefined) return null;
  const mat = cache.resolvedMats.get(matRef);
  const name = extractMaterialName(mat);
  if (name) return { name, type: guessMaterialType(name) };
  return null;
}

// ─── Lazy endpoint extraction (avoids resolving body geometry) ────────

/** Extract endpoints using selective resolution — only resolves ObjectPlacement and Axis representations.
 *  Skips expensive body geometry (AdvancedSweptSolid, Brep) that caused freezes on large files. */
function extractEndpointsLazy(
  api: WebIFC.IfcAPI,
  modelID: number,
  elementId: number,
  unitFactor: number,
): { start: Point3D; end: Point3D } | null {
  try {
    // Get element WITHOUT resolving references (avoids expensive body geometry)
    const line = api.GetLine(modelID, elementId, false) as Record<string, unknown>;

    // 1. Resolve ObjectPlacement chain (placement entities are small)
    const placementRef = resolveRef(line?.ObjectPlacement);
    let globalTransform = identityMat4();
    if (placementRef !== null) {
      try {
        const placement = api.GetLine(modelID, placementRef, true) as Record<string, unknown>;
        globalTransform = resolveGlobalTransform(placement, unitFactor);
      } catch { /* use identity */ }
    }

    // 2. Get ProductDefinitionShape → Representations (non-recursive)
    const prodRepRef = resolveRef(line?.Representation);
    if (prodRepRef !== null) {
      const prodRep = api.GetLine(modelID, prodRepRef, false) as Record<string, unknown>;
      const repRefs = prodRep?.Representations as unknown[];

      if (Array.isArray(repRefs)) {
        // First pass: look for Axis representations (small polylines, safe to resolve)
        for (const srRef of repRefs) {
          const srId = resolveRef(srRef);
          if (srId === null) continue;
          // Inspect type without resolving items
          const shapeRep = api.GetLine(modelID, srId, false) as Record<string, unknown>;
          const repType = strVal(shapeRep?.RepresentationType);
          const repId = strVal(shapeRep?.RepresentationIdentifier);

          if (repType === 'Curve2D' || repType === 'Curve3D' || repType === 'Axis') {
            const resolved = api.GetLine(modelID, srId, true) as Record<string, unknown>;
            const local = extractEndpointsFromItems(resolved, unitFactor);
            if (local) {
              return {
                start: transformPoint(globalTransform, local.start),
                end: transformPoint(globalTransform, local.end),
              };
            }
          }

          // MappedRepresentation wrapping Axis
          if (repType === 'MappedRepresentation' && repId === 'Axis') {
            const resolved = api.GetLine(modelID, srId, true) as Record<string, unknown>;
            const items = resolved?.Items as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(items)) {
              for (const mappedItem of items) {
                const source = mappedItem?.MappingSource as Record<string, unknown> | undefined;
                const innerRep = source?.MappedRepresentation as Record<string, unknown> | undefined;
                if (innerRep) {
                  const local = extractEndpointsFromItems(innerRep, unitFactor);
                  if (local) {
                    return {
                      start: transformPoint(globalTransform, local.start),
                      end: transformPoint(globalTransform, local.end),
                    };
                  }
                }
              }
            }
          }
        }

        // Second pass: fallback — extrusion depth or tessellation (skip expensive body types)
        if (placementRef !== null) {
          for (const srRef of repRefs) {
            const srId = resolveRef(srRef);
            if (srId === null) continue;
            const shapeRep = api.GetLine(modelID, srId, false) as Record<string, unknown>;
            const repType = strVal(shapeRep?.RepresentationType);

            // Skip expensive representations that don't provide simple length info
            if (repType === 'AdvancedSweptSolid' || repType === 'Brep' || repType === 'AdvancedBrep') continue;

            // SweptSolid / Clipping: IfcExtrudedAreaSolid has a Depth property
            if (repType === 'SweptSolid' || repType === 'Clipping') {
              try {
                const resolved = api.GetLine(modelID, srId, true) as Record<string, unknown>;
                const items = resolved?.Items as Array<Record<string, unknown>> | undefined;
                if (Array.isArray(items)) {
                  for (const item of items) {
                    const depth = item?.Depth as { value?: number } | number | undefined;
                    const d = typeof depth === 'number' ? depth : depth?.value;
                    if (typeof d === 'number' && d > 0) {
                      const extLength = d * unitFactor;
                      const start = transformPoint(globalTransform, { x: 0, y: 0, z: 0 });
                      const end = transformPoint(globalTransform, { x: 0, y: 0, z: extLength });
                      return { start, end };
                    }
                  }
                }
              } catch { /* skip */ }
            }

            // Tessellation: compute Z extent from coordinate bounding box
            if (repType === 'Tessellation') {
              try {
                const resolved = api.GetLine(modelID, srId, true) as Record<string, unknown>;
                const items = resolved?.Items as Array<Record<string, unknown>> | undefined;
                if (Array.isArray(items)) {
                  for (const item of items) {
                    const coordsObj = item?.Coordinates as Record<string, unknown> | undefined;
                    const coordList = coordsObj?.CoordList as unknown;
                    if (!Array.isArray(coordList) || coordList.length === 0) continue;
                    let minZ = Infinity, maxZ = -Infinity;
                    for (const tuple of coordList) {
                      if (!Array.isArray(tuple) || tuple.length < 3) continue;
                      const z = numVal(tuple[2]);
                      if (z === undefined) continue;
                      if (z < minZ) minZ = z;
                      if (z > maxZ) maxZ = z;
                    }
                    const extent = Math.abs(maxZ - minZ);
                    if (extent > 0 && Number.isFinite(extent)) {
                      const tessLength = extent * unitFactor;
                      const start = transformPoint(globalTransform, { x: 0, y: 0, z: 0 });
                      const end = transformPoint(globalTransform, { x: 0, y: 0, z: tessLength });
                      return { start, end };
                    }
                  }
                }
              } catch { /* skip */ }
            }
          }
        }
      }
    }
  } catch { /* fall through */ }
  return null;
}

// ─── Tier 2: Physical element extraction ─────────────────────────────

function extractPhysicalElements(
  api: WebIFC.IfcAPI,
  modelID: number,
  unitFactor: number,
  tolerance: number,
  options: IfcImportOptions,
  warnings: string[],
): IfcImportResult {
  const rawElements: RawElement[] = [];
  const profileMap = new Map<string, IfcProfileData>();
  const materialNames = new Map<string, { name: string; type: 'steel' | 'concrete' }>();

  const allowedTypes = options.elementTypes ?? ['beam', 'column', 'member'];

  const typeMap: Array<[number, 'beam' | 'column' | 'member']> = [];
  if (allowedTypes.includes('beam')) {
    typeMap.push([WebIFC.IFCBEAM, 'beam']);
  }
  if (allowedTypes.includes('column')) {
    typeMap.push([WebIFC.IFCCOLUMN, 'column']);
  }
  if (allowedTypes.includes('member')) {
    typeMap.push([WebIFC.IFCMEMBER, 'member']);
  }

  // Pre-build material association cache to avoid O(n²) GetLine calls
  const matCache = buildMaterialAssocCache(api, modelID);

  for (const [ifcType, elemType] of typeMap) {
    const ids = api.GetLineIDsWithType(modelID, ifcType);
    for (let i = 0; i < ids.size(); i++) {
      const expressID = ids.get(i);
      try {
        // Lazy extraction: only resolves placement + Axis reps, skips body geometry
        const endpoints = extractEndpointsLazy(api, modelID, expressID, unitFactor);
        if (!endpoints) {
          warnings.push(`Could not extract geometry for ${elemType} #${expressID}`);
          continue;
        }

        // Extract profile from cached material associations
        const profileInfo = extractProfileFromCache(expressID, matCache);
        let profileId: string | undefined;
        if (profileInfo) {
          const key = profileInfo.name || `profile-${profileMap.size}`;
          if (!profileMap.has(key)) {
            profileMap.set(key, profileInfo);
          }
          profileId = key;
        }

        // Extract material from cached associations
        const matInfo = extractMaterialFromCache(expressID, matCache);
        let materialId: string | undefined;
        if (matInfo) {
          if (!materialNames.has(matInfo.name)) {
            materialNames.set(matInfo.name, { name: matInfo.name, type: matInfo.type });
          }
          materialId = matInfo.name;
        }

        rawElements.push({
          expressID,
          type: elemType,
          start: endpoints.start,
          end: endpoints.end,
          profileId,
          materialId,
        });
      } catch {
        warnings.push(`Failed to read ${elemType} #${expressID}`);
      }
    }
  }

  // Convert profiles to sections
  const sections: Section[] = [];
  const profileKeyToSectionId = new Map<string, string>();
  let sIdx = 0;
  for (const [key, profile] of profileMap) {
    const section = ifcProfileToSection(profile, 'INCH', sIdx); // Already converted via unitFactor
    section.id = key;
    section.name = key;
    sections.push(section);
    profileKeyToSectionId.set(key, key);
    sIdx++;
  }

  // Convert IFC materials
  const materials: Material[] = [];
  for (const [name, info] of materialNames) {
    materials.push(ifcMaterialToMaterial(name, info.type));
  }

  // Map profile/material IDs onto raw elements
  for (const elem of rawElements) {
    if (elem.profileId && profileKeyToSectionId.has(elem.profileId)) {
      elem.profileId = profileKeyToSectionId.get(elem.profileId);
    }
  }

  return buildResult(rawElements, materials, sections, tolerance, warnings, 'physical');
}

// ─── Geometry extraction helpers ─────────────────────────────────────

// 3x3 rotation matrix + translation for coordinate transforms
export type Mat4 = [number, number, number, number, number, number, number, number, number, number, number, number];
// Layout: [xx, xy, xz, yx, yy, yz, zx, zy, zz, tx, ty, tz]

export function identityMat4(): Mat4 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
}

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  // R_result = R_a * R_b, T_result = R_a * T_b + T_a
  return [
    a[0] * b[0] + a[3] * b[1] + a[6] * b[2],
    a[1] * b[0] + a[4] * b[1] + a[7] * b[2],
    a[2] * b[0] + a[5] * b[1] + a[8] * b[2],
    a[0] * b[3] + a[3] * b[4] + a[6] * b[5],
    a[1] * b[3] + a[4] * b[4] + a[7] * b[5],
    a[2] * b[3] + a[5] * b[4] + a[8] * b[5],
    a[0] * b[6] + a[3] * b[7] + a[6] * b[8],
    a[1] * b[6] + a[4] * b[7] + a[7] * b[8],
    a[2] * b[6] + a[5] * b[7] + a[8] * b[8],
    a[0] * b[9] + a[3] * b[10] + a[6] * b[11] + a[9],
    a[1] * b[9] + a[4] * b[10] + a[7] * b[11] + a[10],
    a[2] * b[9] + a[5] * b[10] + a[8] * b[11] + a[11],
  ];
}

export function transformPoint(m: Mat4, p: Point3D): Point3D {
  return {
    x: m[0] * p.x + m[3] * p.y + m[6] * p.z + m[9],
    y: m[1] * p.x + m[4] * p.y + m[7] * p.z + m[10],
    z: m[2] * p.x + m[5] * p.y + m[8] * p.z + m[11],
  };
}

/** Build a transform from IfcAxis2Placement3D (Location, Axis, RefDirection). */
export function buildPlacementTransform(placement: Record<string, unknown>, unitFactor: number): Mat4 {
  const location = placement?.Location as Record<string, unknown> | undefined;
  const axisDir = placement?.Axis as Record<string, unknown> | undefined;
  const refDir = placement?.RefDirection as Record<string, unknown> | undefined;

  const t = location ? extractCoords(location, unitFactor) : null;
  const tx = t?.x ?? 0;
  const ty = t?.y ?? 0;
  const tz = t?.z ?? 0;

  // Z axis (Axis direction, default (0,0,1))
  const zRatios = extractDirectionRatios(axisDir?.DirectionRatios as unknown);
  const zx = zRatios?.[0] ?? 0;
  const zy = zRatios?.[1] ?? 0;
  const zz = zRatios?.[2] ?? 1;

  // X axis (RefDirection, default (1,0,0))
  const xRatios = extractDirectionRatios(refDir?.DirectionRatios as unknown);
  let xx = xRatios?.[0] ?? 1;
  let xy = xRatios?.[1] ?? 0;
  let xz = xRatios?.[2] ?? 0;

  // Orthogonalize X against Z: X' = X - (X·Z)Z, then normalize
  const dot = xx * zx + xy * zy + xz * zz;
  xx -= dot * zx;
  xy -= dot * zy;
  xz -= dot * zz;
  const xLen = Math.sqrt(xx * xx + xy * xy + xz * xz);
  if (xLen > 1e-10) { xx /= xLen; xy /= xLen; xz /= xLen; }

  // Y = Z × X
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  return [xx, xy, xz, yx, yy, yz, zx, zy, zz, tx, ty, tz];
}

/** Resolve the full ObjectPlacement chain to a global transform. */
function resolveGlobalTransform(placement: Record<string, unknown> | undefined, unitFactor: number, depth = 0): Mat4 {
  if (!placement || depth > 20) return identityMat4();

  const relPlacement = placement?.RelativePlacement as Record<string, unknown> | undefined;
  const local = relPlacement ? buildPlacementTransform(relPlacement, unitFactor) : identityMat4();

  const parent = placement?.PlacementRelTo as Record<string, unknown> | undefined;
  if (!parent) return local;

  const parentTransform = resolveGlobalTransform(parent, unitFactor, depth + 1);
  return multiplyMat4(parentTransform, local);
}

/** Extract start/end endpoints from shape representation items (handles IfcPolyline and IfcIndexedPolyCurve). */
export function extractEndpointsFromItems(
  shapeRep: Record<string, unknown>,
  unitFactor: number,
): { start: Point3D; end: Point3D } | null {
  const items = shapeRep?.Items as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) return null;

  for (const item of items) {
    // Strategy A: IfcPolyline → Points array of IfcCartesianPoint
    const points = item?.Points as unknown;
    if (Array.isArray(points) && points.length >= 2) {
      const s = extractCoords(points[0] as Record<string, unknown>, unitFactor);
      const e = extractCoords(points[points.length - 1] as Record<string, unknown>, unitFactor);
      if (s && e) return { start: s, end: e };
    }

    // Strategy B: IfcIndexedPolyCurve → Points (IfcCartesianPointList3D) → CoordList
    if (points && typeof points === 'object' && !Array.isArray(points)) {
      const coordList = (points as Record<string, unknown>)?.CoordList as unknown;
      const extracted = extractFromCoordList(coordList, unitFactor);
      if (extracted) return extracted;
    }
  }
  return null;
}

/** Extract start/end from an IfcCartesianPointList3D CoordList (array of coordinate tuples). */
export function extractFromCoordList(
  coordList: unknown,
  unitFactor: number,
): { start: Point3D; end: Point3D } | null {
  if (!Array.isArray(coordList) || coordList.length < 2) return null;

  const first = coordList[0];
  const last = coordList[coordList.length - 1];

  const s = parseTuple(first, unitFactor);
  const e = parseTuple(last, unitFactor);
  if (s && e) return { start: s, end: e };
  return null;
}

/** Parse a coordinate tuple like [x,y,z] or [{value:x},{value:y},{value:z}]. */
export function parseTuple(tuple: unknown, unitFactor: number): Point3D | null {
  if (!Array.isArray(tuple) || tuple.length < 2) return null;
  const x = numVal(tuple[0]);
  const y = numVal(tuple[1]);
  const z = numVal(tuple[2]);
  if (x === undefined || y === undefined) return null;
  return { x: x * unitFactor, y: y * unitFactor, z: (z ?? 0) * unitFactor };
}

/** Extract direction ratios as a number array, handling web-ifc value wrapping. */
export function extractDirectionRatios(ratios: unknown): number[] | null {
  if (!Array.isArray(ratios)) return null;
  const result: number[] = [];
  for (const v of ratios) {
    const n = numVal(v);
    if (n === undefined) return null;
    result.push(n);
  }
  return result.length >= 2 ? result : null;
}

function extractCoords(point: Record<string, unknown>, unitFactor: number): Point3D | null {
  // web-ifc can return Coordinates as: [1,2,3], [{value:1},{value:2},{value:3}], or {value:[1,2,3]}
  let coords = point?.Coordinates as unknown;

  // Unwrap {value: [...]}
  if (coords && typeof coords === 'object' && !Array.isArray(coords) && 'value' in (coords as Record<string, unknown>)) {
    coords = (coords as { value: unknown }).value;
  }

  if (Array.isArray(coords) && coords.length >= 2) {
    const x = numVal(coords[0]);
    const y = numVal(coords[1]);
    const z = numVal(coords[2]);
    if (x !== undefined && y !== undefined) {
      return { x: x * unitFactor, y: y * unitFactor, z: (z ?? 0) * unitFactor };
    }
  }

  // Try x/y/z direct properties
  const x = numVal(point?.x);
  const y = numVal(point?.y);
  const z = numVal(point?.z);
  if (x !== undefined && y !== undefined) {
    return { x: x * unitFactor, y: y * unitFactor, z: (z ?? 0) * unitFactor };
  }
  return null;
}

function extractVertexPoint(vertex: Record<string, unknown>, unitFactor: number): Point3D | null {
  // IfcVertexPoint → VertexGeometry → IfcCartesianPoint
  const vertexGeometry = vertex?.VertexGeometry as Record<string, unknown> | undefined;
  if (vertexGeometry && typeof vertexGeometry === 'object') {
    const pt = extractCoords(vertexGeometry, unitFactor);
    if (pt) return pt;
  }
  // Try direct coords on the vertex itself (flattened by web-ifc)
  const pt = extractCoords(vertex, unitFactor);
  if (pt) return pt;
  // Try Location property (some versions)
  const location = vertex?.Location as Record<string, unknown> | undefined;
  if (location) return extractCoords(location, unitFactor);
  return null;
}

// ─── Profile extraction ──────────────────────────────────────────────

function extractProfileFromElement(
  api: WebIFC.IfcAPI,
  modelID: number,
  elementId: number,
): IfcProfileData | null {
  try {
    // Get material associations
    const relIds = api.GetLineIDsWithType(modelID, WebIFC.IFCRELASSOCIATESMATERIAL);
    for (let i = 0; i < relIds.size(); i++) {
      const rel = api.GetLine(modelID, relIds.get(i), true);
      const relatedObjects = rel?.RelatedObjects as Array<{ expressID?: number }> | undefined;
      if (!Array.isArray(relatedObjects)) continue;

      const isRelated = relatedObjects.some(
        (obj) => obj?.expressID === elementId,
      );
      if (!isRelated) continue;

      // Navigate to material profile set
      const matSelect = rel?.RelatingMaterial;
      return extractProfileFromMaterial(matSelect);
    }
  } catch {
    // Ignore
  }
  return null;
}

function extractProfileFromMaterial(mat: Record<string, unknown> | undefined): IfcProfileData | null {
  if (!mat) return null;

  // IfcMaterialProfileSetUsage → IfcMaterialProfileSet → IfcMaterialProfile → IfcProfileDef
  const profileSet = mat?.ForProfileSet as Record<string, unknown> | undefined
    ?? mat?.MaterialProfiles as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(profileSet) && profileSet.length > 0) {
    return extractProfileDef(profileSet[0]);
  }

  // Direct IfcMaterialProfileSet
  const profiles = mat?.MaterialProfiles as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(profiles) && profiles.length > 0) {
    return extractProfileDef(profiles[0]);
  }

  return null;
}

function extractProfileDef(matProfile: Record<string, unknown>): IfcProfileData | null {
  const profile = matProfile?.Profile as Record<string, unknown> | undefined;
  if (!profile) return null;

  const typeName = profile?.constructor?.name ?? '';
  const name = strVal(profile?.ProfileName) ?? typeName;

  return {
    type: typeName || 'Unknown',
    name,
    OverallDepth: numVal(profile?.OverallDepth),
    OverallWidth: numVal(profile?.OverallWidth ?? profile?.FlangeWidth),
    WebThickness: numVal(profile?.WebThickness),
    FlangeThickness: numVal(profile?.FlangeThickness ?? profile?.TopFlangeThickness),
    XDim: numVal(profile?.XDim),
    YDim: numVal(profile?.YDim),
    WallThickness: numVal(profile?.WallThickness),
    Radius: numVal(profile?.Radius),
  };
}

/** Unwraps an IFC attribute that may be a bare number or a `{ value }` wrapper. */
export function numVal(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'value' in v) {
    const inner = (v as { value: unknown }).value;
    if (typeof inner === 'number') return inner;
  }
  return undefined;
}

/**
 * Unwraps an IFC attribute that may be a bare string or a `{ value }` wrapper.
 * Returns `undefined` for an empty string, deliberately — IFC files sometimes
 * emit ProfileName/Name as `''` rather than omitting the attribute, and callers
 * should treat that the same as "not set" and fall through to their next fallback.
 */
export function strVal(v: unknown): string | undefined {
  if (typeof v === 'string') return v.length > 0 ? v : undefined;
  if (v && typeof v === 'object' && 'value' in v) {
    const inner = (v as { value: unknown }).value;
    if (typeof inner === 'string') return inner.length > 0 ? inner : undefined;
  }
  return undefined;
}

// ─── Material extraction ─────────────────────────────────────────────

function extractMaterialFromElement(
  api: WebIFC.IfcAPI,
  modelID: number,
  elementId: number,
): { name: string; type: 'steel' | 'concrete' } | null {
  try {
    const relIds = api.GetLineIDsWithType(modelID, WebIFC.IFCRELASSOCIATESMATERIAL);
    for (let i = 0; i < relIds.size(); i++) {
      const rel = api.GetLine(modelID, relIds.get(i), true);
      const relatedObjects = rel?.RelatedObjects as Array<{ expressID?: number }> | undefined;
      if (!Array.isArray(relatedObjects)) continue;
      if (!relatedObjects.some((obj) => obj?.expressID === elementId)) continue;

      const matSelect = rel?.RelatingMaterial;
      const name = extractMaterialName(matSelect);
      if (name) {
        const type = guessMaterialType(name);
        return { name, type };
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function extractMaterialName(mat: Record<string, unknown> | undefined): string | null {
  if (!mat) return null;

  // Direct IfcMaterial
  const name = strVal(mat?.Name);
  if (name) return name;

  // IfcMaterialProfileSetUsage → ForProfileSet → MaterialProfiles[0] → Material
  const profiles = mat?.MaterialProfiles as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(profiles) && profiles.length > 0) {
    const innerMat = profiles[0]?.Material as Record<string, unknown> | undefined;
    const innerName = strVal(innerMat?.Name);
    if (innerName) return innerName;
  }

  const forSet = mat?.ForProfileSet as Record<string, unknown> | undefined;
  if (forSet) return extractMaterialName(forSet);

  return null;
}

function guessMaterialType(name: string): 'steel' | 'concrete' {
  const lower = name.toLowerCase();
  if (lower.includes('concrete') || lower.includes('hormig') || lower.includes('beton')) {
    return 'concrete';
  }
  return 'steel';
}

export function ifcMaterialToMaterial(name: string, type: 'steel' | 'concrete'): Material {
  if (type === 'steel') {
    return {
      id: name,
      name,
      type: 'steel',
      E: 29000,
      G: 11200,
      density: 0.000284,
      fy: 50,
      fu: 65,
    };
  }
  return {
    id: name,
    name,
    type: 'concrete',
    E: 3605,
    G: 1502,
    density: 0.0000868,
    fc: 4,
  };
}

// ─── Build result from raw elements ──────────────────────────────────

function buildResult(
  rawElements: RawElement[],
  materials: Material[],
  sections: Section[],
  tolerance: number,
  warnings: string[],
  strategy: 'analytical' | 'physical',
): IfcImportResult {
  const uniqueNodes: Point3D[] = [];
  let duplicatesMerged = 0;

  function findOrAddNode(point: Point3D): number {
    for (let i = 0; i < uniqueNodes.length; i++) {
      const n = uniqueNodes[i];
      const dist = Math.sqrt((n.x - point.x) ** 2 + (n.y - point.y) ** 2 + (n.z - point.z) ** 2);
      if (dist < tolerance) {
        duplicatesMerged++;
        return i;
      }
    }
    uniqueNodes.push({ ...point });
    return uniqueNodes.length - 1;
  }

  const elementData: Array<{
    nodeIIdx: number;
    nodeJIdx: number;
    sectionId: string;
    materialId: string;
  }> = [];

  for (const elem of rawElements) {
    // Skip elements with NaN or Infinity coordinates
    const coords = [elem.start.x, elem.start.y, elem.start.z, elem.end.x, elem.end.y, elem.end.z];
    if (coords.some((c) => !Number.isFinite(c))) {
      warnings.push(`Skipped element #${elem.expressID}: invalid coordinates`);
      continue;
    }
    const iIdx = findOrAddNode(elem.start);
    const jIdx = findOrAddNode(elem.end);
    if (iIdx !== jIdx) {
      elementData.push({
        nodeIIdx: iIdx,
        nodeJIdx: jIdx,
        sectionId: elem.profileId ?? 'W12x26',
        materialId: elem.materialId ?? 'steel-A992',
      });
    }
  }

  // Re-center model to handle survey/world coordinates (e.g. Revit IFC exports)
  // that place elements far from origin causing rendering issues.
  if (uniqueNodes.length > 0) {
    let cx = 0, cy = 0, cz = 0;
    for (const p of uniqueNodes) {
      cx += p.x; cy += p.y; cz += p.z;
    }
    cx /= uniqueNodes.length;
    cy /= uniqueNodes.length;
    cz /= uniqueNodes.length;
    for (const p of uniqueNodes) {
      p.x -= cx; p.y -= cy; p.z -= cz;
    }
  }

  const nodes: StructuralNode[] = uniqueNodes.map((p, i) => ({
    id: `n${i + 1}`,
    x: p.x,
    y: p.y,
    z: p.z,
  }));

  const elements: FrameElement[] = elementData.map((ed, i) => ({
    id: `e${i + 1}`,
    nodeI: nodes[ed.nodeIIdx].id,
    nodeJ: nodes[ed.nodeJIdx].id,
    materialId: ed.materialId,
    sectionId: ed.sectionId,
    betaAngle: 0,
  }));

  let beamsFound = 0;
  let columnsFound = 0;
  let membersFound = 0;
  for (const e of rawElements) {
    if (e.type === 'beam') beamsFound++;
    else if (e.type === 'column') columnsFound++;
    else membersFound++;
  }

  return {
    nodes,
    elements,
    materials,
    sections,
    warnings,
    stats: {
      beamsFound,
      columnsFound,
      membersFound,
      nodesCreated: nodes.length,
      elementsCreated: elements.length,
      duplicatesMerged,
      sectionsCreated: sections.length,
      materialsFound: materials.length,
      strategy,
    },
  };
}

/**
 * DXF file import → structural model conversion.
 * Supports LINE, LWPOLYLINE, POLYLINE entities.
 */
import DxfParser from 'dxf-parser';
import type { StructuralNode, FrameElement } from '../core/types';

export type DxfUnit = 'inches' | 'feet' | 'mm' | 'cm' | 'm';

export interface DxfImportOptions {
  tolerance?: number;
  units?: DxfUnit;
  layers?: string[];
}

export interface DxfImportStats {
  linesFound: number;
  nodesCreated: number;
  elementsCreated: number;
  duplicatesMerged: number;
}

export interface DxfImportResult {
  nodes: StructuralNode[];
  elements: FrameElement[];
  warnings: string[];
  stats: DxfImportStats;
  layers: string[];
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface LineSegment {
  start: Point3D;
  end: Point3D;
}

const UNIT_FACTORS: Record<DxfUnit, number> = {
  inches: 1,
  feet: 12,
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  m: 39.3701,
};

/**
 * Parse DXF text and convert to structural model nodes & elements.
 */
export function importDxf(dxfContent: string, options: DxfImportOptions = {}): DxfImportResult {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfContent);
  if (!dxf) {
    return {
      nodes: [],
      elements: [],
      warnings: ['Failed to parse DXF file'],
      stats: { linesFound: 0, nodesCreated: 0, elementsCreated: 0, duplicatesMerged: 0 },
      layers: [],
    };
  }

  return convertEntities(dxf.entities, options);
}

/**
 * Convert parsed DXF entities to structural model.
 * Exported for direct testing without DXF text parsing.
 */
export function convertEntities(
  entities: Array<{ type: string; layer?: string; vertices?: Array<{ x: number; y: number; z?: number }>; center?: Point3D; radius?: number }>,
  options: DxfImportOptions = {},
): DxfImportResult {
  const tolerance = options.tolerance ?? 0.1;
  const unitFactor = UNIT_FACTORS[options.units ?? 'inches'];
  const filterLayers = options.layers;

  const warnings: string[] = [];
  const segments: LineSegment[] = [];
  let linesFound = 0;

  // Collect all unique layers
  const layerSet = new Set<string>();

  for (const entity of entities) {
    if (entity.layer) layerSet.add(entity.layer);

    // Layer filter
    if (filterLayers && entity.layer && !filterLayers.includes(entity.layer)) continue;

    const type = entity.type?.toUpperCase();

    if (type === 'LINE') {
      const verts = entity.vertices;
      if (verts && verts.length >= 2) {
        segments.push({
          start: { x: (verts[0].x ?? 0) * unitFactor, y: (verts[0].y ?? 0) * unitFactor, z: (verts[0].z ?? 0) * unitFactor },
          end: { x: (verts[1].x ?? 0) * unitFactor, y: (verts[1].y ?? 0) * unitFactor, z: (verts[1].z ?? 0) * unitFactor },
        });
        linesFound++;
      }
    } else if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
      const verts = entity.vertices;
      if (verts && verts.length >= 2) {
        for (let i = 0; i < verts.length - 1; i++) {
          segments.push({
            start: { x: (verts[i].x ?? 0) * unitFactor, y: (verts[i].y ?? 0) * unitFactor, z: (verts[i].z ?? 0) * unitFactor },
            end: { x: (verts[i + 1].x ?? 0) * unitFactor, y: (verts[i + 1].y ?? 0) * unitFactor, z: (verts[i + 1].z ?? 0) * unitFactor },
          });
        }
        linesFound += verts.length - 1;
      }
    } else if (type === 'CIRCLE' || type === 'ARC' || type === 'ELLIPSE') {
      warnings.push(`Skipped unsupported entity: ${type}`);
    }
  }

  // Build unique nodes with tolerance merging
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

  // Create elements from segments
  const elementData: Array<{ nodeIIdx: number; nodeJIdx: number }> = [];
  for (const seg of segments) {
    const iIdx = findOrAddNode(seg.start);
    const jIdx = findOrAddNode(seg.end);
    if (iIdx !== jIdx) {
      elementData.push({ nodeIIdx: iIdx, nodeJIdx: jIdx });
    }
  }

  // Convert to typed model objects
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
    materialId: 'steel-A992',
    sectionId: 'W12x26',
    betaAngle: 0,
  }));

  return {
    nodes,
    elements,
    warnings,
    stats: {
      linesFound,
      nodesCreated: nodes.length,
      elementsCreated: elements.length,
      duplicatesMerged,
    },
    layers: [...layerSet],
  };
}

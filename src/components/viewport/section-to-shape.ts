import * as THREE from 'three';
import type { Section, Material } from '../../core/types';
import { createWShape, createHSSRect, createRectShape, createCircleShape } from './SectionShapes';

export type ShapeType = 'w-shape' | 'hss-rect' | 'rectangle' | 'circle';

export interface SectionShapeResult {
  type: ShapeType;
  shape: THREE.Shape;
}

/**
 * Map a Section + Material to a Three.js Shape for extrusion.
 * Uses section name heuristics and geometric data when available.
 */
export function sectionToShape(
  section: Section,
  material?: Material,
): SectionShapeResult {
  const name = section.name.toUpperCase();

  // W-shape: needs d, bf, tf, tw
  if (name.startsWith('W') && section.d && section.bf && section.tf && section.tw) {
    return {
      type: 'w-shape',
      shape: createWShape(section.d, section.bf, section.tf, section.tw),
    };
  }

  // HSS rectangular: needs b, h (and infer wall thickness)
  if (name.startsWith('HSS') && section.b && section.h) {
    const t = section.tw ?? 0.25; // Wall thickness, default 1/4"
    return {
      type: 'hss-rect',
      shape: createHSSRect(section.b, section.h, t),
    };
  }

  // Concrete sections: solid rectangle
  if (material?.type === 'concrete' && section.b && section.h) {
    return {
      type: 'rectangle',
      shape: createRectShape(section.b, section.h),
    };
  }

  // Concrete with d as depth (square assumption)
  if (material?.type === 'concrete' && section.d) {
    const side = section.d;
    return {
      type: 'rectangle',
      shape: createRectShape(side, side),
    };
  }

  // Fallback: circle derived from cross-sectional area
  const radius = section.A > 0 ? Math.sqrt(section.A / Math.PI) : 0.5;
  return {
    type: 'circle',
    shape: createCircleShape(radius),
  };
}

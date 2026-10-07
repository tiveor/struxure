import * as THREE from 'three';
import type { Section, Material } from '../../core/types';
import { createWShape, createHSSRect, createRectShape, createCircleShape, createPipeShape } from './SectionShapes';

export type ShapeType = 'w-shape' | 'hss-rect' | 'rectangle' | 'pipe' | 'circle';

export interface SectionShapeResult {
  type: ShapeType;
  shape: THREE.Shape;
}

function iShape(section: Section): SectionShapeResult | null {
  const { d, bf, tf, tw } = section;
  if (!d || !bf || !tf || !tw) return null;
  return { type: 'w-shape', shape: createWShape(d, bf, tf, tw) };
}

function hssShape(section: Section): SectionShapeResult | null {
  const b = section.b ?? section.bf;
  const h = section.h ?? section.d;
  if (!b || !h) return null;
  const t = section.tw ?? 0.25; // Wall thickness, default 1/4"
  return { type: 'hss-rect', shape: createHSSRect(b, h, t) };
}

function rectShape(section: Section): SectionShapeResult | null {
  const b = section.b ?? section.bf;
  const h = section.h ?? section.d;
  if (!b || !h) return null;
  return { type: 'rectangle', shape: createRectShape(b, h) };
}

function pipeShape(section: Section): SectionShapeResult | null {
  const D = section.d;
  if (!D) return null;
  const t = section.tw;
  // Without a wall thickness, draw the pipe solid rather than guess one.
  if (!t || 2 * t >= D) return { type: 'pipe', shape: createCircleShape(D / 2) };
  return { type: 'pipe', shape: createPipeShape(D / 2, D / 2 - t) };
}

/**
 * Map a Section + Material to a Three.js Shape for extrusion. An explicit
 * `shape` wins; sections without one (older files, custom entries) fall back
 * to the name prefix and the material.
 */
export function sectionToShape(
  section: Section,
  material?: Material,
): SectionShapeResult {
  const byShape =
    section.shape === 'I' ? iShape(section)
    : section.shape === 'HSS' ? hssShape(section)
    : section.shape === 'rect' ? rectShape(section)
    : section.shape === 'pipe' ? pipeShape(section)
    : null;
  if (byShape) return byShape;

  const name = section.name.toUpperCase();

  // W-shape: needs d, bf, tf, tw
  if (!section.shape && name.startsWith('W')) {
    const w = iShape(section);
    if (w) return w;
  }

  // HSS rectangular: needs b, h (and infer wall thickness)
  if (!section.shape && name.startsWith('HSS') && section.b && section.h) {
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

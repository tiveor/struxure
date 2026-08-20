import * as THREE from 'three';

/**
 * Create a W-shape (Wide Flange / I-beam) cross-section.
 * 12 vertices forming the I-profile outline.
 */
export function createWShape(d: number, bf: number, tf: number, tw: number): THREE.Shape {
  const shape = new THREE.Shape();
  const halfD = d / 2;
  const halfBf = bf / 2;
  const halfTw = tw / 2;

  shape.moveTo(-halfBf, halfD);
  shape.lineTo(halfBf, halfD);
  shape.lineTo(halfBf, halfD - tf);
  shape.lineTo(halfTw, halfD - tf);
  shape.lineTo(halfTw, -halfD + tf);
  shape.lineTo(halfBf, -halfD + tf);
  shape.lineTo(halfBf, -halfD);
  shape.lineTo(-halfBf, -halfD);
  shape.lineTo(-halfBf, -halfD + tf);
  shape.lineTo(-halfTw, -halfD + tf);
  shape.lineTo(-halfTw, halfD - tf);
  shape.lineTo(-halfBf, halfD - tf);
  shape.closePath();

  return shape;
}

/**
 * Create an HSS rectangular hollow section.
 */
export function createHSSRect(b: number, h: number, t: number): THREE.Shape {
  const outer = new THREE.Shape();
  outer.moveTo(-b / 2, -h / 2);
  outer.lineTo(b / 2, -h / 2);
  outer.lineTo(b / 2, h / 2);
  outer.lineTo(-b / 2, h / 2);
  outer.closePath();

  const inner = new THREE.Path();
  inner.moveTo(-b / 2 + t, -h / 2 + t);
  inner.lineTo(b / 2 - t, -h / 2 + t);
  inner.lineTo(b / 2 - t, h / 2 - t);
  inner.lineTo(-b / 2 + t, h / 2 - t);
  inner.closePath();
  outer.holes.push(inner);

  return outer;
}

/**
 * Create a circular hollow (pipe) section.
 */
export function createPipeShape(outerR: number, innerR: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

/**
 * Create a solid rectangular section (typically concrete).
 */
export function createRectShape(b: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-b / 2, -h / 2);
  shape.lineTo(b / 2, -h / 2);
  shape.lineTo(b / 2, h / 2);
  shape.lineTo(-b / 2, h / 2);
  shape.closePath();
  return shape;
}

/**
 * Create a solid circular section.
 */
export function createCircleShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  return shape;
}

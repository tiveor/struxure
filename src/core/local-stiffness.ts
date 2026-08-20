import { Matrix } from 'ml-matrix';
import type { FrameElement, Material, Section, StructuralNode } from './types';

/**
 * Compute the length of a frame element.
 */
export function elementLength(nodeI: StructuralNode, nodeJ: StructuralNode): number {
  const dx = nodeJ.x - nodeI.x;
  const dy = nodeJ.y - nodeI.y;
  const dz = nodeJ.z - nodeI.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Compute the 12x12 local stiffness matrix for a 3D frame element.
 *
 * DOF order per node: [ux, uy, uz, rx, ry, rz]
 * Element DOFs: [nodeI: ux,uy,uz,rx,ry,rz | nodeJ: ux,uy,uz,rx,ry,rz]
 *
 * Uses Euler-Bernoulli beam theory (no shear deformation).
 */
export function localStiffnessMatrix(
  _element: FrameElement,
  material: Material,
  section: Section,
  nodeI: StructuralNode,
  nodeJ: StructuralNode
): Matrix {
  const L = elementLength(nodeI, nodeJ);
  const E = material.E;
  const G = material.G;
  const A = section.A;
  const Iz = section.Ix; // Strong axis (bending about z in local coords)
  const Iy = section.Iy; // Weak axis (bending about y in local coords)
  const J = section.J;

  const L2 = L * L;
  const L3 = L2 * L;

  // Axial stiffness
  const EA_L = (E * A) / L;

  // Bending stiffness about local z-axis (strong axis)
  const EIz = E * Iz;
  const k_z1 = (12 * EIz) / L3;
  const k_z2 = (6 * EIz) / L2;
  const k_z3 = (4 * EIz) / L;
  const k_z4 = (2 * EIz) / L;

  // Bending stiffness about local y-axis (weak axis)
  const EIy = E * Iy;
  const k_y1 = (12 * EIy) / L3;
  const k_y2 = (6 * EIy) / L2;
  const k_y3 = (4 * EIy) / L;
  const k_y4 = (2 * EIy) / L;

  // Torsional stiffness
  const GJ_L = (G * J) / L;

  // Build 12x12 local stiffness matrix
  // DOF order: [ux1, uy1, uz1, rx1, ry1, rz1, ux2, uy2, uz2, rx2, ry2, rz2]
  const k = Matrix.zeros(12, 12);

  // Row 0 (ux1): axial
  k.set(0, 0, EA_L);
  k.set(0, 6, -EA_L);

  // Row 1 (uy1): shear in local y (bending about z)
  k.set(1, 1, k_z1);
  k.set(1, 5, k_z2);
  k.set(1, 7, -k_z1);
  k.set(1, 11, k_z2);

  // Row 2 (uz1): shear in local z (bending about y)
  k.set(2, 2, k_y1);
  k.set(2, 4, -k_y2);
  k.set(2, 8, -k_y1);
  k.set(2, 10, -k_y2);

  // Row 3 (rx1): torsion
  k.set(3, 3, GJ_L);
  k.set(3, 9, -GJ_L);

  // Row 4 (ry1): bending about local y (weak axis)
  k.set(4, 2, -k_y2);
  k.set(4, 4, k_y3);
  k.set(4, 8, k_y2);
  k.set(4, 10, k_y4);

  // Row 5 (rz1): bending about local z (strong axis)
  k.set(5, 1, k_z2);
  k.set(5, 5, k_z3);
  k.set(5, 7, -k_z2);
  k.set(5, 11, k_z4);

  // Row 6 (ux2): axial
  k.set(6, 0, -EA_L);
  k.set(6, 6, EA_L);

  // Row 7 (uy2): shear in local y
  k.set(7, 1, -k_z1);
  k.set(7, 5, -k_z2);
  k.set(7, 7, k_z1);
  k.set(7, 11, -k_z2);

  // Row 8 (uz2): shear in local z
  k.set(8, 2, -k_y1);
  k.set(8, 4, k_y2);
  k.set(8, 8, k_y1);
  k.set(8, 10, k_y2);

  // Row 9 (rx2): torsion
  k.set(9, 3, -GJ_L);
  k.set(9, 9, GJ_L);

  // Row 10 (ry2): bending about local y
  k.set(10, 2, -k_y2);
  k.set(10, 4, k_y4);
  k.set(10, 8, k_y2);
  k.set(10, 10, k_y3);

  // Row 11 (rz2): bending about local z
  k.set(11, 1, k_z2);
  k.set(11, 5, k_z4);
  k.set(11, 7, -k_z2);
  k.set(11, 11, k_z3);

  return k;
}

/**
 * Compute the fixed-end forces for a uniformly distributed load
 * on a frame element in local coordinates.
 *
 * Returns a 12-element array of equivalent nodal forces in local coords.
 */
export function fixedEndForces(
  L: number,
  wx: number,
  wy: number,
  wz: number
): number[] {
  // Fixed-end reactions for uniform load on a fixed-fixed beam
  const f = new Array(12).fill(0);

  // Axial (wx along local x)
  f[0] = (wx * L) / 2;   // Node I
  f[6] = (wx * L) / 2;   // Node J

  // Transverse load wy (local y) -> bending about z
  f[1] = (wy * L) / 2;       // Shear at I
  f[5] = (wy * L * L) / 12;  // Moment at I
  f[7] = (wy * L) / 2;       // Shear at J
  f[11] = -(wy * L * L) / 12; // Moment at J

  // Transverse load wz (local z) -> bending about y
  f[2] = (wz * L) / 2;        // Shear at I
  f[4] = -(wz * L * L) / 12;  // Moment at I
  f[8] = (wz * L) / 2;        // Shear at J
  f[10] = (wz * L * L) / 12;  // Moment at J

  return f;
}

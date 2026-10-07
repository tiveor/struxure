import * as THREE from 'three';
import type { StructuralNode } from '../../core/types';
import { rotationMatrix3x3 } from '../../core/transformation';

/**
 * Orientation of a member mesh, taken from the same local axes the analysis
 * uses (including beta), so the drawn profile matches the bending axes.
 *
 * Member meshes are built along object Y with the section depth along object
 * Z and the flange width along object X (see ElementMesh: the extruded
 * profile is rotated 90 degrees about X). This maps
 *   object X -> local z (flange width, the strong bending axis)
 *   object Y -> local x (member axis)
 *   object Z -> local y (section depth)
 * The basis (z, x, y) is a cyclic permutation of the right-handed (x, y, z),
 * so it is a proper rotation.
 */
export function memberOrientation(
  nodeI: StructuralNode,
  nodeJ: StructuralNode,
  betaAngle: number,
): THREE.Quaternion {
  const R = rotationMatrix3x3(nodeI, nodeJ, betaAngle);
  const axis = (row: number) => new THREE.Vector3(R.get(row, 0), R.get(row, 1), R.get(row, 2));
  const basis = new THREE.Matrix4().makeBasis(axis(2), axis(0), axis(1));
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

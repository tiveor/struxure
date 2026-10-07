import { Matrix } from 'ml-matrix';
import type { StructuralNode } from './types';

/**
 * A member counts as parallel to global Y when the component of its unit
 * direction perpendicular to Y is below this value (about 0.00006 degrees).
 */
export const VERTICAL_TOLERANCE = 1e-6;

/**
 * Compute the 3x3 rotation matrix from local to global coordinates
 * for a 3D frame element.
 *
 * Local x-axis: along element from nodeI to nodeJ
 * Local y and z axes: perpendicular to x, determined by the element
 * orientation and the beta angle.
 *
 * @param nodeI Start node
 * @param nodeJ End node
 * @param betaAngle Rotation angle (degrees) about the local x-axis
 */
export function rotationMatrix3x3(
  nodeI: StructuralNode,
  nodeJ: StructuralNode,
  betaAngle: number
): Matrix {
  const dx = nodeJ.x - nodeI.x;
  const dy = nodeJ.y - nodeI.y;
  const dz = nodeJ.z - nodeI.z;
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (L < 1e-10) {
    throw new Error('Element has zero length');
  }

  // Local x-axis direction cosines
  const lx = dx / L;
  const mx = dy / L;
  const nx = dz / L;

  // Reference vector for defining the local y-z plane.
  // The default reference is global Y, which gives local z = x × Y. It only
  // degenerates when the member is parallel to Y, so the special case is a
  // true degeneracy check rather than a cone: a cone made members a few
  // degrees off vertical switch to a different local z, and therefore bend in
  // plane about a different section axis than their neighbours.
  const isVertical = Math.sqrt(lx * lx + nx * nx) < VERTICAL_TOLERANCE;

  let ly: number, my: number, ny: number;
  let lz: number, mz: number, nz: number;

  if (isVertical) {
    // Member parallel to global Y: take local z as global +Z, projected to be
    // exactly orthogonal to local x. This is the limit of x × Y as a member in
    // the XY plane tilts towards vertical from +X, so a column in an XY frame
    // bends in plane about its strong axis (Ix), like every other member.
    // z = Z - (x·Z) x, then normalize. Here |nx| < 1e-6, so its length is ~1.
    const zx = -nx * lx;
    const zy = -nx * mx;
    const zz = 1 - nx * nx;
    const zLen = Math.sqrt(zx * zx + zy * zy + zz * zz);
    lz = zx / zLen;
    mz = zy / zLen;
    nz = zz / zLen;

    // local y = cross(local_z, local_x)
    ly = mz * nx - nz * mx;
    my = nz * lx - lz * nx;
    ny = lz * mx - mz * lx;
  } else {
    // Normal case: use global Y as reference
    // local z = cross(local_x, global_Y) then normalize
    // global Y = (0, 1, 0)
    // cross(x, Y) = (mx*0 - nx*1, nx*0 - lx*0, lx*1 - mx*0) = (-nx, 0, lx)
    const tempLen = Math.sqrt(nx * nx + lx * lx);
    lz = -nx / tempLen;
    mz = 0;
    nz = lx / tempLen;

    // local y = cross(local_z, local_x)
    ly = mz * nx - nz * mx;
    my = nz * lx - lz * nx;
    ny = lz * mx - mz * lx;
  }

  // Apply beta angle rotation about local x-axis
  if (Math.abs(betaAngle) > 1e-10) {
    const beta = (betaAngle * Math.PI) / 180;
    const cb = Math.cos(beta);
    const sb = Math.sin(beta);

    // Rotate local y and z about local x
    const ly2 = ly * cb + lz * sb;
    const my2 = my * cb + mz * sb;
    const ny2 = ny * cb + nz * sb;

    const lz2 = -ly * sb + lz * cb;
    const mz2 = -my * sb + mz * cb;
    const nz2 = -ny * sb + nz * cb;

    ly = ly2; my = my2; ny = ny2;
    lz = lz2; mz = mz2; nz = nz2;
  }

  // 3x3 rotation matrix [R]
  // Each row is a local axis direction in global coordinates
  return new Matrix([
    [lx, mx, nx],
    [ly, my, ny],
    [lz, mz, nz],
  ]);
}

/**
 * Build the 12x12 transformation matrix from the 3x3 rotation matrix.
 *
 * [T] = | [R]  0    0    0  |
 *       |  0  [R]   0    0  |
 *       |  0   0   [R]   0  |
 *       |  0   0    0   [R] |
 */
export function transformationMatrix12x12(
  nodeI: StructuralNode,
  nodeJ: StructuralNode,
  betaAngle: number
): Matrix {
  const R = rotationMatrix3x3(nodeI, nodeJ, betaAngle);
  const T = Matrix.zeros(12, 12);

  // Place R in four 3x3 diagonal blocks
  for (let block = 0; block < 4; block++) {
    const offset = block * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        T.set(offset + i, offset + j, R.get(i, j));
      }
    }
  }

  return T;
}

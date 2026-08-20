import { Matrix } from 'ml-matrix';
import type { StructuralNode } from './types';

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

  // Reference vector for defining local y-z plane
  // If element is vertical (parallel to global Y), use global Z as reference
  const isVertical = Math.abs(mx) > 0.999;

  let ly: number, my: number, ny: number;
  let lz: number, mz: number, nz: number;

  if (isVertical) {
    // Element is vertical: use global Z as reference
    // local z = cross(local_x, global_Z) then normalize
    // global Z = (0, 0, 1)
    // cross(x, Z) = (mx*1 - nx*0, nx*0 - lx*1, lx*0 - mx*0) = (mx, -lx, 0)
    const tempLen = Math.sqrt(mx * mx + lx * lx);
    lz = mx / tempLen;
    mz = -lx / tempLen;
    nz = 0;

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

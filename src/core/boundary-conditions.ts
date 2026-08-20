import { Matrix } from 'ml-matrix';
import type { Support } from './types';
import { DOF_PER_NODE } from './types';

/**
 * Get the set of restrained (fixed) DOF indices from supports.
 */
export function getRestrainedDofs(
  supports: Support[],
  nodeIndexMap: Map<string, number>
): Set<number> {
  const restrained = new Set<number>();

  for (const support of supports) {
    const nodeIdx = nodeIndexMap.get(support.nodeId);
    if (nodeIdx === undefined) continue;

    const baseDof = nodeIdx * DOF_PER_NODE;
    const flags = [support.dx, support.dy, support.dz, support.rx, support.ry, support.rz];

    for (let d = 0; d < DOF_PER_NODE; d++) {
      if (flags[d]) {
        restrained.add(baseDof + d);
      }
    }
  }

  return restrained;
}

/**
 * Get the set of free (unrestrained) DOF indices.
 */
export function getFreeDofs(
  totalDof: number,
  restrainedDofs: Set<number>
): number[] {
  const free: number[] = [];
  for (let i = 0; i < totalDof; i++) {
    if (!restrainedDofs.has(i)) {
      free.push(i);
    }
  }
  return free;
}

/**
 * Apply boundary conditions by extracting the free DOF sub-system.
 *
 * Given global K and F, returns the reduced system for free DOFs only.
 */
export function applyBoundaryConditions(
  K: Matrix,
  F: Matrix,
  supports: Support[],
  nodeIndexMap: Map<string, number>,
  totalDof: number
): {
  K_ff: Matrix;
  F_f: Matrix;
  freeDofs: number[];
  restrainedDofs: Set<number>;
} {
  const restrainedDofs = getRestrainedDofs(supports, nodeIndexMap);
  const freeDofs = getFreeDofs(totalDof, restrainedDofs);

  const n = freeDofs.length;
  const K_ff = Matrix.zeros(n, n);
  const F_f = Matrix.zeros(n, 1);

  // Extract sub-system
  for (let i = 0; i < n; i++) {
    F_f.set(i, 0, F.get(freeDofs[i], 0));
    for (let j = 0; j < n; j++) {
      K_ff.set(i, j, K.get(freeDofs[i], freeDofs[j]));
    }
  }

  return { K_ff, F_f, freeDofs, restrainedDofs };
}

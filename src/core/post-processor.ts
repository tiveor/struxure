import { Matrix } from 'ml-matrix';
import type { StructuralModel, AnalysisResults } from './types';
import { DOF_PER_NODE } from './types';
import { elementDofIndices } from './assembler';
import { fixedEndForces } from './local-stiffness';

/**
 * Post-process analysis results: compute reactions and internal forces.
 */
export function postProcess(
  model: StructuralModel,
  displacements: number[],
  K_global: Matrix,
  nodeIndexMap: Map<string, number>,
  elementTransformations: Map<string, Matrix>,
  elementLocalStiffness: Map<string, Matrix>,
  _restrainedDofs: Set<number>
): AnalysisResults {
  const { nodes, elements, supports } = model;

  // Per-node displacements
  const nodeDisplacements = new Map<string, number[]>();
  for (const node of nodes) {
    const idx = nodeIndexMap.get(node.id)!;
    const baseDof = idx * DOF_PER_NODE;
    nodeDisplacements.set(node.id, displacements.slice(baseDof, baseDof + DOF_PER_NODE));
  }

  // Reactions at supports: R = K * u - F_applied (for restrained DOFs)
  const reactions = new Map<string, number[]>();
  const u_vec = Matrix.columnVector(displacements);
  const R_full = K_global.mmul(u_vec);

  for (const support of supports) {
    const nodeIdx = nodeIndexMap.get(support.nodeId)!;
    const baseDof = nodeIdx * DOF_PER_NODE;
    const r = [0, 0, 0, 0, 0, 0];
    const flags = [support.dx, support.dy, support.dz, support.rx, support.ry, support.rz];

    for (let d = 0; d < DOF_PER_NODE; d++) {
      if (flags[d]) {
        r[d] = R_full.get(baseDof + d, 0);
      }
    }
    reactions.set(support.nodeId, r);
  }

  // Subtract applied nodal loads from reactions
  for (const load of model.nodalLoads) {
    const r = reactions.get(load.nodeId);
    if (r) {
      const forces = [load.fx, load.fy, load.fz, load.mx, load.my, load.mz];
      for (let d = 0; d < DOF_PER_NODE; d++) {
        r[d] -= forces[d];
      }
    }
  }

  // Internal forces per element
  const elementForces = new Map<string, { startForces: number[]; endForces: number[] }>();

  for (const elem of elements) {
    const T = elementTransformations.get(elem.id)!;
    const Ke_local = elementLocalStiffness.get(elem.id)!;

    // Get element DOF indices
    const dofs = elementDofIndices(elem, nodeIndexMap);

    // Extract element displacements from global vector
    const u_elem_global = Matrix.zeros(12, 1);
    for (let i = 0; i < 12; i++) {
      u_elem_global.set(i, 0, displacements[dofs[i]]);
    }

    // Transform to local coordinates: u_local = T * u_global
    const u_elem_local = T.mmul(u_elem_global);

    // Internal forces: f_local = Ke_local * u_local
    const f_local = Ke_local.mmul(u_elem_local);

    // Extract forces at start and end
    const startForces: number[] = [];
    const endForces: number[] = [];
    for (let i = 0; i < 6; i++) {
      startForces.push(f_local.get(i, 0));
      endForces.push(f_local.get(i + 6, 0));
    }

    // Account for distributed loads (subtract fixed-end forces)
    const dLoads = model.distributedLoads.filter((dl) => dl.elementId === elem.id);
    if (dLoads.length > 0) {
      const nodeI = model.nodes.find((n) => n.id === elem.nodeI)!;
      const nodeJ = model.nodes.find((n) => n.id === elem.nodeJ)!;
      const dx = nodeJ.x - nodeI.x;
      const dy = nodeJ.y - nodeI.y;
      const dz = nodeJ.z - nodeI.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

      for (const dLoad of dLoads) {
        const fef = fixedEndForces(L, dLoad.wx, dLoad.wy, dLoad.wz);
        for (let i = 0; i < 6; i++) {
          startForces[i] -= fef[i];
          endForces[i] -= fef[i + 6];
        }
      }
    }

    elementForces.set(elem.id, { startForces, endForces });
  }

  return {
    displacements,
    reactions,
    elementForces,
    nodeDisplacements,
  };
}

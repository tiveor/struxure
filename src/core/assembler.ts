import { Matrix } from 'ml-matrix';
import type {
  StructuralModel,
  StructuralNode,
  FrameElement,
} from './types';
import { DOF_PER_NODE } from './types';
import { localStiffnessMatrix, fixedEndForces, elementLength } from './local-stiffness';
import { transformationMatrix12x12 } from './transformation';
import { addSubMatrix } from './matrix-utils';

/** Map from node ID to sequential index */
export function buildNodeIndexMap(nodes: StructuralNode[]): Map<string, number> {
  const map = new Map<string, number>();
  nodes.forEach((node, i) => map.set(node.id, i));
  return map;
}

/** Get global DOF indices for an element's two nodes */
export function elementDofIndices(
  element: FrameElement,
  nodeIndexMap: Map<string, number>
): number[] {
  const iIdx = nodeIndexMap.get(element.nodeI)!;
  const jIdx = nodeIndexMap.get(element.nodeJ)!;
  const dofs: number[] = [];

  // Node I DOFs
  for (let d = 0; d < DOF_PER_NODE; d++) {
    dofs.push(iIdx * DOF_PER_NODE + d);
  }
  // Node J DOFs
  for (let d = 0; d < DOF_PER_NODE; d++) {
    dofs.push(jIdx * DOF_PER_NODE + d);
  }

  return dofs;
}

/**
 * Assemble the global stiffness matrix and force vector.
 *
 * Returns:
 * - K: global stiffness matrix (N x N)
 * - F: global force vector (N x 1)
 * - nodeIndexMap: mapping from node ID to index
 * - elementTransformations: T matrix per element (for post-processing)
 * - elementLocalStiffness: local K per element (for post-processing)
 */
export function assembleGlobalSystem(model: StructuralModel) {
  const { nodes, elements, materials, sections, nodalLoads, distributedLoads } = model;

  const nodeIndexMap = buildNodeIndexMap(nodes);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  const totalDof = nodes.length * DOF_PER_NODE;
  const K = Matrix.zeros(totalDof, totalDof);
  const F = Matrix.zeros(totalDof, 1);

  // Storage for post-processing
  const elementTransformations = new Map<string, Matrix>();
  const elementLocalStiffness = new Map<string, Matrix>();

  // Assemble element contributions
  for (const elem of elements) {
    const nodeI = nodeMap.get(elem.nodeI)!;
    const nodeJ = nodeMap.get(elem.nodeJ)!;
    const material = materialMap.get(elem.materialId)!;
    const section = sectionMap.get(elem.sectionId)!;

    // Local stiffness matrix (12x12)
    const Ke_local = localStiffnessMatrix(elem, material, section, nodeI, nodeJ);
    elementLocalStiffness.set(elem.id, Ke_local);

    // Transformation matrix (12x12)
    const T = transformationMatrix12x12(nodeI, nodeJ, elem.betaAngle);
    elementTransformations.set(elem.id, T);

    // Transform to global: Ke_global = Tᵀ · Ke_local · T
    const Ke_global = T.transpose().mmul(Ke_local).mmul(T);

    // Get global DOF indices for this element
    const dofs = elementDofIndices(elem, nodeIndexMap);

    // Add to global stiffness matrix
    addSubMatrix(K, Ke_global, dofs, dofs);
  }

  // Apply nodal loads
  for (const load of nodalLoads) {
    const nodeIdx = nodeIndexMap.get(load.nodeId)!;
    const baseDof = nodeIdx * DOF_PER_NODE;
    const forces = [load.fx, load.fy, load.fz, load.mx, load.my, load.mz];
    for (let d = 0; d < DOF_PER_NODE; d++) {
      F.set(baseDof + d, 0, F.get(baseDof + d, 0) + forces[d]);
    }
  }

  // Apply distributed loads (convert to equivalent nodal loads)
  for (const dLoad of distributedLoads) {
    const elem = elements.find((e) => e.id === dLoad.elementId)!;
    const nodeI = nodeMap.get(elem.nodeI)!;
    const nodeJ = nodeMap.get(elem.nodeJ)!;
    const L = elementLength(nodeI, nodeJ);

    // Fixed-end forces in local coordinates
    const fef_local = fixedEndForces(L, dLoad.wx, dLoad.wy, dLoad.wz);

    // Transform to global coordinates
    const T = elementTransformations.get(elem.id)!;
    const fef_local_vec = Matrix.columnVector(fef_local);
    const fef_global_vec = T.transpose().mmul(fef_local_vec);

    // Add to global force vector
    const dofs = elementDofIndices(elem, nodeIndexMap);
    for (let i = 0; i < 12; i++) {
      F.set(dofs[i], 0, F.get(dofs[i], 0) + fef_global_vec.get(i, 0));
    }
  }

  return {
    K,
    F,
    nodeIndexMap,
    elementTransformations,
    elementLocalStiffness,
    totalDof,
  };
}

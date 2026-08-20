import { Matrix, inverse } from 'ml-matrix';
import type { StructuralModel, AnalysisResults } from './types';
import { assembleGlobalSystem } from './assembler';
import { applyBoundaryConditions } from './boundary-conditions';
import { postProcess } from './post-processor';

/**
 * Run a full static linear analysis on the structural model.
 *
 * Pipeline:
 * 1. Assemble global stiffness matrix and force vector
 * 2. Apply boundary conditions
 * 3. Solve K_ff · u_f = F_f for free DOF displacements
 * 4. Expand to full displacement vector
 * 5. Post-process: reactions and internal forces
 */
export function solveModel(model: StructuralModel): AnalysisResults {
  // Validate model
  if (model.nodes.length === 0) throw new Error('Model has no nodes');
  if (model.elements.length === 0) throw new Error('Model has no elements');
  if (model.supports.length === 0) throw new Error('Model has no supports');

  // Step 1: Assemble
  const {
    K,
    F,
    nodeIndexMap,
    elementTransformations,
    elementLocalStiffness,
    totalDof,
  } = assembleGlobalSystem(model);

  // Step 2: Apply boundary conditions
  const { K_ff, F_f, freeDofs, restrainedDofs } = applyBoundaryConditions(
    K,
    F,
    model.supports,
    nodeIndexMap,
    totalDof
  );

  // Step 3: Solve for free DOF displacements
  if (freeDofs.length === 0) {
    throw new Error('All DOFs are restrained — no solution needed');
  }

  const u_f = inverse(K_ff).mmul(F_f);

  // Step 4: Expand to full displacement vector
  const u_full = Matrix.zeros(totalDof, 1);
  for (let i = 0; i < freeDofs.length; i++) {
    u_full.set(freeDofs[i], 0, u_f.get(i, 0));
  }

  // Convert to plain array
  const displacements: number[] = [];
  for (let i = 0; i < totalDof; i++) {
    displacements.push(u_full.get(i, 0));
  }

  // Step 5: Post-process
  return postProcess(
    model,
    displacements,
    K,
    nodeIndexMap,
    elementTransformations,
    elementLocalStiffness,
    restrainedDofs
  );
}

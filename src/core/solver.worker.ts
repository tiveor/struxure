/**
 * Web Worker for structural analysis solver.
 * Runs the full solve pipeline off the main thread.
 */
import { Matrix, inverse } from 'ml-matrix';
import type { StructuralModel, AnalysisResults } from './types';
import { assembleGlobalSystem } from './assembler';
import { applyBoundaryConditions } from './boundary-conditions';
import { postProcess } from './post-processor';

export type WorkerMessage =
  | { type: 'solve'; model: StructuralModel }
  | { type: 'cancel' };

/** `AnalysisResults` with its Maps flattened to plain objects for structured cloning. */
export type SerializedAnalysisResults =
  Omit<AnalysisResults, 'reactions' | 'elementForces' | 'nodeDisplacements'> & {
    reactions: Record<string, number[]>;
    elementForces: Record<string, { startForces: number[]; endForces: number[] }>;
    nodeDisplacements: Record<string, number[]>;
  };

export type WorkerResponse =
  | { type: 'progress'; step: string; progress: number }
  | { type: 'result'; results: SerializedAnalysisResults }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  if (msg.type === 'solve') {
    try {
      solvePipeline(msg.model);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown solver error';
      self.postMessage({ type: 'error', message } satisfies WorkerResponse);
    }
  }
};

function solvePipeline(model: StructuralModel) {
  // Validate
  if (model.nodes.length === 0) throw new Error('Model has no nodes');
  if (model.elements.length === 0) throw new Error('Model has no elements');
  if (model.supports.length === 0) throw new Error('Model has no supports');

  // Step 1: Assembly
  self.postMessage({ type: 'progress', step: 'assembly', progress: 0.2 } satisfies WorkerResponse);
  const { K, F, nodeIndexMap, elementTransformations, elementLocalStiffness, totalDof } =
    assembleGlobalSystem(model);

  // Step 2: Boundary conditions
  self.postMessage({ type: 'progress', step: 'boundaries', progress: 0.4 } satisfies WorkerResponse);
  const { K_ff, F_f, freeDofs, restrainedDofs } = applyBoundaryConditions(
    K, F, model.supports, nodeIndexMap, totalDof,
  );

  if (freeDofs.length === 0) {
    throw new Error('All DOFs are restrained — no solution needed');
  }

  // Step 3: Solve
  self.postMessage({ type: 'progress', step: 'solving', progress: 0.6 } satisfies WorkerResponse);
  const u_f = inverse(K_ff).mmul(F_f);

  // Step 4: Expand displacements
  const u_full = Matrix.zeros(totalDof, 1);
  for (let i = 0; i < freeDofs.length; i++) {
    u_full.set(freeDofs[i], 0, u_f.get(i, 0));
  }
  const displacements: number[] = [];
  for (let i = 0; i < totalDof; i++) {
    displacements.push(u_full.get(i, 0));
  }

  // Step 5: Post-process
  self.postMessage({ type: 'progress', step: 'postprocess', progress: 0.8 } satisfies WorkerResponse);
  const results = postProcess(
    model, displacements, K, nodeIndexMap,
    elementTransformations, elementLocalStiffness, restrainedDofs,
  );

  // Serialize Map objects for structured cloning
  const serializedResults = {
    ...results,
    reactions: Object.fromEntries(results.reactions),
    elementForces: Object.fromEntries(results.elementForces),
    nodeDisplacements: Object.fromEntries(results.nodeDisplacements),
  };

  self.postMessage({ type: 'progress', step: 'complete', progress: 1.0 } satisfies WorkerResponse);
  self.postMessage({ type: 'result', results: serializedResults } satisfies WorkerResponse);
}

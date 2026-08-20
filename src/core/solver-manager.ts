/**
 * Manager for the solver Web Worker.
 * Provides a promise-based API with progress callbacks and cancellation.
 */
import type { StructuralModel, AnalysisResults } from './types';
import type { WorkerResponse } from './solver.worker';

export type SolverStep = 'assembly' | 'boundaries' | 'solving' | 'postprocess' | 'complete';

export interface SolverProgress {
  step: SolverStep;
  progress: number;
}

export class SolverManager {
  private worker: Worker | null = null;
  onProgress?: (step: SolverStep, progress: number) => void;

  solve(model: StructuralModel): Promise<AnalysisResults> {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(
        new URL('./solver.worker.ts', import.meta.url),
        { type: 'module' },
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;

        if (data.type === 'progress') {
          this.onProgress?.(data.step as SolverStep, data.progress);
        } else if (data.type === 'result') {
          // Deserialize Maps from plain objects
          const results: AnalysisResults = {
            ...data.results,
            reactions: new Map(Object.entries(data.results.reactions)),
            elementForces: new Map(Object.entries(data.results.elementForces)),
            nodeDisplacements: new Map(Object.entries(data.results.nodeDisplacements)),
          };
          resolve(results);
          this.cleanup();
        } else if (data.type === 'error') {
          reject(new Error(data.message));
          this.cleanup();
        }
      };

      this.worker.onerror = (error) => {
        reject(new Error(error.message || 'Worker error'));
        this.cleanup();
      };

      this.worker.postMessage({ type: 'solve', model });
    });
  }

  cancel() {
    if (this.worker) {
      this.worker.terminate();
      this.cleanup();
    }
  }

  private cleanup() {
    this.worker = null;
  }
}

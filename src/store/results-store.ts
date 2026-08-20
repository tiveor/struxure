import { create } from 'zustand';
import type { AnalysisResults } from '../core/types';
import type { SolverStep } from '../core/solver-manager';

export interface DesignResult {
  elementId: string;
  material: 'steel' | 'concrete';
  ratio: number; // D/C ratio
  status: 'pass' | 'fail';
  details: Record<string, number>;
}

interface ResultsState {
  analysisResults: AnalysisResults | null;
  designResults: DesignResult[];
  isAnalyzed: boolean;
  isDesigned: boolean;
  analysisError: string | null;

  // Solver progress
  isSolving: boolean;
  solverStep: SolverStep | null;
  solverProgress: number;

  setAnalysisResults: (results: AnalysisResults) => void;
  setDesignResults: (results: DesignResult[]) => void;
  setAnalysisError: (error: string) => void;
  setSolving: (solving: boolean) => void;
  setSolverProgress: (step: SolverStep, progress: number) => void;
  clearResults: () => void;
}

export const useResultsStore = create<ResultsState>((set) => ({
  analysisResults: null,
  designResults: [],
  isAnalyzed: false,
  isDesigned: false,
  analysisError: null,

  isSolving: false,
  solverStep: null,
  solverProgress: 0,

  setAnalysisResults: (results) =>
    set({ analysisResults: results, isAnalyzed: true, analysisError: null, isSolving: false }),

  setDesignResults: (results) =>
    set({ designResults: results, isDesigned: true }),

  setAnalysisError: (error) =>
    set({ analysisError: error, isAnalyzed: false, isSolving: false }),

  setSolving: (solving) =>
    set({ isSolving: solving, solverProgress: 0, solverStep: null }),

  setSolverProgress: (step, progress) =>
    set({ solverStep: step, solverProgress: progress }),

  clearResults: () =>
    set({
      analysisResults: null,
      designResults: [],
      isAnalyzed: false,
      isDesigned: false,
      analysisError: null,
      isSolving: false,
      solverStep: null,
      solverProgress: 0,
    }),
}));

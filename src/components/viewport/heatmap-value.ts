import type { AnalysisResults } from '../../core/types';
import type { DesignCheckResult } from '../../design/types';

/** Compute heatmap value for an element based on the selected variable */
export function getElementHeatmapValue(
  elementId: string,
  variable: string,
  analysisResults: AnalysisResults | null,
  designResults: readonly DesignCheckResult[],
  nodeI: string,
  nodeJ: string,
  sectionA: number,
  sectionSx: number,
): number | null {
  if (!analysisResults) return null;

  switch (variable) {
    case 'dc_ratio': {
      const dr = designResults.find((r) => r.elementId === elementId);
      return dr ? dr.ratio : null;
    }
    case 'displacement': {
      const dispI = analysisResults.nodeDisplacements.get(nodeI);
      const dispJ = analysisResults.nodeDisplacements.get(nodeJ);
      if (!dispI || !dispJ) return null;
      const magI = Math.sqrt(dispI[0] ** 2 + dispI[1] ** 2 + dispI[2] ** 2);
      const magJ = Math.sqrt(dispJ[0] ** 2 + dispJ[1] ** 2 + dispJ[2] ** 2);
      return (magI + magJ) / 2;
    }
    case 'axial_stress': {
      const forces = analysisResults.elementForces.get(elementId);
      if (!forces || sectionA === 0) return null;
      const N = Math.abs(forces.startForces[0]);
      return N / sectionA;
    }
    case 'combined_stress': {
      const forces = analysisResults.elementForces.get(elementId);
      if (!forces || sectionA === 0) return null;
      const N = Math.abs(forces.startForces[0]);
      // Local z is the strong axis (Ix in the stiffness matrix), so M3 is index 5.
      const M = Math.abs(forces.startForces[5]);
      const axial = N / sectionA;
      const bending = sectionSx > 0 ? M / sectionSx : 0;
      return axial + bending;
    }
    default:
      return null;
  }
}

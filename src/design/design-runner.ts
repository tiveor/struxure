import type { StructuralModel, AnalysisResults } from '../core/types';
import type { DesignCheckResult } from './types';
import { designSteelElement } from './aisc360';
import { designConcreteElement } from './aci318';
import { elementLength } from '../core/local-stiffness';

/**
 * Run design checks on all elements based on their material type.
 */
export function runDesign(
  model: StructuralModel,
  results: AnalysisResults
): DesignCheckResult[] {
  const designResults: DesignCheckResult[] = [];
  const nodeMap = new Map(model.nodes.map((n) => [n.id, n]));
  const materialMap = new Map(model.materials.map((m) => [m.id, m]));
  const sectionMap = new Map(model.sections.map((s) => [s.id, s]));

  for (const elem of model.elements) {
    const material = materialMap.get(elem.materialId);
    const section = sectionMap.get(elem.sectionId);
    const forces = results.elementForces.get(elem.id);
    const nodeI = nodeMap.get(elem.nodeI);
    const nodeJ = nodeMap.get(elem.nodeJ);

    if (!material || !section || !forces || !nodeI || !nodeJ) continue;

    const L = elementLength(nodeI, nodeJ);

    // Get maximum forces from both ends
    const maxAxial = Math.max(
      Math.abs(forces.startForces[0]),
      Math.abs(forces.endForces[0])
    );
    const axialSign = forces.startForces[0]; // Positive = tension in convention

    const maxShear = Math.max(
      Math.abs(forces.startForces[1]),
      Math.abs(forces.endForces[1])
    );

    const maxMoment = Math.max(
      Math.abs(forces.startForces[5]),
      Math.abs(forces.endForces[5])
    );

    if (material.type === 'steel') {
      const result = designSteelElement(
        elem.id,
        axialSign, // Positive = tension
        maxMoment,
        material,
        section,
        L
      );
      designResults.push(result);
    } else if (material.type === 'concrete') {
      const result = designConcreteElement(
        elem.id,
        maxAxial,
        maxShear,
        maxMoment,
        material,
        section
      );
      designResults.push(result);
    }
  }

  return designResults;
}

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

    // Element end forces are the forces each node exerts on the element, in
    // local axes. The internal axial force (positive = tension) is therefore
    // -startForces[0] at node I and +endForces[0] at node J; a compressed
    // member has startForces[0] > 0 and endForces[0] < 0. An axial member load
    // (wx) makes the axial force vary linearly along the member, so its
    // extremes are at the ends and one end can be in tension while the other
    // is in compression. Both are checked.
    const axialI = -forces.startForces[0];
    const axialJ = forces.endForces[0];
    const maxTension = Math.max(0, axialI, axialJ);
    const maxCompression = Math.max(0, -axialI, -axialJ);

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
        maxTension,
        maxCompression,
        maxMoment,
        material,
        section,
        L
      );
      designResults.push(result);
    } else if (material.type === 'concrete') {
      // Statically consistent (P, Mz, My) pairs at each end for the
      // reinforced column check. The element end forces are the forces the
      // nodes exert on the element in local axes, so a compressed member has
      // startForces[0] > 0 and endForces[0] < 0.
      const columnDemands = [
        { P: forces.startForces[0], Mx: forces.startForces[5], My: forces.startForces[4] },
        { P: -forces.endForces[0], Mx: forces.endForces[5], My: forces.endForces[4] },
      ];
      const result = designConcreteElement(
        elem.id,
        maxAxial,
        maxShear,
        maxMoment,
        material,
        section,
        columnDemands
      );
      designResults.push(result);
    }
  }

  return designResults;
}

import type { Material, Section } from '../../core/types';
import type { SteelDesignResult } from '../types';
import { checkTension } from './tension';
import { checkCompression } from './compression';
import { checkFlexure } from './flexure';
import { checkCombined } from './combined';

/**
 * Full AISC 360 design check for a steel element.
 *
 * @param elementId Element ID
 * @param axialForce Axial force (positive = tension, negative = compression)
 * @param momentZ Moment about local Z (strong axis) at critical section
 * @param material Steel material
 * @param section Section properties
 * @param L Element length (unbraced length)
 */
export function designSteelElement(
  elementId: string,
  axialForce: number,
  momentZ: number,
  material: Material,
  section: Section,
  L: number
): SteelDesignResult {
  // Tension check
  const tensionRatio = checkTension(axialForce, material, section);

  // Compression check
  const compressionRatio = checkCompression(-axialForce, material, section, L, L);

  // Flexure check
  const flexureRatio = checkFlexure(momentZ, material, section, L);

  // Axial ratio for combined check (governing of tension or compression)
  const axialRatio = Math.max(tensionRatio, compressionRatio);

  // Combined interaction check
  const combinedRatio = checkCombined(axialRatio, flexureRatio);

  const governingRatio = Math.max(tensionRatio, compressionRatio, flexureRatio, combinedRatio);

  return {
    elementId,
    material: 'steel',
    ratio: governingRatio,
    status: governingRatio <= 1.0 ? 'pass' : 'fail',
    details: {
      tensionRatio,
      compressionRatio,
      flexureRatio,
      combinedRatio,
      governingCheck: governingRatio,
    },
  };
}

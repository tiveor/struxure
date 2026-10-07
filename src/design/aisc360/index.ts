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
 * @param tensionForce Governing axial tension along the member (kips, >= 0)
 * @param compressionForce Governing axial compression along the member (kips, >= 0)
 * @param momentZ Moment about local Z (strong axis) at critical section
 * @param material Steel material
 * @param section Section properties
 * @param L Element length (unbraced length)
 */
export function designSteelElement(
  elementId: string,
  tensionForce: number,
  compressionForce: number,
  momentZ: number,
  material: Material,
  section: Section,
  L: number
): SteelDesignResult {
  // Tension check
  const { ratio: tensionRatio } = checkTension(tensionForce, material, section);

  // Compression check
  const { ratio: compressionRatio } = checkCompression(compressionForce, material, section, L, L);

  // Flexure check
  const { ratio: flexureRatio } = checkFlexure(momentZ, material, section, L);

  // Axial ratio for the combined check: the governing one of tension and
  // compression, each taken against its own capacity.
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

import type { Material, Section } from '../../core/types';
import type { ConcreteDesignResult } from '../types';
import { checkFlexure } from './flexure';
import { checkShear } from './shear';
import {
  checkColumn,
  checkReinforcedColumn,
  ASSUMED_COLUMN_RHO,
  COLUMN_INDICATIVE_REASON,
  type ColumnDemand,
} from './columns';
import { hasValidReinforcement } from './rebar';

/**
 * Full ACI 318 design check for a concrete element.
 *
 * If axial load is significant (P > 0.1*f'c*Ag), treated as a column.
 * Otherwise, treated as a beam (flexure + shear).
 *
 * A column whose section defines its reinforcement is checked against its
 * strain-compatibility P-M diagram. Without reinforcement the column check
 * is the indicative screening estimate of checkColumn.
 *
 * @param columnDemands per-end (P, Mx, My) pairs, P + compression. Used only
 *   by the reinforced column check; when omitted it checks
 *   (axialForce as compression, moment, 0).
 */
export function designConcreteElement(
  elementId: string,
  axialForce: number,
  shearForce: number,
  moment: number,
  material: Material,
  section: Section,
  columnDemands?: readonly ColumnDemand[]
): ConcreteDesignResult {
  const fc = material.fc || 4;
  const b = section.b || section.bf || 12;
  const h = section.h || section.d || 24;
  const Ag = b * h;

  // Check if this is a column (significant axial load)
  const isColumn = Math.abs(axialForce) > 0.1 * fc * Ag;

  if (isColumn && hasValidReinforcement(section)) {
    const demands = columnDemands ?? [{ P: Math.abs(axialForce), Mx: Math.abs(moment), My: 0 }];
    const col = checkReinforcedColumn(demands, material, section);
    return {
      elementId,
      material: 'concrete',
      ratio: col.ratio,
      status: col.ratio <= 1.0 ? 'pass' : 'fail',
      details: {
        flexureRatio: col.ratio,
        shearRatio: 0,
        AvRequired: 0,
        AsProvided: col.AsProvided,
        rhoProvided: col.rhoProvided,
      },
    };
  }

  if (isColumn) {
    const { ratio: columnRatio } = checkColumn(
      Math.abs(axialForce),
      Math.abs(moment),
      material,
      section
    );
    return {
      elementId,
      material: 'concrete',
      ratio: columnRatio,
      status: columnRatio <= 1.0 ? 'pass' : 'fail',
      details: {
        flexureRatio: columnRatio,
        shearRatio: 0,
        AvRequired: 0,
        // The steel is an assumption of checkColumn, not a computed
        // requirement, so it is reported as such and AsRequired is omitted.
        rhoAssumed: ASSUMED_COLUMN_RHO,
      },
      indicative: { reason: COLUMN_INDICATIVE_REASON },
    };
  }

  // Beam design
  const flexureResult = checkFlexure(moment, material, section);
  const shearResult = checkShear(shearForce, material, section);

  const governingRatio = Math.max(flexureResult.ratio, shearResult.ratio);

  return {
    elementId,
    material: 'concrete',
    ratio: governingRatio,
    status: governingRatio <= 1.0 ? 'pass' : 'fail',
    details: {
      flexureRatio: flexureResult.ratio,
      shearRatio: shearResult.ratio,
      AsRequired: flexureResult.AsRequired,
      AvRequired: shearResult.AvRequired,
    },
  };
}

import { formatQuantity, unitLabel } from '../../utils/units';
import type { QuantityType, UnitSystem } from '../../utils/units';

export type DiagramComponent = 'N' | 'V2' | 'M3';

/** Axial force and shear are forces; M3 is a moment. */
export function diagramQuantity(component: DiagramComponent): QuantityType {
  return component === 'M3' ? 'moment' : 'force';
}

/** Peak label text in display units, e.g. "-12.5 kN-m". */
export function formatDiagramPeak(value: number, component: DiagramComponent, unitSystem: UnitSystem): string {
  const qty = diagramQuantity(component);
  return `${formatQuantity(value, qty, unitSystem, 1)} ${unitLabel(qty, unitSystem)}`;
}

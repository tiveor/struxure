import type { ColumnReinforcement } from '../core/types';
import { totalBars } from '../design/aci318/rebar';

/**
 * Section properties of a solid b x h rectangle, with h the depth for
 * strong-axis bending (Ix). J uses the solid-rectangle approximation
 * J = a*t^3*(1/3 - 0.21*(t/a)*(1 - t^4/(12*a^4))), a the long side and t the
 * short side (Roark's Formulas for Stress and Strain, torsion of a solid
 * rectangular section).
 */
export function rectangleProperties(b: number, h: number) {
  const a = Math.max(b, h);
  const t = Math.min(b, h);
  return {
    A: b * h,
    Ix: (b * h ** 3) / 12,
    Iy: (h * b ** 3) / 12,
    J: a * t ** 3 * (1 / 3 - 0.21 * (t / a) * (1 - t ** 4 / (12 * a ** 4))),
  };
}

/** Short description of a reinforcement layout, e.g. "8 #8, #3 ties". */
export function describeReinforcement(r: ColumnReinforcement): string {
  return `${totalBars(r)} #${r.barSize}, #${r.tieSize} ties`;
}

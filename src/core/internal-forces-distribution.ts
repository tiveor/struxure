/**
 * Compute internal forces at stations along a frame element.
 * Uses equilibrium from end-i forces + distributed load effects.
 */

export interface InternalForcesAtPoint {
  /** Parametric position along element (0 to L) */
  x: number;
  /** Axial force */
  N: number;
  /** Shear in local 2 direction */
  V2: number;
  /** Moment about local 3 axis */
  M3: number;
}

export interface ElementEndForces {
  /** Axial at node i (positive = tension) */
  Ni: number;
  /** Shear at node i in local 2 */
  V2i: number;
  /** Moment at node i about local 3 */
  M3i: number;
}

/**
 * Compute internal force distribution along an element.
 *
 * From equilibrium at section x from end i:
 *   N(x)  = Ni                          (constant, no axial dist load)
 *   V2(x) = V2i - wy * x
 *   M3(x) = M3i + V2i * x - wy * x² / 2
 *
 * @param L - Element length
 * @param endForces - Forces at start (node i) in local coords
 * @param wy - Distributed load in local y (0 if none)
 * @param numPoints - Number of stations (returns numPoints + 1 values)
 */
export function getInternalForcesDistribution(
  L: number,
  endForces: ElementEndForces,
  wy: number = 0,
  numPoints: number = 20,
): InternalForcesAtPoint[] {
  const points: InternalForcesAtPoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * L;

    const N = endForces.Ni;
    const V2 = endForces.V2i - wy * x;
    const M3 = endForces.M3i + endForces.V2i * x - (wy * x * x) / 2;

    points.push({ x, N, V2, M3 });
  }

  return points;
}

/**
 * Find the maximum absolute value along the distribution for a given force component.
 */
export function getMaxAbsValue(
  points: InternalForcesAtPoint[],
  component: 'N' | 'V2' | 'M3',
): number {
  return Math.max(...points.map((p) => Math.abs(p[component])));
}

/** Animation utility functions for deformed shape visualization */

export type AnimationMode = 'oscillate' | 'pulse' | 'progressive';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute interpolation factor for oscillate mode.
 * Maps time to a smooth 0→1→0 cycle using sine.
 * @param time - elapsed time in seconds
 * @param speed - frequency multiplier
 * @returns value between 0 and 1
 */
export function computeInterpolation(time: number, speed: number): number {
  return (Math.sin(time * speed) + 1) / 2;
}

/**
 * Get animation factor based on mode.
 * @returns value between 0 and 1
 */
export function getAnimationFactor(mode: AnimationMode, time: number, speed: number): number {
  switch (mode) {
    case 'oscillate':
      return computeInterpolation(time, speed);

    case 'pulse': {
      // Full cycle in 2π/speed seconds, eases up then down
      const phase = (time * speed) % (2 * Math.PI);
      return Math.max(0, Math.sin(phase));
    }

    case 'progressive': {
      // Goes from 0 to 1 and clamps
      const t = time * speed;
      return Math.min(1, t / Math.PI);
    }
  }
}

/**
 * Interpolate a position between original and deformed.
 * @param original - original node position
 * @param displacement - computed displacement vector
 * @param scale - deformation scale factor
 * @param t - interpolation factor (0 = original, 1 = fully deformed)
 */
export function interpolatePosition(
  original: Vec3,
  displacement: Vec3,
  scale: number,
  t: number,
): Vec3 {
  return {
    x: original.x + displacement.x * scale * t,
    y: original.y + displacement.y * scale * t,
    z: original.z + displacement.z * scale * t,
  };
}

/**
 * Compute color for an element based on its deformation magnitude.
 * Lerps between green (no deformation) and red (max deformation).
 * @param currentDisp - current displacement magnitude
 * @param minDisp - minimum displacement in model
 * @param maxDisp - maximum displacement in model
 * @returns RGB color as {r, g, b} with values 0-1
 */
export function getDeformationColor(
  currentDisp: number,
  minDisp: number,
  maxDisp: number,
): { r: number; g: number; b: number } {
  if (maxDisp === minDisp) return { r: 0, g: 1, b: 0 };
  const ratio = Math.max(0, Math.min(1, (currentDisp - minDisp) / (maxDisp - minDisp)));
  return {
    r: ratio,
    g: 1 - ratio,
    b: 0,
  };
}

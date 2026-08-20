/**
 * Convert IFC profile geometry definitions to Struxure Section properties.
 * Handles IfcIShapeProfileDef, IfcRectangleHollowProfileDef,
 * IfcCircleHollowProfileDef, and IfcRectangleProfileDef.
 */
import type { Section } from '../core/types';

export type IfcLengthUnit = 'MILLIMETRE' | 'CENTIMETRE' | 'METRE' | 'INCH' | 'FOOT';

/** Conversion factors from IFC unit → inches (Struxure internal unit). */
const TO_INCHES: Record<string, number> = {
  MILLIMETRE: 1 / 25.4,
  CENTIMETRE: 1 / 2.54,
  METRE: 39.3701,
  INCH: 1,
  FOOT: 12,
};

/** Get the conversion factor from an IFC length unit to inches. */
export function getIfcUnitFactor(unit: string | undefined | null): number {
  if (!unit) return TO_INCHES['MILLIMETRE']; // IFC default is mm
  return TO_INCHES[unit.toUpperCase()] ?? TO_INCHES['MILLIMETRE'];
}

// ─── Section property calculators ────────────────────────────────────

/** Calculate section properties for an I-shape from geometric dimensions (in inches). */
export function calculateIShapeProperties(d: number, bf: number, tf: number, tw: number) {
  // Area = 2 flanges + web
  const A = 2 * bf * tf + (d - 2 * tf) * tw;
  // Strong-axis moment of inertia (I-shape approximation)
  const hw = d - 2 * tf;
  const Ix = (tw * hw ** 3) / 12 + 2 * (bf * tf ** 3 / 12 + bf * tf * ((d - tf) / 2) ** 2);
  // Weak-axis moment of inertia
  const Iy = (2 * tf * bf ** 3 + hw * tw ** 3) / 12;
  // Section moduli
  const Sx = Ix / (d / 2);
  const Sy = Iy / (bf / 2);
  // Plastic section moduli (approximate)
  const Zx = bf * tf * (d - tf) + tw * hw ** 2 / 4;
  const Zy = bf ** 2 * tf / 2 + tw ** 2 * hw / 4;
  // Radii of gyration
  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);
  // Torsional constant (approximate for open section)
  const J = (2 * bf * tf ** 3 + hw * tw ** 3) / 3;

  return { A, Ix, Iy, Sx, Sy, Zx, Zy, rx, ry, J };
}

/** Calculate section properties for a rectangular hollow section (HSS) in inches. */
export function calculateHSSProperties(B: number, H: number, t: number) {
  // Outer and inner dimensions
  const Bi = B - 2 * t;
  const Hi = H - 2 * t;
  const A = B * H - Bi * Hi;
  const Ix = (B * H ** 3 - Bi * Hi ** 3) / 12;
  const Iy = (H * B ** 3 - Hi * Bi ** 3) / 12;
  const Sx = Ix / (H / 2);
  const Sy = Iy / (B / 2);
  const Zx = B * H ** 2 / 4 - Bi * Hi ** 2 / 4;
  const Zy = H * B ** 2 / 4 - Hi * Bi ** 2 / 4;
  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);
  // Torsional constant (Bredt's formula for thin-walled closed section)
  const Am = (B - t) * (H - t); // Enclosed area at midline
  const perimeter = 2 * ((B - t) + (H - t));
  const J = (4 * Am ** 2 * t) / perimeter;

  return { A, Ix, Iy, Sx, Sy, Zx, Zy, rx, ry, J };
}

/** Calculate section properties for a circular hollow section (Pipe) in inches. */
export function calculatePipeProperties(outerDiameter: number, wallThickness: number) {
  const D = outerDiameter;
  const t = wallThickness;
  const Di = D - 2 * t;
  const A = Math.PI * (D ** 2 - Di ** 2) / 4;
  const I = Math.PI * (D ** 4 - Di ** 4) / 64;
  const Ix = I;
  const Iy = I;
  const S = I / (D / 2);
  const Sx = S;
  const Sy = S;
  // Plastic section modulus
  const Z = (D ** 3 - Di ** 3) / 6;
  const Zx = Z;
  const Zy = Z;
  const rx = Math.sqrt(Ix / A);
  const ry = rx;
  // Torsional constant (exact for circular)
  const J = Math.PI * (D ** 4 - Di ** 4) / 32; // = 2 * I

  return { A, Ix, Iy, Sx, Sy, Zx, Zy, rx, ry, J };
}

// ─── IFC profile → Section converter ─────────────────────────────────

export interface IfcProfileData {
  type: string;
  name?: string;
  // I-shape
  OverallDepth?: number;
  OverallWidth?: number;
  WebThickness?: number;
  FlangeThickness?: number;
  // Rectangle hollow (HSS)
  XDim?: number;
  YDim?: number;
  WallThickness?: number;
  // Circle hollow (Pipe)
  Radius?: number;
  // Rectangle solid
  // uses XDim, YDim
}

/**
 * Convert an IFC profile definition to a Struxure Section.
 * Dimensions in the profile are expected to be in the given IFC unit.
 */
export function ifcProfileToSection(profile: IfcProfileData, unit: string, index: number = 0): Section {
  const f = getIfcUnitFactor(unit);
  const profileType = profile.type?.toUpperCase() ?? '';
  const baseName = profile.name || `IFC-${index + 1}`;

  if (profileType.includes('ISHAPE') || profileType.includes('ASYMMETRICISHAPE')) {
    const d = (profile.OverallDepth ?? 0) * f;
    const bf = (profile.OverallWidth ?? 0) * f;
    const tf = (profile.FlangeThickness ?? 0) * f;
    const tw = (profile.WebThickness ?? 0) * f;
    if (d <= 0 || bf <= 0 || tf <= 0 || tw <= 0) {
      return fallbackSection(baseName);
    }
    const props = calculateIShapeProperties(d, bf, tf, tw);
    return { id: baseName, name: baseName, d, bf, tf, tw, ...props };
  }

  if (profileType.includes('RECTANGLEHOLLOW')) {
    const B = (profile.XDim ?? 0) * f;
    const H = (profile.YDim ?? 0) * f;
    const t = (profile.WallThickness ?? 0) * f;
    if (B <= 0 || H <= 0 || t <= 0) {
      return fallbackSection(baseName);
    }
    const props = calculateHSSProperties(B, H, t);
    return { id: baseName, name: baseName, d: H, bf: B, ...props };
  }

  if (profileType.includes('CIRCLEHOLLOW')) {
    const R = (profile.Radius ?? 0) * f;
    const t = (profile.WallThickness ?? 0) * f;
    if (R <= 0 || t <= 0) {
      return fallbackSection(baseName);
    }
    const D = 2 * R;
    const props = calculatePipeProperties(D, t);
    return { id: baseName, name: baseName, d: D, bf: D, ...props };
  }

  if (profileType.includes('RECTANGLE') && !profileType.includes('HOLLOW')) {
    const B = (profile.XDim ?? 0) * f;
    const H = (profile.YDim ?? 0) * f;
    if (B <= 0 || H <= 0) {
      return fallbackSection(baseName);
    }
    const A = B * H;
    const Ix = (B * H ** 3) / 12;
    const Iy = (H * B ** 3) / 12;
    const Sx = Ix / (H / 2);
    const Sy = Iy / (B / 2);
    const Zx = (B * H ** 2) / 4;
    const Zy = (H * B ** 2) / 4;
    const rx = Math.sqrt(Ix / A);
    const ry = Math.sqrt(Iy / A);
    const J = B * H * (B ** 2 + H ** 2) / 12; // approximate
    return { id: baseName, name: baseName, A, Ix, Iy, J, Sx, Sy, Zx, Zy, rx, ry, d: H, bf: B, b: B, h: H };
  }

  // Unknown profile type → fallback
  return fallbackSection(baseName);
}

function fallbackSection(name: string): Section {
  return {
    id: name,
    name,
    A: 10,
    Ix: 100,
    Iy: 30,
    J: 1,
  };
}

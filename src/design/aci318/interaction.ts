/**
 * ACI 318-19 P-M interaction diagram of a rectangular reinforced concrete
 * section, by strain compatibility.
 *
 * Assumptions (ACI 318-19 22.2):
 * - Plane sections remain plane; the extreme compression fiber strain at
 *   nominal strength is epsilon_cu = 0.003 (22.2.2.1).
 * - Concrete in compression is the Whitney rectangular block: 0.85 f'c over
 *   a depth a = beta1 * c (22.2.2.4.1), beta1 per Table 22.2.2.4.3. Tension
 *   in the concrete is ignored.
 * - Steel is elastic-perfectly-plastic, Es = 29000 ksi (20.2.2.1, 20.2.2.2).
 * - A bar inside the stress block displaces concrete, so 0.85 f'c is
 *   subtracted from its stress.
 * - phi varies with the net tensile strain of the extreme tension layer
 *   between 0.65 (tied, compression-controlled) and 0.90 (tension-controlled),
 *   Table 21.2.2, with epsilon_ty = fy / Es.
 * - Axial strength is capped at Pn,max = 0.80 Po for tied columns
 *   (22.4.2.1), Po = 0.85 f'c (Ag - Ast) + fy Ast (22.4.2.2).
 *
 * Units: kips, inches, ksi. Axial force is positive in compression; moments
 * are taken about the mid-depth of the section (the geometric centroid,
 * which is where the analysis reports the element forces).
 */

export const EPSILON_CU = 0.003;
export const ES_REBAR = 29000; // ksi

/** Phi limits for tied members, ACI 318-19 Table 21.2.2. */
export const PHI_COMPRESSION_TIED = 0.65;
export const PHI_TENSION = 0.9;

/** One layer of bars at a depth d below the compression face. */
export interface BarLayer {
  d: number;     // in, from the extreme compression fiber
  area: number;  // in^2
}

/** Rectangular section seen in the plane of bending. */
export interface InteractionSection {
  /** Concrete width perpendicular to the bending direction (in) */
  width: number;
  /** Section depth in the bending direction (in) */
  depth: number;
  bars: BarLayer[];
  fc: number;  // ksi
  fy: number;  // ksi
  Es?: number; // ksi, defaults to 29000
}

/** A point on the nominal and factored interaction diagram. */
export interface InteractionPoint {
  c: number;      // neutral axis depth (in); Infinity for pure compression, 0 for pure tension
  Pn: number;     // nominal axial strength (kips, + compression)
  Mn: number;     // nominal moment strength about mid-depth (kip-in)
  epsT: number;   // net tensile strain in the extreme tension layer (+ tension)
  phi: number;
  phiPn: number;
  phiMn: number;
}

export interface InteractionDiagram {
  /** The section the diagram was built for, used to refine readings. */
  section: InteractionSection;
  Ast: number;
  Po: number;         // 22.4.2.2
  Pnmax: number;      // 0.80 Po, 22.4.2.1
  phiPnMax: number;   // 0.65 * 0.80 Po
  Pnt: number;        // fy * Ast, pure tension (22.4.3)
  phiPnt: number;     // 0.90 * fy * Ast
  /**
   * Factored diagram, ordered from pure tension (phiPn = -phiPnt) up to the
   * phiPn,max cap. The last point is where the curve meets the cap.
   */
  points: InteractionPoint[];
}

/** beta1 per ACI 318-19 Table 22.2.2.4.3, f'c in ksi. */
export function beta1(fc: number): number {
  if (fc <= 4) return 0.85;
  if (fc >= 8) return 0.65;
  return 0.85 - (0.05 * (fc - 4));
}

/**
 * Strength reduction factor for a tied member, ACI 318-19 Table 21.2.2:
 * 0.65 when epsT <= epsTy, 0.90 when epsT >= epsTy + 0.003, linear between.
 */
export function phiTied(epsT: number, epsTy: number): number {
  if (epsT <= epsTy) return PHI_COMPRESSION_TIED;
  if (epsT >= epsTy + 0.003) return PHI_TENSION;
  return PHI_COMPRESSION_TIED + ((PHI_TENSION - PHI_COMPRESSION_TIED) * (epsT - epsTy)) / 0.003;
}

function steelArea(sec: InteractionSection): number {
  return sec.bars.reduce((sum, bar) => sum + bar.area, 0);
}

/** Po = 0.85 f'c (Ag - Ast) + fy Ast, ACI 318-19 Eq. 22.4.2.2. */
export function pureCompression(sec: InteractionSection): number {
  const Ast = steelArea(sec);
  const Ag = sec.width * sec.depth;
  return 0.85 * sec.fc * (Ag - Ast) + sec.fy * Ast;
}

/** Depth of the extreme tension layer, the deepest bar. */
function extremeTensionDepth(sec: InteractionSection): number {
  return Math.max(...sec.bars.map((bar) => bar.d));
}

/**
 * Nominal strength for a neutral axis at depth c (> 0) below the
 * compression face, by strain compatibility.
 */
export function sectionStrengthAt(sec: InteractionSection, c: number): InteractionPoint {
  const Es = sec.Es ?? ES_REBAR;
  const h = sec.depth;
  const a = Math.min(beta1(sec.fc) * c, h);
  const Cc = 0.85 * sec.fc * sec.width * a;
  let Pn = Cc;
  let Mn = Cc * (h / 2 - a / 2);

  for (const bar of sec.bars) {
    const eps = (EPSILON_CU * (c - bar.d)) / c; // + compression
    let fs = Math.max(-sec.fy, Math.min(sec.fy, Es * eps));
    // A bar inside the block (always in compression there, since a < c)
    // displaces concrete already counted in Cc.
    if (bar.d < a) fs -= 0.85 * sec.fc;
    const F = bar.area * fs;
    Pn += F;
    Mn += F * (h / 2 - bar.d);
  }

  const dt = extremeTensionDepth(sec);
  const epsT = (EPSILON_CU * (dt - c)) / c;
  const phi = phiTied(epsT, sec.fy / Es);
  return { c, Pn, Mn, epsT, phi, phiPn: phi * Pn, phiMn: phi * Mn };
}

/**
 * Build the interaction diagram by stepping the neutral axis depth c from
 * near zero (pure tension limit) to well beyond the section depth (pure
 * compression limit), then capping the curve at phiPn,max.
 */
export function buildInteractionDiagram(sec: InteractionSection, steps = 400): InteractionDiagram {
  const Ast = steelArea(sec);
  const Po = pureCompression(sec);
  const Pnmax = 0.8 * Po;
  const phiPnMax = PHI_COMPRESSION_TIED * Pnmax;
  const Pnt = sec.fy * Ast;
  const phiPnt = PHI_TENSION * Pnt;

  const points: InteractionPoint[] = [
    { c: 0, Pn: -Pnt, Mn: 0, epsT: Infinity, phi: PHI_TENSION, phiPn: -phiPnt, phiMn: 0 },
  ];

  // Geometric spacing of c from 0.1% to 100x the depth: dense near the
  // tension end, where the curve turns sharply, and reaching the plateau
  // where every bar has yielded in compression.
  const cMin = 1e-3 * sec.depth;
  const cMax = 100 * sec.depth;
  let prev = points[0];
  for (let i = 0; i <= steps; i++) {
    const c = cMin * Math.pow(cMax / cMin, i / steps);
    const p = sectionStrengthAt(sec, c);
    if (p.phiPn >= phiPnMax) {
      // Close the curve exactly where it meets the cap.
      points.push(capAt(sec, prev.c, p.c, phiPnMax));
      return { section: sec, Ast, Po, Pnmax, phiPnMax, Pnt, phiPnt, points };
    }
    if (p.phiPn > prev.phiPn) {
      points.push(p);
      prev = p;
    }
  }
  // Unreachable in practice: phiPn tends to 0.65 Po > phiPn,max as c grows.
  // Close the curve on the cap with the last moment found, to stay safe.
  points.push({ ...prev, Pn: Pnmax, phiPn: phiPnMax });
  return { section: sec, Ast, Po, Pnmax, phiPnMax, Pnt, phiPnt, points };
}

/** Refine the point where phiPn reaches the cap, by bisection on c. */
function capAt(sec: InteractionSection, cLo: number, cHi: number, phiPnMax: number): InteractionPoint {
  let lo = cLo;
  let hi = cHi;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (sectionStrengthAt(sec, mid).phiPn < phiPnMax) lo = mid;
    else hi = mid;
  }
  // Pin phiPn to the cap so a demand exactly at phiPn,max still reads a moment.
  const p = sectionStrengthAt(sec, lo);
  return { ...p, phiPn: phiPnMax, Pn: phiPnMax / p.phi };
}

/**
 * Neutral axis depth where the nominal axial strength equals Pn, by bisection.
 * Pn grows monotonically with c, so the root is unique. Used for pure bending
 * (Pn = 0) and any other point defined by its axial load.
 */
export function neutralAxisForPn(sec: InteractionSection, Pn: number): number {
  let lo = 1e-6 * sec.depth;
  let hi = 100 * sec.depth;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (sectionStrengthAt(sec, mid).Pn < Pn) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Factored moment capacity phiMn at a factored axial load phiPn = P. Returns
 * null when P is outside [-phiPnt, phiPn,max], where the section has no
 * capacity left.
 *
 * The diagram points bracket P; the neutral axis depth is then refined by
 * bisection so the reading is exact rather than a chord. A chord would
 * overestimate the capacity across the re-entrant corner the phi transition
 * makes at the balanced point.
 */
export function phiMomentAt(diagram: InteractionDiagram, P: number): number | null {
  const pts = diagram.points;
  const last = pts[pts.length - 1];
  if (P < pts[0].phiPn || P > last.phiPn) return null;
  if (P === pts[0].phiPn) return pts[0].phiMn;
  if (P === last.phiPn) return last.phiMn;
  let i = 1;
  while (P > pts[i].phiPn) i++;
  // pts[0] is pure tension at c = 0, approached as c -> 0+.
  let lo = pts[i - 1].c > 0 ? pts[i - 1].c : 1e-9 * diagram.section.depth;
  let hi = pts[i].c;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (sectionStrengthAt(diagram.section, mid).phiPn < P) lo = mid;
    else hi = mid;
  }
  return sectionStrengthAt(diagram.section, (lo + hi) / 2).phiMn;
}

/**
 * Demand/capacity ratio for (Pu, Mux, Muy).
 *
 * Method: radial scaling from the origin. The demand is scaled by lambda
 * along the ray through (Pu, Mux, Muy) until it reaches the capacity surface;
 * D/C = 1 / lambda. In the uniaxial case (Muy = 0) the surface is the phi
 * curve itself, so D/C is the ratio of the distance from the origin to the
 * demand point over the distance to the curve along the same ray.
 *
 * Biaxial bending uses the linear load contour (Bresler load contour with
 * alpha = 1): at a given axial load the surface is approximated by
 * Mux / phiMnx(P) + Muy / phiMny(P) = 1. Real contours bulge outward
 * (alpha between about 1.15 and 1.55), so alpha = 1 is conservative.
 *
 * The search assumes the surface is star-shaped about the origin, which holds
 * for the symmetric layouts produced by `barLayout`.
 *
 * @param Pu  factored axial load (kips, + compression)
 * @param Mux factored moment resisted by `diagX` (kip-in, absolute value used)
 * @param Muy factored moment resisted by `diagY` (kip-in, absolute value used)
 */
export function interactionRatio(
  diagX: InteractionDiagram,
  diagY: InteractionDiagram | null,
  Pu: number,
  Mux: number,
  Muy = 0
): number {
  const mx = Math.abs(Mux);
  const my = diagY ? Math.abs(Muy) : 0;
  if (Math.abs(Pu) < 1e-12 && mx < 1e-12 && my < 1e-12) return 0;

  const inside = (lambda: number): boolean => {
    const P = lambda * Pu;
    const capX = phiMomentAt(diagX, P);
    if (capX === null) return false;
    let sum = 0;
    if (mx > 0) {
      if (capX <= 0) return false;
      sum += (lambda * mx) / capX;
    }
    if (my > 0 && diagY) {
      const capY = phiMomentAt(diagY, P);
      if (capY === null || capY <= 0) return false;
      sum += (lambda * my) / capY;
    }
    return sum <= 1;
  };

  // Bracket lambda*, then bisect.
  let lo = 0;
  let hi = 1;
  while (inside(hi) && hi < 1e9) {
    lo = hi;
    hi *= 2;
  }
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid;
    else hi = mid;
  }
  const lambda = (lo + hi) / 2;
  return lambda > 0 ? 1 / lambda : Infinity;
}

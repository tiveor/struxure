/**
 * European hot-rolled I-sections: IPE 80 to 600, HEA 100 to 600 and
 * HEB 100 to 600.
 *
 * Dimensions (h, b, tw, tf, r) are the standard Euronorm ones, EN 10365
 * (formerly DIN 1025-5 for IPE, DIN 1025-3 for HEA, DIN 1025-2 for HEB), as
 * listed in the ArcelorMittal "Sections and Merchant Bars" sales programme.
 * They were taken from that programme's tables as reproduced by STAD
 * (stad.fr, technical data for the IPE and HE ranges, accessed 2026-10-07)
 * and cross-checked against two independent listings (eurocodeapplied.com
 * and the suanPan section library).
 *
 * Section properties are derived from those dimensions by
 * `rolledIProperties` below, exact for two flanges, a web and four
 * quarter-circle root fillets of radius r, then rounded to four significant
 * figures (A to 0.01 cm², mass to 0.1 kg/m). Every derived value agrees with
 * the published table to within its rounding; the tests in
 * `__tests__/euro-sections.test.ts` check this, including IPE 300, HEA 200
 * and HEB 200 against their published values.
 *
 * Values are stored in the units the tables are published in:
 *   h, b, tw, tf, r                mm
 *   A                              cm²
 *   Iy, Iz, It                     cm⁴
 *   Wely, Welz, Wply, Wplz         cm³
 *   mass                           kg/m
 *
 * Eurocode axis names: y-y is the strong axis, z-z the weak axis.
 * `euroToSection` maps them to the app's x (strong) and y (weak) and
 * converts to inches.
 *
 * See NOTICE for the attribution and disclaimer.
 */

import type { Section } from '../core/types';
import { fromDisplay } from '../utils/units';

export type EuroFamily = 'IPE' | 'HEA' | 'HEB';

export const EURO_FAMILIES: readonly EuroFamily[] = ['IPE', 'HEA', 'HEB'];

export interface EuroSection {
  name: string;
  family: EuroFamily;
  h: number;     // Overall depth (mm)
  b: number;     // Flange width (mm)
  tw: number;    // Web thickness (mm)
  tf: number;    // Flange thickness (mm)
  r: number;     // Root radius (mm)
  A: number;     // Area (cm²)
  Iy: number;    // Strong axis second moment of area (cm⁴)
  Iz: number;    // Weak axis second moment of area (cm⁴)
  Wely: number;  // Strong axis elastic modulus (cm³)
  Welz: number;  // Weak axis elastic modulus (cm³)
  Wply: number;  // Strong axis plastic modulus (cm³)
  Wplz: number;  // Weak axis plastic modulus (cm³)
  It: number;    // Torsion constant (cm⁴)
  mass: number;  // Mass per metre (kg/m)
}

// name, h, b, tw, tf, r, A, Iy, Iz, Wely, Welz, Wply, Wplz, It, mass
function eu(
  name: string, h: number, b: number, tw: number, tf: number, r: number,
  A: number, Iy: number, Iz: number, Wely: number, Welz: number,
  Wply: number, Wplz: number, It: number, mass: number,
): EuroSection {
  const family = name.slice(0, 3) as EuroFamily;
  return { name, family, h, b, tw, tf, r, A, Iy, Iz, Wely, Welz, Wply, Wplz, It, mass };
}

export const EURO_SECTIONS: EuroSection[] = [
  // ─── IPE ───
  eu('IPE80', 80, 46, 3.8, 5.2, 5, 7.64, 80.14, 8.489, 20.03, 3.691, 23.22, 5.818, 0.6977, 6.0),
  eu('IPE100', 100, 55, 4.1, 5.7, 7, 10.32, 171.0, 15.92, 34.20, 5.789, 39.41, 9.146, 1.202, 8.1),
  eu('IPE120', 120, 64, 4.4, 6.3, 7, 13.21, 317.8, 27.67, 52.96, 8.646, 60.73, 13.58, 1.735, 10.4),
  eu('IPE140', 140, 73, 4.7, 6.9, 7, 16.43, 541.2, 44.92, 77.32, 12.31, 88.34, 19.25, 2.447, 12.9),
  eu('IPE160', 160, 82, 5, 7.4, 9, 20.09, 869.3, 68.31, 108.7, 16.66, 123.9, 26.10, 3.604, 15.8),
  eu('IPE180', 180, 91, 5.3, 8, 9, 23.95, 1317, 100.9, 146.3, 22.16, 166.4, 34.60, 4.790, 18.8),
  eu('IPE200', 200, 100, 5.6, 8.5, 12, 28.48, 1943, 142.4, 194.3, 28.47, 220.6, 44.61, 6.980, 22.4),
  eu('IPE220', 220, 110, 5.9, 9.2, 12, 33.37, 2772, 204.9, 252.0, 37.25, 285.4, 58.11, 9.066, 26.2),
  eu('IPE240', 240, 120, 6.2, 9.8, 15, 39.12, 3892, 283.6, 324.3, 47.27, 366.6, 73.92, 12.88, 30.7),
  eu('IPE270', 270, 135, 6.6, 10.2, 15, 45.95, 5790, 419.9, 428.9, 62.20, 484.0, 96.95, 15.94, 36.1),
  eu('IPE300', 300, 150, 7.1, 10.7, 15, 53.81, 8356, 603.8, 557.1, 80.50, 628.4, 125.2, 20.12, 42.2),
  eu('IPE330', 330, 160, 7.5, 11.5, 18, 62.61, 11770, 788.1, 713.1, 98.52, 804.3, 153.7, 28.15, 49.1),
  eu('IPE360', 360, 170, 8, 12.7, 18, 72.73, 16270, 1043, 903.6, 122.8, 1019, 191.1, 37.32, 57.1),
  eu('IPE400', 400, 180, 8.6, 13.5, 21, 84.46, 23130, 1318, 1156, 146.4, 1307, 229.0, 51.08, 66.3),
  eu('IPE450', 450, 190, 9.4, 14.6, 21, 98.82, 33740, 1676, 1500, 176.4, 1702, 276.4, 66.87, 77.6),
  eu('IPE500', 500, 200, 10.2, 16, 21, 115.52, 48200, 2142, 1928, 214.2, 2194, 335.9, 89.29, 90.7),
  eu('IPE550', 550, 210, 11.1, 17.2, 24, 134.42, 67120, 2668, 2441, 254.1, 2787, 400.5, 123.2, 105.5),
  eu('IPE600', 600, 220, 12, 19, 24, 155.98, 92080, 3387, 3069, 307.9, 3512, 485.6, 165.4, 122.4),
  // ─── HEA ───
  eu('HEA100', 96, 100, 5, 8, 12, 21.24, 349.2, 133.8, 72.76, 26.76, 83.01, 41.14, 5.237, 16.7),
  eu('HEA120', 114, 120, 5, 8, 12, 25.34, 606.2, 230.9, 106.3, 38.48, 119.5, 58.85, 5.994, 19.9),
  eu('HEA140', 133, 140, 5.5, 8.5, 12, 31.42, 1033, 389.3, 155.4, 55.62, 173.5, 84.85, 8.130, 24.7),
  eu('HEA160', 152, 160, 6, 9, 15, 38.77, 1673, 615.6, 220.1, 76.95, 245.1, 117.6, 12.19, 30.4),
  eu('HEA180', 171, 180, 6, 9.5, 15, 45.25, 2510, 924.6, 293.6, 102.7, 324.9, 156.5, 14.80, 35.5),
  eu('HEA200', 190, 200, 6.5, 10, 18, 53.83, 3692, 1336, 388.6, 133.6, 429.5, 203.8, 20.98, 42.3),
  eu('HEA220', 210, 220, 7, 11, 18, 64.34, 5410, 1955, 515.2, 177.7, 568.5, 270.6, 28.46, 50.5),
  eu('HEA240', 230, 240, 7.5, 12, 21, 76.84, 7763, 2769, 675.1, 230.7, 744.6, 351.7, 41.55, 60.3),
  eu('HEA260', 250, 260, 7.5, 12.5, 24, 86.82, 10450, 3668, 836.4, 282.1, 919.8, 430.2, 52.37, 68.2),
  eu('HEA280', 270, 280, 8, 13, 24, 97.26, 13670, 4763, 1013, 340.2, 1112, 518.1, 62.10, 76.4),
  eu('HEA300', 290, 300, 8.5, 14, 27, 112.53, 18260, 6310, 1260, 420.6, 1383, 641.2, 85.17, 88.3),
  eu('HEA320', 310, 300, 9, 15.5, 27, 124.37, 22930, 6985, 1479, 465.7, 1628, 709.7, 108.0, 97.6),
  eu('HEA340', 330, 300, 9.5, 16.5, 27, 133.47, 27690, 7436, 1678, 495.7, 1850, 755.9, 127.2, 104.8),
  eu('HEA360', 350, 300, 10, 17.5, 27, 142.76, 33090, 7887, 1891, 525.8, 2088, 802.3, 148.8, 112.1),
  eu('HEA400', 390, 300, 11, 19, 27, 158.98, 45070, 8564, 2311, 570.9, 2562, 872.9, 189.0, 124.8),
  eu('HEA450', 440, 300, 11.5, 21, 27, 178.03, 63720, 9465, 2896, 631.0, 3216, 965.5, 243.8, 139.8),
  eu('HEA500', 490, 300, 12, 23, 27, 197.54, 86970, 10370, 3550, 691.1, 3949, 1059, 309.3, 155.1),
  eu('HEA550', 540, 300, 12.5, 24, 27, 211.76, 111900, 10820, 4146, 721.3, 4622, 1107, 351.5, 166.2),
  eu('HEA600', 590, 300, 13, 25, 27, 226.46, 141200, 11270, 4787, 751.4, 5350, 1156, 397.8, 177.8),
  // ─── HEB ───
  eu('HEB100', 100, 100, 6, 10, 12, 26.04, 449.5, 167.3, 89.91, 33.45, 104.2, 51.42, 9.248, 20.4),
  eu('HEB120', 120, 120, 6.5, 11, 12, 34.01, 864.4, 317.5, 144.1, 52.92, 165.2, 80.97, 13.84, 26.7),
  eu('HEB140', 140, 140, 7, 12, 12, 42.96, 1509, 549.7, 215.6, 78.52, 245.4, 119.8, 20.06, 33.7),
  eu('HEB160', 160, 160, 8, 13, 15, 54.25, 2492, 889.2, 311.5, 111.2, 354.0, 170.0, 31.24, 42.6),
  eu('HEB180', 180, 180, 8.5, 14, 15, 65.25, 3831, 1363, 425.7, 151.4, 481.4, 231.0, 42.16, 51.2),
  eu('HEB200', 200, 200, 9, 15, 18, 78.08, 5696, 2003, 569.6, 200.3, 642.5, 305.8, 59.28, 61.3),
  eu('HEB220', 220, 220, 9.5, 16, 18, 91.04, 8091, 2843, 735.5, 258.5, 827.0, 393.9, 76.57, 71.5),
  eu('HEB240', 240, 240, 10, 17, 21, 105.99, 11260, 3923, 938.3, 326.9, 1053, 498.4, 102.7, 83.2),
  eu('HEB260', 260, 260, 10, 17.5, 24, 118.44, 14920, 5135, 1148, 395.0, 1283, 602.2, 123.8, 93.0),
  eu('HEB280', 280, 280, 10.5, 18, 24, 131.36, 19270, 6595, 1376, 471.0, 1534, 717.6, 143.7, 103.1),
  eu('HEB300', 300, 300, 11, 19, 27, 149.08, 25170, 8563, 1678, 570.9, 1869, 870.1, 185.0, 117.0),
  eu('HEB320', 320, 300, 11.5, 20.5, 27, 161.34, 30820, 9239, 1926, 615.9, 2149, 939.1, 225.1, 126.7),
  eu('HEB340', 340, 300, 12, 21.5, 27, 170.90, 36660, 9690, 2156, 646.0, 2408, 985.7, 257.2, 134.2),
  eu('HEB360', 360, 300, 12.5, 22.5, 27, 180.63, 43190, 10140, 2400, 676.1, 2683, 1032, 292.5, 141.8),
  eu('HEB400', 400, 300, 13.5, 24, 27, 197.78, 57680, 10820, 2884, 721.3, 3232, 1104, 355.7, 155.3),
  eu('HEB450', 450, 300, 14, 26, 27, 217.98, 79890, 11720, 3551, 781.4, 3982, 1198, 440.5, 171.1),
  eu('HEB500', 500, 300, 14.5, 28, 27, 238.64, 107200, 12620, 4287, 841.6, 4815, 1292, 538.4, 187.3),
  eu('HEB550', 550, 300, 15, 29, 27, 254.06, 136700, 13080, 4971, 871.8, 5591, 1341, 600.3, 199.4),
  eu('HEB600', 600, 300, 15.5, 30, 27, 269.96, 171000, 13530, 5701, 902.0, 6425, 1391, 667.2, 211.9),
];

/**
 * Section properties of a doubly symmetric rolled I-section with four
 * quarter-circle root fillets, from its dimensions in mm. Results are in the
 * published units (cm², cm⁴, cm³, kg/m).
 *
 * Each fillet is the spandrel left between an r x r square and a quarter
 * circle of radius r: area (1 - pi/4) r², centroid r(10 - 3 pi)/(12 - 3 pi)
 * from each leg. A, Iy, Iz, Wel and Wpl follow exactly from flanges, web
 * and fillets by the parallel axis theorem.
 *
 * It uses the closed-form approximation for rolled I-sections with root
 * fillets attributed to El Darwish and Johnston ("Torsion of structural
 * shapes", ASCE Journal of the Structural Division 91(ST1), 1965):
 *   It = 2/3 (b - 0.63 tf) tf³ + 1/3 (h - 2 tf) tw³
 *        + 2 (tw/tf) (0.145 + 0.1 r/tf) D⁴,
 *   D  = ((r + tw/2)² + (r + tf)² - r²) / (2 r + tf).
 * It reproduces the published ArcelorMittal values of IPE 300 (20.12 cm⁴),
 * HEA 200 (20.98 cm⁴) and HEB 200 (59.28 cm⁴) to four figures.
 *
 * Mass is A times 7850 kg/m³, the steel density the tables use.
 */
export function rolledIProperties(h: number, b: number, tw: number, tf: number, r: number) {
  const fillet = r * r * (1 - Math.PI / 4);
  const e = (r * (10 - 3 * Math.PI)) / (12 - 3 * Math.PI);
  // Quarter circle about the line through the fillet's flange-side leg.
  const quarter = Math.PI * r * r / 4;
  const cq = (4 * r) / (3 * Math.PI);
  const quarterAboutLeg = Math.PI * r ** 4 / 16 - quarter * cq ** 2 + quarter * (r - cq) ** 2;
  const filletOwn = r ** 4 / 3 - quarterAboutLeg - fillet * e * e;

  const hw = h - 2 * tf;
  const A = 2 * b * tf + hw * tw + 4 * fillet;
  const yf = h / 2 - tf - e;
  const zf = tw / 2 + e;
  const Iy = (b * h ** 3 - (b - tw) * hw ** 3) / 12 + 4 * (filletOwn + fillet * yf ** 2);
  const Iz = (2 * tf * b ** 3 + hw * tw ** 3) / 12 + 4 * (filletOwn + fillet * zf ** 2);
  const Wply = 2 * b * tf * (h / 2 - tf / 2) + (tw * hw ** 2) / 4 + 4 * fillet * yf;
  const Wplz = (tf * b * b) / 2 + (hw * tw * tw) / 4 + 4 * fillet * zf;
  const D = ((r + tw / 2) ** 2 + (r + tf) ** 2 - r * r) / (2 * r + tf);
  const It =
    (2 / 3) * (b - 0.63 * tf) * tf ** 3 +
    (1 / 3) * hw * tw ** 3 +
    2 * (tw / tf) * (0.145 + (0.1 * r) / tf) * D ** 4;

  return {
    A: A / 1e2,
    Iy: Iy / 1e4,
    Iz: Iz / 1e4,
    Wely: Iy / (h / 2) / 1e3,
    Welz: Iz / (b / 2) / 1e3,
    Wply: Wply / 1e3,
    Wplz: Wplz / 1e3,
    It: It / 1e4,
    mass: (A / 1e6) * 7850,
  };
}

/** Search by designation, ignoring case and spaces ("ipe 300" finds IPE300). */
export function searchEuroSections(query: string): EuroSection[] {
  const q = query.toUpperCase().replace(/\s+/g, '');
  if (!q) return EURO_SECTIONS;
  return EURO_SECTIONS.filter((s) => s.name.includes(q));
}

// Published units expressed in mm so `fromDisplay` (metric = mm) converts them.
const CM2 = 1e2;
const CM3 = 1e3;
const CM4 = 1e4;

/** Mass per metre (kg/m) as weight per length in lb/ft, the app's unit. */
export function euroWeightLbPerFt(s: EuroSection): number {
  return fromDisplay(s.mass, 'weightPerLength', 'metric');
}

/**
 * Convert a Euronorm section to the app's Section, in inches. The Eurocode
 * strong axis y-y becomes x (Ix, Sx, Zx), the weak axis z-z becomes y
 * (Iy, Sy, Zy), and It becomes J. d = h and bf = b.
 */
export function euroToSection(s: EuroSection): Section {
  const len = (mm: number) => fromDisplay(mm, 'sectionDimension', 'metric');
  const A = fromDisplay(s.A * CM2, 'area', 'metric');
  const Ix = fromDisplay(s.Iy * CM4, 'momentOfInertia', 'metric');
  const Iy = fromDisplay(s.Iz * CM4, 'momentOfInertia', 'metric');
  return {
    id: s.name,
    name: s.name,
    shape: 'I',
    A,
    Ix,
    Iy,
    J: fromDisplay(s.It * CM4, 'momentOfInertia', 'metric'),
    Sx: fromDisplay(s.Wely * CM3, 'sectionModulus', 'metric'),
    Sy: fromDisplay(s.Welz * CM3, 'sectionModulus', 'metric'),
    Zx: fromDisplay(s.Wply * CM3, 'sectionModulus', 'metric'),
    Zy: fromDisplay(s.Wplz * CM3, 'sectionModulus', 'metric'),
    rx: Math.sqrt(Ix / A),
    ry: Math.sqrt(Iy / A),
    d: len(s.h),
    bf: len(s.b),
    tf: len(s.tf),
    tw: len(s.tw),
  };
}

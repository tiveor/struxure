/**
 * AISC 360 Chapter H — Combined Forces (Interaction Equations)
 *
 * Equations H1-1a and H1-1b:
 *   If Pu/(φPn) >= 0.2:
 *     Pu/(φPn) + (8/9)(Mux/(φMnx) + Muy/(φMny)) <= 1.0
 *
 *   If Pu/(φPn) < 0.2:
 *     Pu/(2·φPn) + (Mux/(φMnx) + Muy/(φMny)) <= 1.0
 *
 * We use the D/C ratios already computed individually.
 */
export function checkCombined(
  axialRatio: number,   // Pu / φPn (from tension or compression check)
  flexureRatioX: number, // Mux / φMnx (strong axis bending)
  flexureRatioY: number = 0 // Muy / φMny (weak axis bending)
): number {
  if (axialRatio < 1e-10 && flexureRatioX < 1e-10 && flexureRatioY < 1e-10) {
    return 0;
  }

  let ratio: number;

  if (axialRatio >= 0.2) {
    // Eq. H1-1a
    ratio = axialRatio + (8 / 9) * (flexureRatioX + flexureRatioY);
  } else {
    // Eq. H1-1b
    ratio = axialRatio / 2 + (flexureRatioX + flexureRatioY);
  }

  return ratio;
}

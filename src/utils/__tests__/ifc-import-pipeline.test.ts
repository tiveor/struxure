/**
 * End-to-end IFC import tests: real IFC-SPF text parsed by web-ifc and run
 * through importIfc, so the file's declared length unit is exercised on both
 * node coordinates and profile dimensions.
 */
import { describe, it, expect } from 'vitest';
import { importIfc } from '../ifc-import';
import { calculateIShapeProperties } from '../ifc-profiles';

type LengthUnitCase = 'MILLIMETRE' | 'METRE' | 'INCH';

/** STEP lines declaring the file's length unit; the last entity id is the unit itself. */
function lengthUnitLines(unit: LengthUnitCase): { lines: string[]; unitRef: string } {
  switch (unit) {
    case 'MILLIMETRE':
      return { lines: ['#1=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);'], unitRef: '#1' };
    case 'METRE':
      return { lines: ['#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);'], unitRef: '#1' };
    case 'INCH':
      return {
        lines: [
          '#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);',
          '#2=IFCDIMENSIONALEXPONENTS(1,0,0,0,0,0,0);',
          '#3=IFCMEASUREWITHUNIT(IFCLENGTHMEASURE(0.0254),#1);',
          "#4=IFCCONVERSIONBASEDUNIT(#2,.LENGTHUNIT.,'INCH',#3);",
        ],
        unitRef: '#4',
      };
  }
}

/** Format a number as a STEP real (always with a decimal point). */
function real(v: number): string {
  const s = String(v);
  return s.includes('.') || s.includes('E') ? s : `${s}.`;
}

/**
 * Minimal IFC4 file with one IfcBeam (6 m long along X, Axis representation)
 * carrying an IPE300 profile, with every length written in `unit`.
 * `scale` converts millimetres to the file unit.
 */
function buildBeamIfc(unit: LengthUnitCase, scale: number): Uint8Array {
  const { lines: unitLines, unitRef } = lengthUnitLines(unit);
  const L = (mm: number) => real(mm * scale);
  const text = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    "FILE_NAME('test.ifc','2026-01-01T00:00:00',(''),(''),'','','');",
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
    ...unitLines,
    `#10=IFCUNITASSIGNMENT((${unitRef}));`,
    '#11=IFCCARTESIANPOINT((0.,0.,0.));',
    '#12=IFCAXIS2PLACEMENT3D(#11,$,$);',
    "#13=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#12,$);",
    "#14=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'Test',$,$,$,$,(#13),#10);",
    '#20=IFCLOCALPLACEMENT($,#12);',
    '#21=IFCCARTESIANPOINT((0.,0.,0.));',
    `#22=IFCCARTESIANPOINT((${L(6000)},0.,0.));`,
    '#23=IFCPOLYLINE((#21,#22));',
    "#24=IFCSHAPEREPRESENTATION(#13,'Axis','Curve3D',(#23));",
    '#25=IFCPRODUCTDEFINITIONSHAPE($,$,(#24));',
    "#26=IFCBEAM('1YvctVUKr0kugbFTf53O9L',$,'B1',$,$,#20,#25,$,$);",
    // IPE300: b = 150, h = 300, tw = 7.1, tf = 10.7, r = 15 (mm)
    `#30=IFCISHAPEPROFILEDEF(.AREA.,'IPE300',$,${L(150)},${L(300)},${L(7.1)},${L(10.7)},${L(15)},$,$);`,
    "#31=IFCMATERIAL('S355',$,$);",
    '#32=IFCMATERIALPROFILE($,$,#31,#30,$,$);',
    "#33=IFCMATERIALPROFILESET('IPE300',$,(#32),$);",
    "#34=IFCRELASSOCIATESMATERIAL('2YvctVUKr0kugbFTf53O9L',$,$,$,(#26),#33);",
    'ENDSEC;',
    'END-ISO-10303-21;',
  ].join('\n');
  return new TextEncoder().encode(text);
}

// IPE300 in inches
const D = 300 / 25.4;
const BF = 150 / 25.4;
const TW = 7.1 / 25.4;
const TF = 10.7 / 25.4;
const BEAM_LENGTH_IN = 6000 / 25.4;

const cases: Array<[LengthUnitCase, number]> = [
  ['MILLIMETRE', 1],
  ['METRE', 1 / 1000],
  ['INCH', 1 / 25.4],
];

describe('importIfc length units (pipeline)', () => {
  it.each(cases)('converts profile dimensions from a %s file to inches exactly once', async (unit, scale) => {
    const result = await importIfc(buildBeamIfc(unit, scale));

    expect(result.elements).toHaveLength(1);
    expect(result.sections).toHaveLength(1);

    const section = result.sections[0];
    expect(section.name).toBe('IPE300');
    expect(section.d).toBeCloseTo(D, 3); // 11.811 in
    expect(section.bf).toBeCloseTo(BF, 3); // 5.906 in
    expect(section.tw).toBeCloseTo(TW, 4);
    expect(section.tf).toBeCloseTo(TF, 4);

    const expected = calculateIShapeProperties(D, BF, TF, TW);
    expect(section.A).toBeCloseTo(expected.A, 2); // about 8.21 in^2
    expect(section.Ix).toBeCloseTo(expected.Ix, 1); // about 195 in^4

    // Node coordinates go through the same unit factor (the importer re-centers
    // the model, so check the span rather than absolute positions).
    const xs = result.nodes.map((n) => n.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(BEAM_LENGTH_IN, 2);
  });

  it('keeps a millimetre IPE300 at a realistic size', async () => {
    const result = await importIfc(buildBeamIfc('MILLIMETRE', 1));
    const section = result.sections[0];
    // Regression guard: raw millimetres must never reach the model as inches.
    expect(section.d).toBeLessThan(20);
    expect(section.A).toBeLessThan(20);
  });
});

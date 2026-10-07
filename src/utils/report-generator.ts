/**
 * Professional PDF report generator for structural analysis results.
 * Uses jsPDF + jspdf-autotable for table generation.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StructuralModel, AnalysisResults } from '../core/types';
import type { DesignCheckResult } from '../design/types';
import { DESIGN_BANDS } from './color-ramp';
import { INDICATIVE_MARK, indicativeReasons } from '../design/indicative';
import { unitLabel, formatQuantity } from './units';
import type { QuantityType, UnitSystem, DecimalsOption } from './units';

export interface ReportOptions {
  projectName?: string;
  engineer?: string;
  description?: string;
  screenshot?: string; // base64 data URL from canvas
  /** Unit system for every table in the report. Defaults to imperial. */
  units?: UnitSystem;
}

// ─── Number formatting helpers ───────────────────────────────────────

export function formatDisplacement(value: number): string {
  return value.toFixed(4);
}

export function formatForce(value: number): string {
  return value.toFixed(2);
}

export function formatDCRatio(value: number): string {
  return value.toFixed(3);
}

// ─── Units in tables ─────────────────────────────────────────────────

/**
 * Unit label safe for jsPDF's built-in fonts, which cover WinAnsi: the
 * superscript 2 and 3 are in it, the superscript 4 is not.
 */
export function reportUnit(qty: QuantityType, units: UnitSystem): string {
  return unitLabel(qty, units).replace('\u2074', '^4');
}

function header(label: string, qty: QuantityType, units: UnitSystem): string {
  return `${label} (${reportUnit(qty, units)})`;
}

function fmt(value: number, qty: QuantityType, units: UnitSystem, decimals?: DecimalsOption): string {
  return formatQuantity(value, qty, units, decimals);
}

// The summary box truncates values past 70 characters, so both lines stay short.

/** One line naming the unit system used by every table. */
export function reportUnitsLine(units: UnitSystem): string {
  return units === 'metric'
    ? 'SI: m (geometry), mm (sections, displ.), kN, kN-m, kN/m, MPa'
    : 'Imperial: in, kip, kip-in, kip/in, ksi';
}

/** One line naming the design codes and, for SI, the units they run in. */
export function reportCodesLine(units: UnitSystem): string {
  const codes = 'AISC 360 (steel), ACI 318-19 (concrete)';
  return units === 'metric' ? `${codes}; checked in kip-in-ksi` : codes;
}

export interface ReportTable {
  head: string[][];
  body: string[][];
}

export function nodeTable(model: StructuralModel, units: UnitSystem): ReportTable {
  const len = (v: number) => fmt(v, 'length', units, { imperial: 2 });
  return {
    head: [['Node ID', header('X', 'length', units), header('Y', 'length', units), header('Z', 'length', units)]],
    body: model.nodes.map((n) => [n.id, len(n.x), len(n.y), len(n.z)]),
  };
}

export function materialTable(model: StructuralModel, units: UnitSystem): ReportTable {
  return {
    head: [['Name', 'Type', header('E', 'stress', units), header('G', 'stress', units), header('fy/fc', 'stress', units)]],
    body: model.materials.map((m) => {
      const strength = m.type === 'steel' ? m.fy : m.fc;
      return [
        m.name, m.type, fmt(m.E, 'stress', units, 0), fmt(m.G, 'stress', units, 0),
        strength === undefined ? '-' : fmt(strength, 'stress', units, 1),
      ];
    }),
  };
}

export function sectionTable(model: StructuralModel, units: UnitSystem): ReportTable {
  const inertia = (v: number, imperial: number) => fmt(v, 'momentOfInertia', units, { imperial });
  const modulus = (v: number | undefined) => (v === undefined ? '-' : fmt(v, 'sectionModulus', units, { imperial: 1 }));
  return {
    head: [[
      'Section', header('A', 'area', units), header('Ix', 'momentOfInertia', units),
      header('Iy', 'momentOfInertia', units), header('J', 'momentOfInertia', units),
      header('Sx', 'sectionModulus', units), header('Zx', 'sectionModulus', units),
    ]],
    body: model.sections.map((s) => [
      s.name, fmt(s.A, 'area', units, { imperial: 2 }), inertia(s.Ix, 1), inertia(s.Iy, 1), inertia(s.J, 3),
      modulus(s.Sx), modulus(s.Zx),
    ]),
  };
}

export function nodalLoadTable(model: StructuralModel, units: UnitSystem): ReportTable {
  const force = (v: number) => fmt(v, 'force', units, 2);
  const moment = (v: number) => fmt(v, 'moment', units, 2);
  return {
    head: [[
      'Load ID', 'Node', header('Fx', 'force', units), header('Fy', 'force', units), header('Fz', 'force', units),
      header('Mx', 'moment', units), header('My', 'moment', units), header('Mz', 'moment', units),
    ]],
    body: model.nodalLoads.map((l) => [
      l.id, l.nodeId, force(l.fx), force(l.fy), force(l.fz), moment(l.mx), moment(l.my), moment(l.mz),
    ]),
  };
}

export function distributedLoadTable(model: StructuralModel, units: UnitSystem): ReportTable {
  const w = (v: number) => fmt(v, 'forcePerLength', units, 2);
  return {
    head: [[
      'Load ID', 'Element', header('wx', 'forcePerLength', units),
      header('wy', 'forcePerLength', units), header('wz', 'forcePerLength', units),
    ]],
    body: model.distributedLoads.map((l) => [l.id, l.elementId, w(l.wx), w(l.wy), w(l.wz)]),
  };
}

export function displacementTable(model: StructuralModel, results: AnalysisResults, units: UnitSystem): ReportTable {
  const disp = (v: number) => fmt(v, 'displacement', units, { imperial: 4, metric: 3 });
  const rows: string[][] = [];
  for (const node of model.nodes) {
    const d = results.nodeDisplacements.get(node.id);
    if (d) {
      rows.push([
        node.id,
        disp(d[0]), disp(d[1]), disp(d[2]),
        // Rotations are in radians in both systems.
        formatDisplacement(d[3]), formatDisplacement(d[4]), formatDisplacement(d[5]),
      ]);
    }
  }
  return {
    head: [[
      'Node', header('ux', 'displacement', units), header('uy', 'displacement', units),
      header('uz', 'displacement', units), 'rx (rad)', 'ry (rad)', 'rz (rad)',
    ]],
    body: rows,
  };
}

export function reactionTable(model: StructuralModel, results: AnalysisResults, units: UnitSystem): ReportTable {
  const force = (v: number) => fmt(v, 'force', units, 2);
  const moment = (v: number) => fmt(v, 'moment', units, 2);
  const rows: string[][] = [];
  const supportNodeIds = new Set(model.supports.map((s) => s.nodeId));
  for (const node of model.nodes) {
    if (!supportNodeIds.has(node.id)) continue;
    const r = results.reactions.get(node.id);
    if (r) {
      rows.push([node.id, force(r[0]), force(r[1]), force(r[2]), moment(r[3]), moment(r[4]), moment(r[5])]);
    }
  }
  return {
    head: [[
      'Node', header('Rx', 'force', units), header('Ry', 'force', units), header('Rz', 'force', units),
      header('Mrx', 'moment', units), header('Mry', 'moment', units), header('Mrz', 'moment', units),
    ]],
    body: rows,
  };
}

/** Rows of element end forces, [N, V2, V3, T, M2, M3], in display units. */
export function elementForceRows(forces: number[], units: UnitSystem): string[] {
  return forces.map((v, i) => fmt(v, i < 3 ? 'force' : 'moment', units, 2));
}

export function elementForceHead(units: UnitSystem): string[][] {
  return [[
    'Element', header('Axial', 'force', units), header('V2', 'force', units), header('V3', 'force', units),
    header('T', 'moment', units), header('M2', 'moment', units), header('M3', 'moment', units),
  ]];
}

// ─── Report generator ────────────────────────────────────────────────

export async function generateReport(
  model: StructuralModel,
  results: AnalysisResults | null,
  designResults: DesignCheckResult[],
  options: ReportOptions = {},
): Promise<Blob> {
  const units = options.units ?? 'imperial';
  // Metric users get ISO A4; imperial keeps US Letter.
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: units === 'metric' ? 'a4' : 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // ─── Page 1: Cover ────────────────────────────────────────────
  addCoverPage(doc, model, options, pageWidth, margin, contentWidth);

  // ─── Page 2: Model Summary ────────────────────────────────────
  doc.addPage();
  let y = addSectionHeader(doc, '1. MODEL SUMMARY', margin);
  y = addModelSummary(doc, model, units, margin, y, contentWidth);

  // ─── Geometry tables ──────────────────────────────────────────
  y = addSectionHeader(doc, '2. NODE COORDINATES', margin, y + 10);
  addTable(doc, nodeTable(model, units), margin, y);

  doc.addPage();
  y = addSectionHeader(doc, '3. ELEMENT CONNECTIVITY', margin);
  addElementTable(doc, model, margin, y);

  // ─── Material & Section tables ────────────────────────────────
  doc.addPage();
  y = addSectionHeader(doc, '4. MATERIALS', margin);
  y = addTable(doc, materialTable(model, units), margin, y) + 5;
  y = addSectionHeader(doc, '5. SECTIONS', margin, y + 10);
  addTable(doc, sectionTable(model, units), margin, y);

  // ─── Loads ────────────────────────────────────────────────────
  if (model.nodalLoads.length > 0 || model.distributedLoads.length > 0) {
    doc.addPage();
    y = addSectionHeader(doc, '6. APPLIED LOADS', margin);
    addLoadTables(doc, model, units, margin, y);
  }

  // ─── Results (only if analyzed) ───────────────────────────────
  if (results) {
    // Displacements
    doc.addPage();
    y = addSectionHeader(doc, '7. DISPLACEMENT RESULTS', margin);
    addTable(doc, displacementTable(model, results, units), margin, y, 7);

    // Reactions
    doc.addPage();
    y = addSectionHeader(doc, '8. REACTION FORCES', margin);
    addReactionTable(doc, model, results, units, margin, y);

    // Element forces
    doc.addPage();
    y = addSectionHeader(doc, '9. ELEMENT INTERNAL FORCES', margin);
    addElementForcesTable(doc, model, results, units, margin, y);

    // Design checks
    if (designResults.length > 0) {
      doc.addPage();
      y = addSectionHeader(doc, '10. DESIGN CHECKS', margin);
      addDesignChecksTable(doc, designResults, margin, y);
    }
  }

  // ─── Footer on every page ─────────────────────────────────────
  addFooters(doc, options.projectName);

  return doc.output('blob');
}

// ─── Cover page ──────────────────────────────────────────────────────

function addCoverPage(
  doc: jsPDF,
  model: StructuralModel,
  options: ReportOptions,
  pageWidth: number,
  margin: number,
  contentWidth: number,
) {
  const pageHeight = doc.internal.pageSize.getHeight();

  // Blue accent bar at top
  doc.setFillColor(59, 130, 246); // Tailwind blue-500
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text('Structural Analysis', margin, 40);
  doc.text('Report', margin, 52);

  // Accent line
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1);
  doc.line(margin, 58, margin + 60, 58);

  // Project info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // Slate-500
  let infoY = 70;

  if (options.projectName) {
    doc.setFont('helvetica', 'bold');
    doc.text('Project:', margin, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(options.projectName, margin + 25, infoY);
    infoY += 8;
  }

  if (options.engineer) {
    doc.setFont('helvetica', 'bold');
    doc.text('Engineer:', margin, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(options.engineer, margin + 25, infoY);
    infoY += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), margin + 25, infoY);
  infoY += 8;

  if (options.description) {
    doc.setFont('helvetica', 'bold');
    doc.text('Description:', margin, infoY);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(options.description, contentWidth - 25);
    doc.text(descLines, margin + 30, infoY);
    infoY += descLines.length * 6;
  }

  // Screenshot
  if (options.screenshot && options.screenshot.length > 50) {
    try {
      const imgY = infoY + 10;
      const legendHeight = 10; // reserved for the one-line design colour key below the image
      const imgHeight = Math.min(120, pageHeight - imgY - 40 - legendHeight);
      doc.addImage(options.screenshot, 'PNG', margin, imgY, contentWidth, imgHeight);
      // Key for the design D/C bands shown in the screenshot. Only drawn when
      // the image itself was embedded successfully - a legend for a missing
      // image would be misleading.
      addDesignColorLegend(doc, margin, imgY + imgHeight + 4, contentWidth);
    } catch {
      // Screenshot failed - no big deal
    }
  }

  // Model stats summary box
  const boxY = pageHeight - 50;
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.roundedRect(margin, boxY, contentWidth, 30, 3, 3, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  const stats = [
    `Nodes: ${model.nodes.length}`,
    `Elements: ${model.elements.length}`,
    `Materials: ${model.materials.length}`,
    `Sections: ${model.sections.length}`,
    `Supports: ${model.supports.length}`,
    `Load Cases: ${model.nodalLoads.length + model.distributedLoads.length}`,
  ];
  const colWidth = contentWidth / 3;
  stats.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    doc.text(stat, margin + 8 + col * colWidth, boxY + 10 + row * 10);
  });
}

/**
 * Draws a compact one-line key for the absolute D/C colour bands shown in the
 * report's 3D screenshot. Uses the exact same DESIGN_BANDS values as
 * ElementMesh.tsx so the key can never drift from the rendering.
 */
function addDesignColorLegend(doc: jsPDF, margin: number, y: number, contentWidth: number) {
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // Slate-500

  const swatchSize = 3;
  const colWidth = contentWidth / DESIGN_BANDS.length;

  DESIGN_BANDS.forEach((band, i) => {
    const x = margin + i * colWidth;
    doc.setFillColor(band.color);
    doc.rect(x, y - swatchSize, swatchSize, swatchSize, 'F');
    doc.text(band.label, x + swatchSize + 2, y);
  });
}

// ─── Section headers ─────────────────────────────────────────────────

function addSectionHeader(doc: jsPDF, title: string, margin: number, y?: number): number {
  const startY = y ?? 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin, startY);

  // Underline
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, startY + 2, margin + doc.getTextWidth(title), startY + 2);

  return startY + 10;
}

// ─── Model summary ──────────────────────────────────────────────────

function addModelSummary(
  doc: jsPDF,
  model: StructuralModel,
  units: UnitSystem,
  margin: number,
  y: number,
  contentWidth: number,
): number {
  const items = [
    ['Total Nodes', String(model.nodes.length)],
    ['Total Elements', String(model.elements.length)],
    ['Materials', model.materials.map((m) => m.name).join(', ')],
    ['Sections', model.sections.map((s) => s.name).join(', ')],
    ['Supports', String(model.supports.length)],
    ['Nodal Loads', String(model.nodalLoads.length)],
    ['Distributed Loads', String(model.distributedLoads.length)],
    ['Units', reportUnitsLine(units)],
    ['Design Codes', reportCodesLine(units)],
  ];

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentWidth, items.length * 5 + 5, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);

  let iy = y + 8;
  for (const [label, value] of items) {
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', margin + 5, iy);
    doc.setFont('helvetica', 'normal');
    const truncatedValue = value.length > 70 ? value.substring(0, 67) + '...' : value;
    doc.text(truncatedValue, margin + 50, iy);
    iy += 5;
  }

  return iy + 5;
}

// ─── Table builders ──────────────────────────────────────────────────

/** Draws a table in the report style and returns the y below it. */
function addTable(doc: jsPDF, table: ReportTable, margin: number, y: number, fontSize = 8): number {
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: table.head,
    body: table.body,
    styles: { fontSize, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function addElementTable(doc: jsPDF, model: StructuralModel, margin: number, y: number) {
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Element ID', 'Node I', 'Node J', 'Material', 'Section', 'Beta (°)']],
    body: model.elements.map((e) => [
      e.id,
      e.nodeI,
      e.nodeJ,
      model.materials.find((m) => m.id === e.materialId)?.name ?? e.materialId,
      model.sections.find((s) => s.id === e.sectionId)?.name ?? e.sectionId,
      e.betaAngle.toFixed(0),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
}

function addLoadTables(doc: jsPDF, model: StructuralModel, units: UnitSystem, margin: number, y: number): number {
  if (model.nodalLoads.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text('Nodal Loads', margin, y);
    y += 5;

    y = addTable(doc, nodalLoadTable(model, units), margin, y) + 10;
  }

  if (model.distributedLoads.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text('Distributed Loads', margin, y);
    y += 5;

    y = addTable(doc, distributedLoadTable(model, units), margin, y) + 5;
  }

  return y;
}

// ─── Results tables ──────────────────────────────────────────────────

function addReactionTable(
  doc: jsPDF,
  model: StructuralModel,
  results: AnalysisResults,
  units: UnitSystem,
  margin: number,
  y: number,
) {
  const table = reactionTable(model, results, units);
  if (table.body.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('No reactions to display.', margin, y);
    return;
  }
  addTable(doc, table, margin, y, 7);
}

function addElementForcesTable(
  doc: jsPDF,
  model: StructuralModel,
  results: AnalysisResults,
  units: UnitSystem,
  margin: number,
  y: number,
) {
  // Start forces
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text('Element Start Forces (Node I)', margin, y);
  y += 5;

  const startRows: string[][] = [];
  const endRows: string[][] = [];

  for (const elem of model.elements) {
    const f = results.elementForces.get(elem.id);
    if (!f) continue;
    startRows.push([elem.id, ...elementForceRows(f.startForces, units)]);
    endRows.push([elem.id, ...elementForceRows(f.endForces, units)]);
  }

  const forceHeaders = elementForceHead(units);

  const afterStartY = addTable(doc, { head: forceHeaders, body: startRows }, margin, y, 7) + 10;

  // Check if we need a new page
  if (afterStartY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    y = 20;
  } else {
    y = afterStartY;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text('Element End Forces (Node J)', margin, y);
  y += 5;

  addTable(doc, { head: forceHeaders, body: endRows }, margin, y, 7);
}

/**
 * Rows of the design checks table. An indicative ratio carries the
 * INDICATIVE_MARK, keyed to the footnotes from `indicativeReasons`.
 */
export function designChecksTableBody(designResults: DesignCheckResult[]): string[][] {
  return designResults.map((dc) => [
    dc.elementId,
    dc.material.toUpperCase(),
    dc.indicative ? `${formatDCRatio(dc.ratio)} ${INDICATIVE_MARK}` : formatDCRatio(dc.ratio),
    dc.status.toUpperCase(),
  ]);
}

function addDesignChecksTable(doc: jsPDF, designResults: DesignCheckResult[], margin: number, y: number) {
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Element', 'Material', 'D/C Ratio', 'Status']],
    body: designChecksTableBody(designResults),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      // Color code the status column
      if (data.section === 'body' && data.column.index === 3) {
        const value = data.cell.raw as string;
        if (value === 'FAIL') {
          data.cell.styles.textColor = [220, 38, 38]; // Red-600
          data.cell.styles.fontStyle = 'bold';
        } else if (value === 'PASS') {
          data.cell.styles.textColor = [22, 163, 74]; // Green-600
        }
      }
      // Color code the D/C ratio
      if (data.section === 'body' && data.column.index === 2) {
        const ratio = parseFloat(data.cell.raw as string);
        if (ratio > 1.0) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (ratio > 0.9) {
          data.cell.styles.textColor = [217, 119, 6]; // Amber-600
        }
      }
    },
  });

  // Footnotes for ratios marked as indicative (screening estimates).
  const notes = indicativeReasons(designResults);
  if (notes.length === 0) return;
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = doc.internal.pageSize.getWidth() - 2 * margin;
  let noteY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105); // Slate-500
  for (const reason of notes) {
    const lines = doc.splitTextToSize(`${INDICATIVE_MARK} Indicative: ${reason}`, contentWidth);
    const height = lines.length * 3.5;
    if (noteY + height > pageHeight - 20) {
      doc.addPage();
      noteY = 20;
    }
    doc.text(lines, margin, noteY);
    noteY += height + 1.5;
  }
}

// ─── Footer ──────────────────────────────────────────────────────────

function addFooters(doc: jsPDF, projectName?: string) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Thin line
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 12, pageWidth - 20, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400

    // Left: project name
    if (projectName) {
      doc.text(projectName, 20, pageHeight - 7);
    }

    // Center: generated by
    const genText = 'Generated by Struxure';
    doc.text(genText, pageWidth / 2, pageHeight - 7, { align: 'center' });

    // Right: page number
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 7, { align: 'right' });
  }
}

// ─── Canvas screenshot capture ───────────────────────────────────────

export function captureViewportScreenshot(): string | null {
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Captures a high-quality viewport screenshot with the most interesting
 * post-analysis view (design D/C heatmap + moment diagram) from a good
 * isometric perspective. Returns a promise that resolves after the scene
 * re-renders with the desired view settings.
 */
export async function captureDesignScreenshot(): Promise<string | null> {
  // Lazy imports to avoid pulling these into the report module at top-level
  const { useUIStore } = await import(/* @vite-ignore */ '../store/ui-store');
  const { useResultsStore } = await import(/* @vite-ignore */ '../store/results-store');
  const { useModelStore } = await import(/* @vite-ignore */ '../store/model-store');

  const ui = useUIStore.getState();
  const hasResults = useResultsStore.getState().isAnalyzed;
  if (!hasResults) return captureViewportScreenshot();

  // Save current state to restore later
  const prev = {
    viewMode: ui.viewMode,
    heatmapVariable: ui.heatmapVariable,
    heatmapScheme: ui.heatmapScheme,
    diagramType: ui.diagramType,
    diagramScale: ui.diagramScale,
    showDiagramValues: ui.showDiagramValues,
    renderMode: ui.renderMode,
    showGrid: ui.showGrid,
  };

  // Switch to the most visually interesting analysis view
  ui.setViewMode('design');
  ui.setHeatmapVariable('dc_ratio');
  ui.setHeatmapScheme('jet');
  ui.setDiagramType('moment_M3');
  ui.setDiagramScale(30);
  if (ui.showDiagramValues) ui.toggleDiagramValues();
  ui.setRenderMode('sections');

  // Position camera at a good isometric perspective
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;

  // Access the Three.js scene through the R3F store
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r3fStore = (canvas as any).__r3f;
  if (r3fStore) {
    const camera = r3fStore.store?.getState()?.camera ?? r3fStore.camera;
    const controls = r3fStore.store?.getState()?.controls ?? null;

    if (camera) {
      const nodes = useModelStore.getState().nodes;
      if (nodes.length > 0) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const n of nodes) {
          minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
          minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
          minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
        }
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
        const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 20);
        const dist = size * 2.0;

        // Nice isometric-like perspective: slightly above and to the side
        camera.position.set(cx + dist * 0.65, cy + dist * 0.45, cz + dist * 0.75);
        camera.lookAt(cx, cy, cz);
        camera.updateProjectionMatrix();

        if (controls) {
          controls.target.set(cx, cy, cz);
          controls.update();
        }
      }
    }

    // Force a render
    const gl = r3fStore.store?.getState()?.gl ?? r3fStore.gl;
    const scene = r3fStore.store?.getState()?.scene ?? r3fStore.scene;
    if (gl && scene && camera) {
      gl.render(scene, camera);
    }
  }

  // Wait for React to re-render the scene with new view settings
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // Force another render to make sure everything is painted
  if (r3fStore) {
    const gl = r3fStore.store?.getState()?.gl ?? r3fStore.gl;
    const scene = r3fStore.store?.getState()?.scene ?? r3fStore.scene;
    const camera = r3fStore.store?.getState()?.camera ?? r3fStore.camera;
    if (gl && scene && camera) {
      gl.render(scene, camera);
    }
  }

  const screenshot = captureViewportScreenshot();

  // Restore previous view state
  ui.setViewMode(prev.viewMode);
  ui.setHeatmapVariable(prev.heatmapVariable);
  ui.setHeatmapScheme(prev.heatmapScheme);
  ui.setDiagramType(prev.diagramType);
  ui.setDiagramScale(prev.diagramScale);
  if (prev.showDiagramValues !== ui.showDiagramValues) ui.toggleDiagramValues();
  ui.setRenderMode(prev.renderMode);
  if (prev.showGrid !== ui.showGrid) ui.toggleGrid();

  return screenshot;
}

import type { StructuralModel, AnalysisResults } from '../core/types';
import { unitLabel, systemLabel, toDisplay } from './units';
import type { QuantityType, UnitSystem } from './units';

/**
 * Serialize a model for a saved `.json` file. Every field is written as is,
 * including optional ones such as a section's `reinforcement`, so
 * `validateModelJson` reads back the same model.
 */
export function modelToJson(model: StructuralModel): string {
  return JSON.stringify(model, null, 2);
}

export function exportModelJSON(model: StructuralModel, modelName?: string): void {
  const json = modelToJson(model);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = modelName || 'New';
  a.download = `Structural Analysis - ${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Indices of the six DOF components: 0-2 are translations or forces, 3-5 rotations or moments. */
const DOF_COMPONENTS = [0, 1, 2, 3, 4, 5];

/**
 * Builds the results CSV in display units, with the unit in every column
 * header. Rotations stay in radians in both systems.
 */
export function buildResultsCSV(results: AnalysisResults, model: StructuralModel, units: UnitSystem = 'imperial'): string {
  const u = (qty: QuantityType) => unitLabel(qty, units, { ascii: true });
  const col = (name: string, qty: QuantityType) => `${name} (${u(qty)})`;
  const forceOrMoment = (i: number): QuantityType => (i < 3 ? 'force' : 'moment');
  const lines: string[] = [];

  lines.push(`--- Units: ${systemLabel(units)} ---`);
  lines.push('');

  // Node displacements
  lines.push('--- Node Displacements ---');
  lines.push(['Node', col('ux', 'displacement'), col('uy', 'displacement'), col('uz', 'displacement'), 'rx (rad)', 'ry (rad)', 'rz (rad)'].join(','));
  for (const node of model.nodes) {
    const d = results.nodeDisplacements.get(node.id);
    if (d) {
      const values = DOF_COMPONENTS.map((i) => (i < 3 ? toDisplay(d[i], 'displacement', units) : d[i]));
      lines.push(`${node.id},${values.map((v) => v.toExponential(6)).join(',')}`);
    }
  }

  lines.push('');
  lines.push('--- Reactions ---');
  lines.push(['Node', col('Rx', 'force'), col('Ry', 'force'), col('Rz', 'force'), col('Mrx', 'moment'), col('Mry', 'moment'), col('Mrz', 'moment')].join(','));
  for (const [nodeId, r] of results.reactions) {
    lines.push(`${nodeId},${DOF_COMPONENTS.map((i) => toDisplay(r[i], forceOrMoment(i), units).toFixed(4)).join(',')}`);
  }

  lines.push('');
  // Raw end forces at node I in local axes (force the node exerts on the element),
  // the same convention as the report's start-force table: compression gives Axial > 0.
  lines.push('--- Element End Forces at Node I (local axes; Axial > 0 is compression) ---');
  lines.push(['Element', col('Axial', 'force'), col('ShearY', 'force'), col('ShearZ', 'force'), col('Torsion', 'moment'), col('MomentY', 'moment'), col('MomentZ', 'moment')].join(','));
  for (const elem of model.elements) {
    const f = results.elementForces.get(elem.id);
    if (f) {
      lines.push(`${elem.id},${DOF_COMPONENTS.map((i) => toDisplay(f.startForces[i], forceOrMoment(i), units).toFixed(4)).join(',')}`);
    }
  }

  return lines.join('\n');
}

export function exportResultsCSV(
  results: AnalysisResults,
  model: StructuralModel,
  modelName?: string,
  units: UnitSystem = 'imperial',
): void {
  const csv = buildResultsCSV(results, model, units);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = modelName || 'New';
  a.download = `Structural Analysis - ${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

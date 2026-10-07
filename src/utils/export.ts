import type { StructuralModel, AnalysisResults } from '../core/types';

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

export function exportResultsCSV(results: AnalysisResults, model: StructuralModel, modelName?: string): void {
  const lines: string[] = [];

  // Node displacements
  lines.push('--- Node Displacements ---');
  lines.push('Node,ux,uy,uz,rx,ry,rz');
  for (const node of model.nodes) {
    const d = results.nodeDisplacements.get(node.id);
    if (d) {
      lines.push(`${node.id},${d.map((v) => v.toExponential(6)).join(',')}`);
    }
  }

  lines.push('');
  lines.push('--- Reactions ---');
  lines.push('Node,Rx,Ry,Rz,Mrx,Mry,Mrz');
  for (const [nodeId, r] of results.reactions) {
    lines.push(`${nodeId},${r.map((v) => v.toFixed(4)).join(',')}`);
  }

  lines.push('');
  lines.push('--- Element Forces (Start) ---');
  lines.push('Element,Axial,ShearY,ShearZ,Torsion,MomentY,MomentZ');
  for (const elem of model.elements) {
    const f = results.elementForces.get(elem.id);
    if (f) {
      lines.push(`${elem.id},${f.startForces.map((v) => v.toFixed(4)).join(',')}`);
    }
  }

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = modelName || 'New';
  a.download = `Structural Analysis - ${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

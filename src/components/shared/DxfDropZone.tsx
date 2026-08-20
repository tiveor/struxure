import { useState, useCallback, useRef } from 'react';
import { importDxf } from '../../utils/dxf-import';
import { importIfc } from '../../utils/ifc-import';
import { useModelStore } from '../../store/model-store';
import { useUIStore } from '../../store/ui-store';
import type { DxfImportResult, DxfUnit } from '../../utils/dxf-import';
import type { IfcImportResult } from '../../utils/ifc-import';
import { IfcImportDialog } from './IfcImportDialog';

export function DxfDropZone({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<DxfImportResult | null>(null);
  const [ifcResult, setIfcResult] = useState<IfcImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [units, setUnits] = useState<DxfUnit>('inches');
  const [isLoading, setIsLoading] = useState(false);
  const dragCounter = useRef(0);

  const bulkImport = useModelStore((s) => s.bulkImport);
  const bulkImportFull = useModelStore((s) => s.bulkImportFull);
  const setModelName = useUIStore((s) => s.setModelName);

  const handleDxfFile = useCallback(async (file: File) => {
    const content = await file.text();
    const result = importDxf(content, { units });
    setImportResult(result);
    setFileName(file.name);
  }, [units]);

  const handleIfcFile = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const result = await importIfc(data);
      setIfcResult(result);
      setFileName(file.name);
    } catch (err) {
      setIfcResult({
        nodes: [],
        elements: [],
        materials: [],
        sections: [],
        warnings: [`Failed to parse IFC: ${err instanceof Error ? err.message : 'Unknown error'}`],
        stats: { beamsFound: 0, columnsFound: 0, membersFound: 0, nodesCreated: 0, elementsCreated: 0, duplicatesMerged: 0, sectionsCreated: 0, materialsFound: 0, strategy: 'physical' },
      });
      setFileName(file.name);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    const items = e.dataTransfer.items;
    if (items.length > 0 && items[0].kind === 'file') {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (ext.endsWith('.dxf')) {
      await handleDxfFile(file);
    } else if (ext.endsWith('.ifc')) {
      await handleIfcFile(file);
    }
  }, [handleDxfFile, handleIfcFile]);

  const confirmDxfImport = () => {
    if (!importResult) return;
    bulkImport(importResult.nodes, importResult.elements);
    setModelName(fileName.replace(/\.dxf$/i, ''));
    setImportResult(null);
    window.dispatchEvent(new Event('zoom-extents'));
  };

  const confirmIfcImport = () => {
    if (!ifcResult) return;
    bulkImportFull(ifcResult.nodes, ifcResult.elements, ifcResult.materials, ifcResult.sections);
    setModelName(fileName.replace(/\.ifc$/i, ''));
    setIfcResult(null);
    window.dispatchEvent(new Event('zoom-extents'));
  };

  const cancelImport = () => {
    setImportResult(null);
    setIfcResult(null);
  };

  const handleUnitsChange = (newUnits: DxfUnit) => {
    setUnits(newUnits);
  };

  return (
    <div
      className="relative w-full h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-accent/20 border-4 border-dashed border-accent flex items-center justify-center pointer-events-none">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-xl px-8 py-6 shadow-2xl border border-accent">
            <span className="material-icons-round text-accent text-5xl mb-2 block text-center">upload_file</span>
            <p className="text-xl font-bold text-white text-center">Drop file here</p>
            <p className="text-sm text-slate-400 text-center mt-1">Import from .dxf or .ifc</p>
          </div>
        </div>
      )}

      {/* Loading overlay for IFC */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 p-6 text-center">
            <span className="material-icons-round text-accent text-4xl mb-2 block animate-spin">hourglass_empty</span>
            <p className="text-white font-bold">Parsing IFC file...</p>
            <p className="text-xs text-slate-400 mt-1">Initializing WASM engine</p>
          </div>
        </div>
      )}

      {/* DXF Import confirmation dialog */}
      {importResult && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-bold text-white mb-1">Import DXF</h3>
            <p className="text-sm text-slate-400 mb-4 truncate">{fileName}</p>

            <div className="bg-slate-900 rounded-lg p-3 mb-4 space-y-1">
              <StatRow label="Lines found" value={importResult.stats.linesFound} />
              <StatRow label="Nodes created" value={importResult.stats.nodesCreated} />
              <StatRow label="Elements created" value={importResult.stats.elementsCreated} />
              {importResult.stats.duplicatesMerged > 0 && (
                <StatRow label="Duplicates merged" value={importResult.stats.duplicatesMerged} />
              )}
            </div>

            {importResult.warnings.length > 0 && (
              <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-2 mb-4 max-h-20 overflow-y-auto">
                {importResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-300">{w}</p>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <label className="text-xs text-slate-400">Units:</label>
              <select
                value={units}
                onChange={(e) => handleUnitsChange(e.target.value as DxfUnit)}
                className="bg-slate-700 text-xs text-slate-200 rounded px-2 py-1 border border-slate-600"
              >
                <option value="inches">Inches</option>
                <option value="feet">Feet</option>
                <option value="mm">Millimeters</option>
                <option value="cm">Centimeters</option>
                <option value="m">Meters</option>
              </select>
            </div>

            {importResult.layers.length > 1 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-1">Layers detected: {importResult.layers.join(', ')}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelImport}
                className="px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDxfImport}
                disabled={importResult.stats.elementsCreated === 0}
                className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import ({importResult.stats.elementsCreated} elements)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IFC Import dialog */}
      {ifcResult && (
        <IfcImportDialog
          result={ifcResult}
          fileName={fileName}
          onConfirm={confirmIfcImport}
          onCancel={cancelImport}
        />
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs text-white font-mono">{value}</span>
    </div>
  );
}

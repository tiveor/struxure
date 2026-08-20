import { useMemo } from 'react';
import * as THREE from 'three';
import type { FrameElement } from '../../core/types';
import { useModelStore } from '../../store/model-store';
import { useResultsStore } from '../../store/results-store';
import { useUIStore } from '../../store/ui-store';
import { sectionToShape } from './section-to-shape';
import { getSchemeColor, normalizeValue, getDesignColor } from '../../utils/color-ramp';

interface ElementMeshProps {
  element: FrameElement;
  viewMode: string;
}

/** Compute heatmap value for an element based on the selected variable */
function getElementHeatmapValue(
  elementId: string,
  variable: string,
  analysisResults: ReturnType<typeof useResultsStore.getState>['analysisResults'],
  designResults: ReturnType<typeof useResultsStore.getState>['designResults'],
  nodeI: string,
  nodeJ: string,
  sectionA: number,
  sectionSx: number,
): number | null {
  if (!analysisResults) return null;

  switch (variable) {
    case 'dc_ratio': {
      const dr = designResults.find((r) => r.elementId === elementId);
      return dr ? dr.ratio : null;
    }
    case 'displacement': {
      const dispI = analysisResults.nodeDisplacements.get(nodeI);
      const dispJ = analysisResults.nodeDisplacements.get(nodeJ);
      if (!dispI || !dispJ) return null;
      const magI = Math.sqrt(dispI[0] ** 2 + dispI[1] ** 2 + dispI[2] ** 2);
      const magJ = Math.sqrt(dispJ[0] ** 2 + dispJ[1] ** 2 + dispJ[2] ** 2);
      return (magI + magJ) / 2;
    }
    case 'axial_stress': {
      const forces = analysisResults.elementForces.get(elementId);
      if (!forces || sectionA === 0) return null;
      const N = Math.abs(forces.startForces[0]);
      return N / sectionA;
    }
    case 'combined_stress': {
      const forces = analysisResults.elementForces.get(elementId);
      if (!forces || sectionA === 0) return null;
      const N = Math.abs(forces.startForces[0]);
      const M = Math.abs(forces.startForces[4]); // M about strong axis
      const axial = N / sectionA;
      const bending = sectionSx > 0 ? M / sectionSx : 0;
      return axial + bending;
    }
    default:
      return null;
  }
}

export function ElementMesh({ element, viewMode }: ElementMeshProps) {
  const nodes = useModelStore((s) => s.nodes);
  const sections = useModelStore((s) => s.sections);
  const materials = useModelStore((s) => s.materials);
  const selectedElementId = useUIStore((s) => s.selectedElementId);
  const selectElement = useUIStore((s) => s.selectElement);
  const designResults = useResultsStore((s) => s.designResults);
  const analysisResults = useResultsStore((s) => s.analysisResults);
  const renderMode = useUIStore((s) => s.renderMode);
  const heatmapVariable = useUIStore((s) => s.heatmapVariable);
  const heatmapScheme = useUIStore((s) => s.heatmapScheme);

  const nodeI = nodes.find((n) => n.id === element.nodeI);
  const nodeJ = nodes.find((n) => n.id === element.nodeJ);

  const section = sections.find((s) => s.id === element.sectionId);

  const elementGeometry = useMemo(() => {
    if (!nodeI || !nodeJ) return null;

    const coords = [nodeI.x, nodeI.y, nodeI.z, nodeJ.x, nodeJ.y, nodeJ.z];
    if (coords.some((c) => !Number.isFinite(c))) return null;

    const start = new THREE.Vector3(nodeI.x, nodeI.y, nodeI.z);
    const end = new THREE.Vector3(nodeJ.x, nodeJ.y, nodeJ.z);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    if (length === 0 || !Number.isFinite(length)) return null;
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    return { start, end, direction, length, midpoint };
  }, [nodeI, nodeJ]);

  // Build extrude geometry when in sections mode
  const extrudeGeo = useMemo(() => {
    if (renderMode !== 'sections' || !elementGeometry) return null;
    if (!section) return null;

    const material = materials.find((m) => m.id === element.materialId);
    const { shape } = sectionToShape(section, material);

    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: elementGeometry.length,
      bevelEnabled: false,
    });

    geo.translate(0, 0, -elementGeometry.length / 2);
    geo.rotateX(Math.PI / 2);

    return geo;
  }, [renderMode, elementGeometry, materials, element.materialId, section]);

  if (!elementGeometry || !nodeI || !nodeJ) return null;

  const isSelected = selectedElementId === element.id;

  // Determine element color
  let color = '#94a3b8';
  if (isSelected) {
    color = '#facc15';
  } else if (viewMode === 'design') {
    // Design view deliberately takes precedence over the heatmap: it is the
    // absolute D/C band scale used for the PDF report screenshot, and a
    // reader of the report needs to interpret colours without knowing the
    // model's min/max range. The heatmap branch below stays relative and is
    // only reached from the live viewport, which never sets viewMode to 'design'.
    const dr = designResults.find((r) => r.elementId === element.id);
    if (dr) color = getDesignColor(dr.ratio);
  } else if (heatmapVariable !== 'none' && analysisResults) {
    // Heatmap coloring
    const value = getElementHeatmapValue(
      element.id, heatmapVariable,
      analysisResults, designResults,
      element.nodeI, element.nodeJ,
      section?.A ?? 1, section?.Sx ?? 1,
    );
    if (value !== null) {
      // Get global min/max from all elements for normalization
      const allValues = useModelStore.getState().elements
        .map((e) => {
          const sec = sections.find((s) => s.id === e.sectionId);
          return getElementHeatmapValue(
            e.id, heatmapVariable, analysisResults, designResults,
            e.nodeI, e.nodeJ, sec?.A ?? 1, sec?.Sx ?? 1,
          );
        })
        .filter((v): v is number => v !== null);

      const minVal = Math.min(...allValues);
      const maxVal = Math.max(...allValues);
      const t = normalizeValue(value, minVal, maxVal);
      const rgb = getSchemeColor(heatmapScheme, t);
      const c = new THREE.Color(rgb.r, rgb.g, rgb.b);
      color = `#${c.getHexString()}`;
    }
  }

  const { midpoint, direction, length } = elementGeometry;
  const orientation = new THREE.Quaternion();
  orientation.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return (
    <mesh
      position={midpoint}
      quaternion={orientation}
      onClick={(e) => {
        e.stopPropagation();
        selectElement(element.id);
      }}
    >
      {renderMode === 'sections' && extrudeGeo ? (
        <primitive object={extrudeGeo} attach="geometry" />
      ) : (
        <cylinderGeometry args={[0.5, 0.5, length, 8]} />
      )}
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

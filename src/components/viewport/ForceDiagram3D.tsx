import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useModelStore } from '../../store/model-store';
import { useResultsStore } from '../../store/results-store';
import { useUIStore } from '../../store/ui-store';
import {
  getInternalForcesDistribution,
  getMaxAbsValue,
} from '../../core/internal-forces-distribution';
import type { ElementEndForces } from '../../core/internal-forces-distribution';
import type { DiagramType } from '../../store/ui-store';

const DIAGRAM_COLORS = {
  moment_M3: { pos: '#3b82f6', neg: '#ef4444' },
  shear_V2: { pos: '#a855f7', neg: '#f59e0b' },
  axial_N: { pos: '#22c55e', neg: '#ef4444' },
};

function getForceComponent(type: DiagramType): 'N' | 'V2' | 'M3' {
  switch (type) {
    case 'moment_M3': return 'M3';
    case 'shear_V2': return 'V2';
    case 'axial_N': return 'N';
    default: return 'M3';
  }
}

export function ForceDiagram3D() {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const distributedLoads = useModelStore((s) => s.distributedLoads);
  const analysisResults = useResultsStore((s) => s.analysisResults);
  const diagramType = useUIStore((s) => s.diagramType);
  const diagramScale = useUIStore((s) => s.diagramScale);
  const showDiagramValues = useUIStore((s) => s.showDiagramValues);

  const diagramData = useMemo(() => {
    if (!analysisResults || diagramType === 'none') return null;

    const component = getForceComponent(diagramType);
    const allDistributions: Array<{
      elementId: string;
      points: Array<{ x: number; N: number; V2: number; M3: number }>;
      start: THREE.Vector3;
      end: THREE.Vector3;
    }> = [];

    // Compute distributions for all elements
    for (const elem of elements) {
      const nodeI = nodes.find((n) => n.id === elem.nodeI);
      const nodeJ = nodes.find((n) => n.id === elem.nodeJ);
      if (!nodeI || !nodeJ) continue;

      const forces = analysisResults.elementForces.get(elem.id);
      if (!forces) continue;

      const start = new THREE.Vector3(nodeI.x, nodeI.y, nodeI.z);
      const end = new THREE.Vector3(nodeJ.x, nodeJ.y, nodeJ.z);
      const L = start.distanceTo(end);
      if (L < 0.001) continue;

      // Extract end forces: [N, V2, V3, T, M2, M3]
      const endForces: ElementEndForces = {
        Ni: forces.startForces[0],
        V2i: forces.startForces[1],
        M3i: forces.startForces[5],
      };

      const dl = distributedLoads.find((d) => d.elementId === elem.id);
      const wy = dl?.wy ?? 0;

      const points = getInternalForcesDistribution(L, endForces, wy, 20);
      allDistributions.push({ elementId: elem.id, points, start, end });
    }

    // Find global max for normalization
    let globalMax = 0;
    for (const dist of allDistributions) {
      const maxVal = getMaxAbsValue(dist.points, component);
      globalMax = Math.max(globalMax, maxVal);
    }

    return { distributions: allDistributions, globalMax, component };
  }, [analysisResults, elements, nodes, distributedLoads, diagramType]);

  if (!diagramData || diagramData.globalMax === 0) return null;

  const { distributions, globalMax, component } = diagramData;
  const colors = DIAGRAM_COLORS[diagramType as keyof typeof DIAGRAM_COLORS] ?? DIAGRAM_COLORS.moment_M3;

  return (
    <group>
      {distributions.map((dist) => (
        <ElementDiagram
          key={dist.elementId}
          points={dist.points}
          start={dist.start}
          end={dist.end}
          component={component}
          globalMax={globalMax}
          scale={diagramScale}
          colors={colors}
          showValues={showDiagramValues}
        />
      ))}
    </group>
  );
}

interface ElementDiagramProps {
  points: Array<{ x: number; N: number; V2: number; M3: number }>;
  start: THREE.Vector3;
  end: THREE.Vector3;
  component: 'N' | 'V2' | 'M3';
  globalMax: number;
  scale: number;
  colors: { pos: string; neg: string };
  showValues: boolean;
}

function ElementDiagram({
  points, start, end, component, globalMax, scale, colors, showValues,
}: ElementDiagramProps) {
  const { geometry, maxPoint, maxWorldPos } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const L = direction.length();
    const axisDir = direction.clone().normalize();

    // Find a perpendicular direction for the diagram offset
    const up = new THREE.Vector3(0, 1, 0);
    let perpDir = new THREE.Vector3().crossVectors(axisDir, up);
    if (perpDir.length() < 0.001) {
      perpDir = new THREE.Vector3().crossVectors(axisDir, new THREE.Vector3(1, 0, 0));
    }
    perpDir.normalize();

    const positions: number[] = [];
    const vertColors: number[] = [];
    const indices: number[] = [];

    // Create ribbon: for each point, two vertices (on axis and offset)
    for (let i = 0; i < points.length; i++) {
      const t = points[i].x / L;
      const value = points[i][component];
      const normalizedOffset = (value / globalMax) * scale;

      // Point on axis
      const axisPoint = new THREE.Vector3().lerpVectors(start, end, t);
      // Point offset perpendicular
      const offsetPoint = axisPoint.clone().addScaledVector(perpDir, normalizedOffset);

      positions.push(axisPoint.x, axisPoint.y, axisPoint.z);
      positions.push(offsetPoint.x, offsetPoint.y, offsetPoint.z);

      // Color based on sign
      const isPositive = value >= 0;
      const c = new THREE.Color(isPositive ? colors.pos : colors.neg);
      vertColors.push(c.r, c.g, c.b);
      vertColors.push(c.r, c.g, c.b);
    }

    // Create triangle indices
    for (let i = 0; i < points.length - 1; i++) {
      const base = i * 2;
      // Two triangles per quad
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(vertColors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // Find max absolute value for label
    let maxIdx = 0;
    let maxAbsVal = 0;
    for (let i = 0; i < points.length; i++) {
      const absVal = Math.abs(points[i][component]);
      if (absVal > maxAbsVal) {
        maxAbsVal = absVal;
        maxIdx = i;
      }
    }
    const maxPt = points[maxIdx];
    const tMax = maxPt.x / L;
    const maxAxisPoint = new THREE.Vector3().lerpVectors(start, end, tMax);
    const maxWorldPosition = maxAxisPoint.clone().addScaledVector(
      perpDir, (maxPt[component] / globalMax) * scale * 1.2,
    );

    return {
      geometry: geo,
      maxPoint: maxPt,
      maxWorldPos: maxWorldPosition,
    };
  }, [points, start, end, component, globalMax, scale, colors]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </mesh>
      {showValues && Math.abs(maxPoint[component]) > 0.01 && (
        <Html position={maxWorldPos} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="bg-slate-900/90 px-1.5 py-0.5 rounded text-[10px] font-mono text-white whitespace-nowrap border border-slate-600">
            {maxPoint[component].toFixed(1)}
          </div>
        </Html>
      )}
    </group>
  );
}

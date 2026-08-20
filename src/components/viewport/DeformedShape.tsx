import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useModelStore } from '../../store/model-store';
import { useResultsStore } from '../../store/results-store';
import { useUIStore } from '../../store/ui-store';
import { getAnimationFactor, getDeformationColor, interpolatePosition } from '../../utils/animation';

interface DeformedShapeProps {
  viewMode: string;
}

function getDiagramColor(viewMode: string): string {
  switch (viewMode) {
    case 'axial': return '#f97316';
    case 'shear': return '#a855f7';
    case 'moment': return '#ec4899';
    default: return '#38bdf8';
  }
}

export function DeformedShape({ viewMode }: DeformedShapeProps) {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const analysisResults = useResultsStore((s) => s.analysisResults);
  const scale = useUIStore((s) => s.deformationScale);
  const animating = useUIStore((s) => s.animating);
  const animationSpeed = useUIStore((s) => s.animationSpeed);
  const animationMode = useUIStore((s) => s.animationMode);

  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const materialRefs = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  // Precompute static data: original positions, displacements, max displacement
  const elementData = useMemo(() => {
    if (!analysisResults) return null;

    let maxDispMag = 0;

    const data = elements.map((elem) => {
      const nodeI = nodes.find((n) => n.id === elem.nodeI);
      const nodeJ = nodes.find((n) => n.id === elem.nodeJ);
      if (!nodeI || !nodeJ) return null;

      const dispI = analysisResults.nodeDisplacements.get(elem.nodeI);
      const dispJ = analysisResults.nodeDisplacements.get(elem.nodeJ);
      if (!dispI || !dispJ) return null;

      const dispMagI = Math.sqrt(dispI[0] ** 2 + dispI[1] ** 2 + dispI[2] ** 2);
      const dispMagJ = Math.sqrt(dispJ[0] ** 2 + dispJ[1] ** 2 + dispJ[2] ** 2);
      const avgDispMag = (dispMagI + dispMagJ) / 2;
      maxDispMag = Math.max(maxDispMag, avgDispMag);

      return {
        id: elem.id,
        origI: { x: nodeI.x, y: nodeI.y, z: nodeI.z },
        origJ: { x: nodeJ.x, y: nodeJ.y, z: nodeJ.z },
        dispI: { x: dispI[0], y: dispI[1], z: dispI[2] },
        dispJ: { x: dispJ[0], y: dispJ[1], z: dispJ[2] },
        avgDispMag,
      };
    }).filter(Boolean) as Array<{
      id: string;
      origI: { x: number; y: number; z: number };
      origJ: { x: number; y: number; z: number };
      dispI: { x: number; y: number; z: number };
      dispJ: { x: number; y: number; z: number };
      avgDispMag: number;
    }>;

    return { data, maxDispMag };
  }, [nodes, elements, analysisResults]);

  // Animation loop - updates mesh positions and colors every frame
  useFrame((_, delta) => {
    if (!elementData || !groupRef.current) return;

    if (animating) {
      timeRef.current += delta;
    }

    const t = animating
      ? getAnimationFactor(animationMode, timeRef.current, animationSpeed)
      : 1; // When not animating, show fully deformed

    const { data, maxDispMag } = elementData;

    for (const elem of data) {
      const mesh = meshRefs.current.get(elem.id);
      const mat = materialRefs.current.get(elem.id);
      if (!mesh) continue;

      const startPos = interpolatePosition(elem.origI, elem.dispI, scale, t);
      const endPos = interpolatePosition(elem.origJ, elem.dispJ, scale, t);

      const start = new THREE.Vector3(startPos.x, startPos.y, startPos.z);
      const end = new THREE.Vector3(endPos.x, endPos.y, endPos.z);
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

      mesh.position.copy(midpoint);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
      );
      mesh.scale.set(1, length > 0 ? length / 1 : 0.001, 1);

      // Dynamic color when animating
      if (animating && mat) {
        const color = getDeformationColor(elem.avgDispMag * t, 0, maxDispMag);
        mat.color.setRGB(color.r, color.g, color.b);
      }
    }
  });

  if (!analysisResults || !elementData) return null;

  const staticColor = getDiagramColor(viewMode);

  return (
    <group ref={groupRef}>
      {elementData.data.map((elem) => {
        // Initial static computation for first render
        const startPos = interpolatePosition(elem.origI, elem.dispI, scale, 1);
        const endPos = interpolatePosition(elem.origJ, elem.dispJ, scale, 1);
        const start = new THREE.Vector3(startPos.x, startPos.y, startPos.z);
        const end = new THREE.Vector3(endPos.x, endPos.y, endPos.z);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );

        return (
          <mesh
            key={elem.id}
            ref={(ref) => {
              if (ref) meshRefs.current.set(elem.id, ref);
            }}
            position={midpoint}
            quaternion={quaternion}
            scale={[1, length, 1]}
          >
            <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
            <meshStandardMaterial
              ref={(ref) => {
                if (ref) materialRefs.current.set(elem.id, ref);
              }}
              color={animating ? '#00ff00' : staticColor}
              opacity={0.8}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}

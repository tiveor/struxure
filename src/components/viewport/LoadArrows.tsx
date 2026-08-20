import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { NodalLoad } from '../../core/types';
import { useModelStore } from '../../store/model-store';

interface LoadArrowsProps {
  load: NodalLoad;
}

export function LoadArrows({ load }: LoadArrowsProps) {
  const nodes = useModelStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === load.nodeId);
  if (!node) return null;

  const arrows: ReactNode[] = [];
  const forces = [
    { value: load.fx, dir: [1, 0, 0] as [number, number, number], label: 'Fx' },
    { value: load.fy, dir: [0, 1, 0] as [number, number, number], label: 'Fy' },
    { value: load.fz, dir: [0, 0, 1] as [number, number, number], label: 'Fz' },
  ];

  const scale = 8; // Arrow visual length factor

  for (const f of forces) {
    if (Math.abs(f.value) < 1e-10) continue;

    const sign = f.value > 0 ? 1 : -1;
    const direction = new THREE.Vector3(...f.dir).multiplyScalar(sign);
    const origin = new THREE.Vector3(node.x, node.y, node.z)
      .add(direction.clone().multiplyScalar(-scale));

    // Arrow shaft
    const endPos = new THREE.Vector3(node.x, node.y, node.z);
    const midpoint = new THREE.Vector3().addVectors(origin, endPos).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );

    arrows.push(
      <group key={f.label}>
        {/* Shaft */}
        <mesh position={midpoint} quaternion={quaternion}>
          <cylinderGeometry args={[0.3, 0.3, scale * 0.8, 6]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        {/* Arrowhead */}
        <mesh position={[node.x, node.y, node.z]} quaternion={quaternion}>
          <coneGeometry args={[0.8, 2, 6]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>
    );
  }

  return <group>{arrows}</group>;
}

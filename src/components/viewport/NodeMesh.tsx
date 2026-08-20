import { useRef } from 'react';
import type { Mesh } from 'three';
import type { StructuralNode } from '../../core/types';
import { useUIStore } from '../../store/ui-store';
import { Html } from '@react-three/drei';

interface NodeMeshProps {
  node: StructuralNode;
}

export function NodeMesh({ node }: NodeMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const selectNode = useUIStore((s) => s.selectNode);
  const showLabels = useUIStore((s) => s.showNodeLabels);

  const isSelected = selectedNodeId === node.id;
  const color = isSelected ? '#facc15' : '#60a5fa';

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          selectNode(node.id);
        }}
      >
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {showLabels && (
        <Html distanceFactor={200} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="text-xs text-blue-300 bg-slate-900/80 px-1 rounded whitespace-nowrap">
            {node.id}
          </div>
        </Html>
      )}
    </group>
  );
}

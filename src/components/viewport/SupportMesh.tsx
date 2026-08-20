import type { Support } from '../../core/types';
import { useModelStore } from '../../store/model-store';

interface SupportMeshProps {
  support: Support;
}

export function SupportMesh({ support }: SupportMeshProps) {
  const nodes = useModelStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === support.nodeId);
  if (!node) return null;

  const isFixed = support.dx && support.dy && support.dz && support.rx && support.ry && support.rz;
  const isPin = support.dx && support.dy && support.dz && !support.rx && !support.ry && !support.rz;

  const pos: [number, number, number] = [node.x, node.y, node.z];

  if (isFixed) {
    // Fixed support: box
    return (
      <mesh position={[pos[0], pos[1] - 2, pos[2]]}>
        <boxGeometry args={[4, 2, 4]} />
        <meshStandardMaterial color="#f59e0b" opacity={0.7} transparent />
      </mesh>
    );
  }

  if (isPin) {
    // Pin support: cone (triangle)
    return (
      <mesh position={[pos[0], pos[1] - 2.5, pos[2]]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[2.5, 4, 3]} />
        <meshStandardMaterial color="#10b981" opacity={0.7} transparent />
      </mesh>
    );
  }

  // Roller or partial: small sphere
  return (
    <group position={pos}>
      <mesh position={[0, -2, 0]}>
        <coneGeometry args={[2, 3, 3]} />
        <meshStandardMaterial color="#06b6d4" opacity={0.7} transparent />
      </mesh>
      <mesh position={[0, -4, 0]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#06b6d4" />
      </mesh>
    </group>
  );
}

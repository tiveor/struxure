import { NodeMesh } from './NodeMesh';
import { ElementMesh } from './ElementMesh';
import { LoadArrows } from './LoadArrows';
import { DeformedShape } from './DeformedShape';
import { ForceDiagram3D } from './ForceDiagram3D';
import { SupportMesh } from './SupportMesh';
import { useModelStore } from '../../store/model-store';
import type { ViewMode } from '../../store/ui-store';

export function SceneContent({
  viewMode,
  showForceDiagrams = true,
}: {
  viewMode: ViewMode;
  showForceDiagrams?: boolean;
}) {
  const nodes = useModelStore((s) => s.nodes);
  const elements = useModelStore((s) => s.elements);
  const supports = useModelStore((s) => s.supports);
  const nodalLoads = useModelStore((s) => s.nodalLoads);

  const showDeformed = viewMode === 'deformed' || viewMode === 'moment' || viewMode === 'shear' || viewMode === 'axial';

  return (
    <>
      {nodes.map((node) => (
        <NodeMesh key={node.id} node={node} />
      ))}

      {elements.map((element) => (
        <ElementMesh key={element.id} element={element} viewMode={viewMode} />
      ))}

      {supports.map((support) => (
        <SupportMesh key={support.nodeId} support={support} />
      ))}

      {nodalLoads.map((load) => (
        <LoadArrows key={load.id} load={load} />
      ))}

      {showDeformed && <DeformedShape viewMode={viewMode} />}
      {showForceDiagrams && <ForceDiagram3D />}
    </>
  );
}

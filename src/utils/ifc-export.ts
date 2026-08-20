/**
 * Export structural model and analysis results to an IFC file.
 * Creates an IFC4 file with IfcStructuralAnalysisModel containing
 * IfcStructuralCurveMember and IfcStructuralPointConnection entities.
 */
import type { StructuralModel, AnalysisResults } from '../core/types';

// ─── IFC step file text builder ──────────────────────────────────────
// Since web-ifc's CreateModel/WriteLine API operates at a very low level,
// we build the IFC-SPF text directly — this is the most reliable approach
// for generating valid, readable IFC files.

export async function exportResultsToIfc(
  model: StructuralModel,
  results: AnalysisResults | null,
): Promise<Uint8Array<ArrayBuffer>> {
  const lines: string[] = [];
  let nextId = 1;
  const id = () => nextId++;

  // ─── HEADER ────────────────────────────────────────────
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push("FILE_DESCRIPTION(('Struxure Structural Analysis Export'),'2;1');");
  lines.push(`FILE_NAME('struxure-export.ifc','${new Date().toISOString()}',('Struxure'),(''),'',' ','');`);
  lines.push("FILE_SCHEMA(('IFC4'));");
  lines.push('ENDSEC;');
  lines.push('DATA;');

  // ─── Basic project structure ───────────────────────────
  const personId = id();
  lines.push(`#${personId}=IFCPERSON($,$,'Struxure',$,$,$,$,$);`);

  const orgId = id();
  lines.push(`#${orgId}=IFCORGANIZATION($,'Struxure','Structural Analysis App',$,$);`);

  const personOrgId = id();
  lines.push(`#${personOrgId}=IFCPERSONANDORGANIZATION(#${personId},#${orgId},$);`);

  const appId = id();
  lines.push(`#${appId}=IFCAPPLICATION(#${orgId},'2.0','Struxure','STRUXURE');`);

  const ownerHistoryId = id();
  lines.push(`#${ownerHistoryId}=IFCOWNERHISTORY(#${personOrgId},#${appId},$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)});`);

  // Geometric context
  const originId = id();
  lines.push(`#${originId}=IFCCARTESIANPOINT((0.,0.,0.));`);

  const dirZId = id();
  lines.push(`#${dirZId}=IFCDIRECTION((0.,0.,1.));`);

  const dirXId = id();
  lines.push(`#${dirXId}=IFCDIRECTION((1.,0.,0.));`);

  const axisPlacementId = id();
  lines.push(`#${axisPlacementId}=IFCAXIS2PLACEMENT3D(#${originId},#${dirZId},#${dirXId});`);

  const contextId = id();
  lines.push(`#${contextId}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#${axisPlacementId},$);`);

  // Unit assignment (inches)
  const lengthUnitId = id();
  lines.push(`#${lengthUnitId}=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);`);

  const forceUnitId = id();
  lines.push(`#${forceUnitId}=IFCSIUNIT(*,.FORCEUNIT.,$,.NEWTON.);`);

  const unitAssignId = id();
  lines.push(`#${unitAssignId}=IFCUNITASSIGNMENT((#${lengthUnitId},#${forceUnitId}));`);

  // Project
  const projectId = id();
  lines.push(`#${projectId}=IFCPROJECT('${generateGuid()}',#${ownerHistoryId},'Struxure Export',$,$,$,$,(#${contextId}),#${unitAssignId});`);

  // Site → Building
  const siteId = id();
  lines.push(`#${siteId}=IFCSITE('${generateGuid()}',#${ownerHistoryId},'Site',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);`);

  const buildingId = id();
  lines.push(`#${buildingId}=IFCBUILDING('${generateGuid()}',#${ownerHistoryId},'Building',$,$,$,$,$,.ELEMENT.,$,$,$);`);

  // Aggregation relationships
  const relSiteId = id();
  lines.push(`#${relSiteId}=IFCRELAGGREGATES('${generateGuid()}',#${ownerHistoryId},$,$,#${projectId},(#${siteId}));`);

  const relBuildingId = id();
  lines.push(`#${relBuildingId}=IFCRELAGGREGATES('${generateGuid()}',#${ownerHistoryId},$,$,#${siteId},(#${buildingId}));`);

  // ─── Structural Analysis Model ─────────────────────────
  const analysisModelId = id();
  lines.push(`#${analysisModelId}=IFCSTRUCTURALANALYSISMODEL('${generateGuid()}',#${ownerHistoryId},'Analysis Model','Struxure FEA Results',$,$,$,.LOADING_3D.,$);`);

  // ─── Nodes → IfcStructuralPointConnection ──────────────
  const nodeIdMap = new Map<string, number>();

  for (const node of model.nodes) {
    // Convert inches to mm for IFC
    const mmX = node.x * 25.4;
    const mmY = node.y * 25.4;
    const mmZ = node.z * 25.4;

    const ptId = id();
    lines.push(`#${ptId}=IFCCARTESIANPOINT((${mmX.toFixed(4)},${mmY.toFixed(4)},${mmZ.toFixed(4)}));`);

    const placementId = id();
    lines.push(`#${placementId}=IFCAXIS2PLACEMENT3D(#${ptId},$,$);`);

    const localPlacementId = id();
    lines.push(`#${localPlacementId}=IFCLOCALPLACEMENT($,#${placementId});`);

    const connectionId = id();
    lines.push(`#${connectionId}=IFCSTRUCTURALPOINTCONNECTION('${generateGuid()}',#${ownerHistoryId},'${node.id}','Node ${node.id}',$,#${localPlacementId},$,$);`);

    nodeIdMap.set(node.id, connectionId);

    // Add boundary conditions for supported nodes
    const support = model.supports.find((s) => s.nodeId === node.id);
    if (support) {
      const bcId = id();
      const dx = support.dx ? 0.0 : -1.0; // 0 = fixed, -1 = free (IFC convention: value or $)
      const dy = support.dy ? 0.0 : -1.0;
      const dz = support.dz ? 0.0 : -1.0;
      const rx = support.rx ? 0.0 : -1.0;
      const ry = support.ry ? 0.0 : -1.0;
      const rz = support.rz ? 0.0 : -1.0;
      lines.push(`#${bcId}=IFCBOUNDARYNODECONDITION('Support ${node.id}',${dx === 0 ? '0.' : '$'},${dy === 0 ? '0.' : '$'},${dz === 0 ? '0.' : '$'},${rx === 0 ? '0.' : '$'},${ry === 0 ? '0.' : '$'},${rz === 0 ? '0.' : '$'});`);

      // Update connection with boundary condition
      // Re-write the connection line with the boundary condition
      const idx = lines.findIndex((l) => l.startsWith(`#${connectionId}=`));
      if (idx >= 0) {
        lines[idx] = `#${connectionId}=IFCSTRUCTURALPOINTCONNECTION('${generateGuid()}',#${ownerHistoryId},'${node.id}','Node ${node.id} (supported)',$,#${localPlacementId},$,#${bcId});`;
      }
    }
  }

  // ─── Elements → IfcStructuralCurveMember ───────────────
  const memberIds: number[] = [];

  for (const elem of model.elements) {
    const nodeI = model.nodes.find((n) => n.id === elem.nodeI);
    const nodeJ = model.nodes.find((n) => n.id === elem.nodeJ);
    if (!nodeI || !nodeJ) continue;

    // Create edge curve (polyline from nodeI to nodeJ)
    const pt1Id = id();
    lines.push(`#${pt1Id}=IFCCARTESIANPOINT((${(nodeI.x * 25.4).toFixed(4)},${(nodeI.y * 25.4).toFixed(4)},${(nodeI.z * 25.4).toFixed(4)}));`);

    const pt2Id = id();
    lines.push(`#${pt2Id}=IFCCARTESIANPOINT((${(nodeJ.x * 25.4).toFixed(4)},${(nodeJ.y * 25.4).toFixed(4)},${(nodeJ.z * 25.4).toFixed(4)}));`);

    const polylineId = id();
    lines.push(`#${polylineId}=IFCPOLYLINE((#${pt1Id},#${pt2Id}));`);

    const topologyRepId = id();
    lines.push(`#${topologyRepId}=IFCTOPOLOGYREPRESENTATION(#${contextId},'Reference','Edge',(#${polylineId}));`);

    const prodDefShapeId = id();
    lines.push(`#${prodDefShapeId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${topologyRepId}));`);

    const placementId = id();
    lines.push(`#${placementId}=IFCLOCALPLACEMENT($,#${axisPlacementId});`);

    const memberId = id();
    lines.push(`#${memberId}=IFCSTRUCTURALCURVEMEMBER('${generateGuid()}',#${ownerHistoryId},'${elem.id}','Element ${elem.id} (${elem.sectionId})',$,#${placementId},#${prodDefShapeId},.RIGID_JOINED_MEMBER.,$);`);
    memberIds.push(memberId);

    // Connect member to nodes
    const nodeIIfcId = nodeIdMap.get(elem.nodeI);
    const nodeJIfcId = nodeIdMap.get(elem.nodeJ);

    if (nodeIIfcId) {
      const relI = id();
      lines.push(`#${relI}=IFCRELCONNECTSSTRUCTURALMEMBER('${generateGuid()}',#${ownerHistoryId},$,$,#${memberId},#${nodeIIfcId},$,$,$,$);`);
    }
    if (nodeJIfcId) {
      const relJ = id();
      lines.push(`#${relJ}=IFCRELCONNECTSSTRUCTURALMEMBER('${generateGuid()}',#${ownerHistoryId},$,$,#${memberId},#${nodeJIfcId},$,$,$,$);`);
    }
  }

  // Group all structural items into the analysis model
  const allStructuralIds = [...nodeIdMap.values(), ...memberIds];
  if (allStructuralIds.length > 0) {
    const groupRelId = id();
    const refs = allStructuralIds.map((sid) => `#${sid}`).join(',');
    lines.push(`#${groupRelId}=IFCRELASSIGNSTOGROUP('${generateGuid()}',#${ownerHistoryId},$,$,(${refs}),$,#${analysisModelId});`);
  }

  // ─── Results (if available) ────────────────────────────
  if (results) {
    const resultGroupId = id();
    lines.push(`#${resultGroupId}=IFCSTRUCTURALRESULTGROUP('${generateGuid()}',#${ownerHistoryId},'Results','Struxure Analysis Results',$,.LINEAR.,$);`);

    // Add reactions as IfcStructuralPointReaction
    for (const [nodeId, reaction] of results.reactions) {
      const connId = nodeIdMap.get(nodeId);
      if (!connId) continue;

      // Convert forces from kip to N (1 kip = 4448.22 N)
      const fN = reaction.map((v) => v * 4448.22);

      const loadId = id();
      lines.push(`#${loadId}=IFCSTRUCTURALLOADSINGLEFORCE('Reaction ${nodeId}',${fN[0].toFixed(2)},${fN[1].toFixed(2)},${fN[2].toFixed(2)},${fN[3].toFixed(2)},${fN[4].toFixed(2)},${fN[5].toFixed(2)});`);

      const reactionId = id();
      lines.push(`#${reactionId}=IFCSTRUCTURALPOINTREACTION('${generateGuid()}',#${ownerHistoryId},'Reaction ${nodeId}',$,$,$,$,#${loadId},.GLOBAL_COORDS.,$);`);

      // Link to connection
      const relActId = id();
      lines.push(`#${relActId}=IFCRELCONNECTSSTRUCTURALACTIVITY('${generateGuid()}',#${ownerHistoryId},$,$,#${connId},#${reactionId});`);
    }
  }

  // ─── END ───────────────────────────────────────────────
  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  const text = lines.join('\n');
  return new TextEncoder().encode(text);
}

// ─── IFC GUID generator ──────────────────────────────────────────────
// IFC uses a base64-like encoding of a 128-bit UUID for GlobalId.

function generateGuid(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let result = '';
  for (let i = 0; i < 22; i++) {
    result += chars[Math.floor(Math.random() * 64)];
  }
  return result;
}

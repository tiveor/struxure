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

/**
 * Encodes a value for a STEP (ISO 10303-21) string literal.
 *
 * `'` doubles to `''` and `\` doubles to `\\`; characters outside printable
 * ASCII are hex-escaped the way IFC readers expect: `\X\HH` for the Latin-1
 * upper half, a `\X2\HHHH…\X0\` block for the rest of the BMP, and `\X4\` for
 * supplementary planes.
 *
 * Section names are free-form text — typed into SectionEditor or copied
 * verbatim from imported IFC profile names — so a name like `Owner's W12`
 * would otherwise close the string early and produce an unparseable file.
 * Applied to every model-derived string written into the file.
 */
export function escapeStep(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.codePointAt(i)!;
    if (code > 0xffff) i++; // astral chars occupy a surrogate pair

    if (code === 0x27) {
      out += "''"; // '
    } else if (code === 0x5c) {
      out += '\\\\'; // \
    } else if (code >= 0x20 && code <= 0x7e) {
      out += String.fromCodePoint(code);
    } else if (code <= 0xff) {
      out += `\\X\\${code.toString(16).toUpperCase().padStart(2, '0')}`;
    } else {
      // Group a run of same-plane characters into one \X2\ / \X4\ block.
      const width = code > 0xffff ? 8 : 4;
      let run = code.toString(16).toUpperCase().padStart(width, '0');
      while (i + 1 < value.length) {
        const next = value.codePointAt(i + 1)!;
        if (next <= 0xff || (next > 0xffff) !== (width === 8)) break;
        run += next.toString(16).toUpperCase().padStart(width, '0');
        i += next > 0xffff ? 2 : 1;
      }
      out += `\\X${width === 8 ? '4' : '2'}\\${run}\\X0\\`;
    }
  }
  return out;
}

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
    lines.push(`#${connectionId}=IFCSTRUCTURALPOINTCONNECTION('${generateGuid()}',#${ownerHistoryId},'${escapeStep(node.id)}','${escapeStep(`Node ${node.id}`)}',$,#${localPlacementId},$,$);`);

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
      lines.push(`#${bcId}=IFCBOUNDARYNODECONDITION('${escapeStep(`Support ${node.id}`)}',${dx === 0 ? '0.' : '$'},${dy === 0 ? '0.' : '$'},${dz === 0 ? '0.' : '$'},${rx === 0 ? '0.' : '$'},${ry === 0 ? '0.' : '$'},${rz === 0 ? '0.' : '$'});`);

      // Update connection with boundary condition
      // Re-write the connection line with the boundary condition
      const idx = lines.findIndex((l) => l.startsWith(`#${connectionId}=`));
      if (idx >= 0) {
        lines[idx] = `#${connectionId}=IFCSTRUCTURALPOINTCONNECTION('${generateGuid()}',#${ownerHistoryId},'${escapeStep(node.id)}','${escapeStep(`Node ${node.id} (supported)`)}',$,#${localPlacementId},$,#${bcId});`;
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
    const sectionName = model.sections.find((s) => s.id === elem.sectionId)?.name ?? elem.sectionId;
    lines.push(`#${memberId}=IFCSTRUCTURALCURVEMEMBER('${generateGuid()}',#${ownerHistoryId},'${escapeStep(elem.id)}','${escapeStep(`Element ${elem.id} (${sectionName})`)}',$,#${placementId},#${prodDefShapeId},.RIGID_JOINED_MEMBER.,$);`);
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
      lines.push(`#${loadId}=IFCSTRUCTURALLOADSINGLEFORCE('${escapeStep(`Reaction ${nodeId}`)}',${fN[0].toFixed(2)},${fN[1].toFixed(2)},${fN[2].toFixed(2)},${fN[3].toFixed(2)},${fN[4].toFixed(2)},${fN[5].toFixed(2)});`);

      const reactionId = id();
      lines.push(`#${reactionId}=IFCSTRUCTURALPOINTREACTION('${generateGuid()}',#${ownerHistoryId},'${escapeStep(`Reaction ${nodeId}`)}',$,$,$,$,#${loadId},.GLOBAL_COORDS.,$);`);

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

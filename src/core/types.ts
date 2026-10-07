/** 3D node in the structural model */
export interface StructuralNode {
  id: string;
  x: number;
  y: number;
  z: number;
}

/** Material types supported in MVP */
export type MaterialType = 'steel' | 'concrete';

/** Material properties */
export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  E: number;       // Modulus of elasticity
  G: number;       // Shear modulus
  density: number;  // Density
  fy?: number;     // Yield strength (steel)
  fu?: number;     // Ultimate strength (steel)
  fc?: number;     // Compressive strength (concrete)
}

/** Cross-section properties */
export interface Section {
  id: string;
  name: string;
  A: number;       // Cross-sectional area
  Ix: number;      // Moment of inertia about strong axis
  Iy: number;      // Moment of inertia about weak axis
  J: number;       // Torsional constant
  Sx?: number;     // Elastic section modulus (strong)
  Sy?: number;     // Elastic section modulus (weak)
  Zx?: number;     // Plastic section modulus (strong)
  Zy?: number;     // Plastic section modulus (weak)
  rx?: number;     // Radius of gyration (strong)
  ry?: number;     // Radius of gyration (weak)
  d?: number;      // Depth of section
  bf?: number;     // Flange width
  tf?: number;     // Flange thickness
  tw?: number;     // Web thickness
  b?: number;      // Width (concrete)
  h?: number;      // Height (concrete)
  /**
   * Longitudinal reinforcement of a rectangular concrete section (b x h).
   * Optional: without it the ACI column check falls back to an indicative
   * screening estimate.
   */
  reinforcement?: ColumnReinforcement;
}

/**
 * Perimeter reinforcement of a rectangular b x h concrete section.
 *
 * `barsAlongB` bars sit along each of the two faces of width b and
 * `barsAlongH` along each of the two faces of depth h. Both counts include
 * the corner bars, so there are 2*barsAlongB + 2*barsAlongH - 4 bars, all of
 * one size, symmetric about both axes.
 */
export interface ColumnReinforcement {
  /** Clear cover from the concrete face to the ties (in) */
  cover: number;
  /** Longitudinal bar designation, 3 to 11 (#3 to #11) */
  barSize: number;
  /** Bars along each face of width b, corners included (>= 2) */
  barsAlongB: number;
  /** Bars along each face of depth h, corners included (>= 2) */
  barsAlongH: number;
  /** Tie bar designation, 3 to 5 (#3 to #5) */
  tieSize: number;
  /** Rebar yield strength (ksi); 60 when omitted */
  fy?: number;
}

/** Frame element connecting two nodes */
export interface FrameElement {
  id: string;
  nodeI: string;  // Start node ID
  nodeJ: string;  // End node ID
  materialId: string;
  sectionId: string;
  /** Rotation angle (degrees) of local axes about element longitudinal axis */
  betaAngle: number;
}

/** Support / boundary condition for a node */
export interface Support {
  nodeId: string;
  dx: boolean;   // Restrain translation X
  dy: boolean;   // Restrain translation Y
  dz: boolean;   // Restrain translation Z
  rx: boolean;   // Restrain rotation X
  ry: boolean;   // Restrain rotation Y
  rz: boolean;   // Restrain rotation Z
}

/** Nodal load applied directly to a node */
export interface NodalLoad {
  id: string;
  nodeId: string;
  fx: number;  // Force X
  fy: number;  // Force Y
  fz: number;  // Force Z
  mx: number;  // Moment X
  my: number;  // Moment Y
  mz: number;  // Moment Z
}

/** Uniform distributed load on an element (in local coordinates) */
export interface DistributedLoad {
  id: string;
  elementId: string;
  wx: number;  // Load in local x (axial)
  wy: number;  // Load in local y
  wz: number;  // Load in local z
}

/** Complete structural model */
export interface StructuralModel {
  nodes: StructuralNode[];
  elements: FrameElement[];
  materials: Material[];
  sections: Section[];
  supports: Support[];
  nodalLoads: NodalLoad[];
  distributedLoads: DistributedLoad[];
}

/** Degrees of freedom per node */
export const DOF_PER_NODE = 6;

/** Analysis results for the complete model */
export interface AnalysisResults {
  displacements: number[];
  reactions: Map<string, number[]>;
  elementForces: Map<string, { startForces: number[]; endForces: number[] }>;
  nodeDisplacements: Map<string, number[]>;
}

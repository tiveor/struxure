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

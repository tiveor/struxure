export interface DesignCheckResult {
  elementId: string;
  material: 'steel' | 'concrete';
  ratio: number;
  status: 'pass' | 'fail';
  details: Record<string, number>;
}

export interface SteelDesignResult extends DesignCheckResult {
  material: 'steel';
  details: {
    tensionRatio: number;
    compressionRatio: number;
    flexureRatio: number;
    combinedRatio: number;
    governingCheck: number;
  };
}

export interface ConcreteDesignResult extends DesignCheckResult {
  material: 'concrete';
  details: {
    flexureRatio: number;
    shearRatio: number;
    AsRequired: number;    // cm² of required steel
    AvRequired: number;    // cm²/m of required stirrups
  };
}

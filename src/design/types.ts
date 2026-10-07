/**
 * Marks a design check whose ratio is a screening estimate rather than a code
 * check of the actual section. Present only on such results. Consumers show
 * the D/C ratio as indicative and surface `reason` to the user.
 */
export interface IndicativeNote {
  reason: string;
}

export interface DesignCheckResult {
  elementId: string;
  material: 'steel' | 'concrete';
  ratio: number;
  status: 'pass' | 'fail';
  details: Record<string, number>;
  indicative?: IndicativeNote;
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

/** Concrete element checked as a beam: flexure and shear on the given section. */
export type ConcreteBeamDetails = {
  flexureRatio: number;
  shearRatio: number;
  AsRequired: number;    // in² of required flexural steel
  AvRequired: number;    // in² of stirrups per spacing s = d/2
};

/**
 * Concrete element checked as a column. The steel is assumed, not designed,
 * so there is no AsRequired; `rhoAssumed` states the ratio that was used.
 */
export type ConcreteColumnDetails = {
  flexureRatio: number;  // P-M interaction ratio
  shearRatio: number;    // always 0, shear is not checked on the column branch
  AvRequired: number;    // always 0
  rhoAssumed: number;    // assumed longitudinal steel ratio Ast/Ag
};

/**
 * Concrete column whose section defines its bars, checked against the
 * strain-compatibility P-M diagram. Not indicative.
 */
export type ConcreteReinforcedColumnDetails = {
  flexureRatio: number;  // P-M interaction ratio (radial, see interaction.ts)
  shearRatio: number;    // always 0, shear is not checked on the column branch
  AvRequired: number;    // always 0
  AsProvided: number;    // in², total longitudinal steel of the section
  rhoProvided: number;   // AsProvided / Ag
};

export interface ConcreteDesignResult extends DesignCheckResult {
  material: 'concrete';
  details: ConcreteBeamDetails | ConcreteColumnDetails | ConcreteReinforcedColumnDetails;
}

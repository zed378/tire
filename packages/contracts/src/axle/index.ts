export {
  buildPositionCode,
  buildPositionLabel,
  declaredAxleSum,
  derivePositions,
  positionsMatchTireCount,
  totalTires,
  type AxleConfig,
  type TirePosition,
} from "./derive.ts";

export {
  isValidAxleConfiguration,
  validateAxleConfiguration,
  type AxleConfigurationInput,
} from "./validate.ts";

export {
  combinationKey,
  enumerateValidCombinations,
  type AxleCombination,
} from "./combinations.ts";

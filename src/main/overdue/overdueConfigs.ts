import { DEFAULTS, FILENAMES, CONSTRAINTS } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

// Absolute maximum number of windows able to be set
const MAXIMUM_WINDOW_LEVEL = CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_LEVEL;

// Absolute maximum percentage of screen that overdue window takes up  
const MAXIMUM_WINDOW_RATIO = CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_RATIO;

const defaultOverdueConfigs: OverdueConfigs = {
  levelThresholdMs: DEFAULTS.DEFAULT_LEVEL_THRESHOLD_MS,
  windowLevelCap: MAXIMUM_WINDOW_LEVEL,
  windowRatioCap: MAXIMUM_WINDOW_RATIO,
};

export interface OverdueConfigs {
  levelThresholdMs: number,
  windowLevelCap: number,
  windowRatioCap: number,
  isLevelGrowthLinear?: true, // in case we ever want growth to not be linear
}

let overdueConfigs: OverdueConfigs;

export const loadOverdueConfigsData = () => {
  const overdueConfigsData = getUserDataFromFile<OverdueConfigs>(FILENAMES.OVERDUE.CONFIGS);
  // If no overdue configs are returned, set new in file
  overdueConfigs = { ...defaultOverdueConfigs, ...overdueConfigsData?.fileContent }
  writeToUserDataFile(FILENAMES.OVERDUE.CONFIGS, overdueConfigs);
  console.log('overdueconfigs', overdueConfigs);
}

export const getOverdueConfigs = () => {
  return overdueConfigs;
}

export const setOverdueConfigs = (newOverdueConfigs: OverdueConfigs) => {
  overdueConfigs = newOverdueConfigs;
}
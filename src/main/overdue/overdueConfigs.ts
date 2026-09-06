import { DEFAULTS, FILENAMES, CONSTRAINTS } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

const MAXIMUM_WINDOW_LEVEL = CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_LEVEL;
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
}

let overdueConfigs: OverdueConfigs;

export const loadOverdueConfigs = () => {
  const overdueConfigsData = getUserDataFromFile<OverdueConfigs>(FILENAMES.OVERDUE.CONFIGS);
  overdueConfigs = { ...defaultOverdueConfigs, ...overdueConfigsData?.fileContent };
  writeToUserDataFile(FILENAMES.OVERDUE.CONFIGS, overdueConfigs);
}

export const getOverdueConfigs = () => {
  return overdueConfigs;
}

export const setOverdueConfigs = (newOverdueConfigs: OverdueConfigs) => {
  overdueConfigs = newOverdueConfigs;
  writeToUserDataFile(FILENAMES.OVERDUE.CONFIGS, overdueConfigs);
}
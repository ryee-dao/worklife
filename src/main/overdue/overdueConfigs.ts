import { DEFAULTS, FILENAMES, CONSTRAINTS } from "@shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "@shared/utils/files";
import { fromSaved, isBetween, isPositiveMs } from "@shared/utils/configs";

const MAXIMUM_WINDOW_LEVEL = CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_LEVEL;
const MAXIMUM_WINDOW_RATIO = CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_RATIO;

const defaultOverdueConfigs: OverdueConfigs = {
  levelThresholdMs: DEFAULTS.DEFAULT_LEVEL_THRESHOLD_MS,
  windowLevelCap: MAXIMUM_WINDOW_LEVEL,
  windowRatioCap: DEFAULTS.DEFAULT_WINDOW_RATIO_CAP,
};

export interface OverdueConfigs {
  levelThresholdMs: number,
  windowLevelCap: number,
  windowRatioCap: number,
}

let overdueConfigs: OverdueConfigs;
// The configs the app runs on. Saved changes are only applied after a break
let appliedOverdueConfigs: OverdueConfigs;

export const loadOverdueConfigs = () => {
  const overdueConfigsData = getUserDataFromFile<OverdueConfigs>(FILENAMES.OVERDUE.CONFIGS);
  overdueConfigs = fromSaved(defaultOverdueConfigs, overdueConfigsData?.fileContent, {
    levelThresholdMs: isPositiveMs,
    windowLevelCap: (value) => Number.isInteger(value) && isBetween(1, MAXIMUM_WINDOW_LEVEL)(value), // Zero levels would leave the window with no size
    windowRatioCap: isBetween(0.1, MAXIMUM_WINDOW_RATIO),
  });
  writeToUserDataFile(FILENAMES.OVERDUE.CONFIGS, overdueConfigs);
  applyOverdueConfigs();
}

export const applyOverdueConfigs = () => {
  appliedOverdueConfigs = { ...overdueConfigs };
}

export const getAppliedOverdueConfigs = () => {
  return appliedOverdueConfigs;
}

export const getOverdueConfigs = () => {
  return overdueConfigs;
}

export const setOverdueConfigs = (newOverdueConfigs: OverdueConfigs) => {
  overdueConfigs = newOverdueConfigs;
  return writeToUserDataFile(FILENAMES.OVERDUE.CONFIGS, overdueConfigs);
}
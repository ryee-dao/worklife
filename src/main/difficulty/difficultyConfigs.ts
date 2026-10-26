import { DEFAULTS, DIFFICULTY_PRESETS, FILENAMES } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

export type DifficultyLevel = keyof typeof DIFFICULTY_PRESETS | "CUSTOM";

export interface DifficultyConfigs {
  level: DifficultyLevel;
  custom: { breakDurationMs: number; allottedBreaks: number }; // Only used when level is CUSTOM
}

const defaultDifficultyConfigs: DifficultyConfigs = {
  level: "NORMAL",
  custom: {
    breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
    allottedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS,
  },
};

let difficultyConfigs: DifficultyConfigs;
// The configs the app runs on. Saved changes are only applied after a break
let appliedDifficultyConfigs: DifficultyConfigs;

export const loadDifficultyConfigs = () => {
  const difficultyConfigsData = getUserDataFromFile<DifficultyConfigs>(FILENAMES.DIFFICULTY.CONFIGS);
  difficultyConfigs = { ...defaultDifficultyConfigs, ...difficultyConfigsData?.fileContent };
  writeToUserDataFile(FILENAMES.DIFFICULTY.CONFIGS, difficultyConfigs);
  applyDifficultyConfigs();
}

export const applyDifficultyConfigs = () => {
  appliedDifficultyConfigs = { ...difficultyConfigs };
}

export const getAppliedDifficultyConfigs = () => {
  return appliedDifficultyConfigs;
}

export const getDifficultyConfigs = () => {
  return difficultyConfigs;
}

export const setDifficultyConfigs = (newDifficultyConfigs: DifficultyConfigs) => {
  difficultyConfigs = newDifficultyConfigs;
  writeToUserDataFile(FILENAMES.DIFFICULTY.CONFIGS, difficultyConfigs);
}

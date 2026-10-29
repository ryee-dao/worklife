import { DEFAULTS, DIFFICULTY_PRESETS, FILENAMES } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

export type DifficultyLevel = keyof typeof DIFFICULTY_PRESETS | "CUSTOM";

export interface DifficultyConfigs {
  level: DifficultyLevel;
  // Only used when level is CUSTOM
  custom: { breakDurationMs: number; snoozeDurationMs: number; allottedPowerups: number; lunchDurationMs: number; checkpointDecayMs: number };
}

const defaultDifficultyConfigs: DifficultyConfigs = {
  level: "NORMAL",
  custom: {
    breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
    snoozeDurationMs: DEFAULTS.DEFAULT_SNOOZE_DURATION_MS,
    allottedPowerups: DEFAULTS.DEFAULT_ALLOTTED_POWERUPS,
    lunchDurationMs: DEFAULTS.DEFAULT_LUNCH_DURATION_MS,
    checkpointDecayMs: DEFAULTS.DEFAULT_CHECKPOINT_DECAY_MS,
  },
};

let difficultyConfigs: DifficultyConfigs;
// The configs the app runs on. Saved changes are only applied after a break
let appliedDifficultyConfigs: DifficultyConfigs;

export const loadDifficultyConfigs = () => {
  const difficultyConfigsData = getUserDataFromFile<DifficultyConfigs>(FILENAMES.DIFFICULTY.CONFIGS);
  const savedConfigs = difficultyConfigsData?.fileContent;
  // Custom is merged too, so a file saved before a custom field existed gets that field's default
  difficultyConfigs = {
    ...defaultDifficultyConfigs,
    ...savedConfigs,
    custom: { ...defaultDifficultyConfigs.custom, ...savedConfigs?.custom },
  };
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

import { DEFAULTS, DIFFICULTY_PRESETS, FILENAMES } from "@shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "@shared/utils/files";
import { fromSaved, isCount, isPositiveMs } from "@shared/utils/configs";

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
  const saved = difficultyConfigsData?.fileContent;
  const { custom } = defaultDifficultyConfigs;
  difficultyConfigs = {
    ...fromSaved(defaultDifficultyConfigs, saved, { level: (value) => Object.keys(DIFFICULTY_PRESETS).includes(value as string) || value === "CUSTOM", custom: () => false }),
    custom: fromSaved(custom, saved?.custom, { breakDurationMs: isPositiveMs, snoozeDurationMs: isPositiveMs, allottedPowerups: isCount, lunchDurationMs: isPositiveMs, checkpointDecayMs: isPositiveMs }),
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
  return writeToUserDataFile(FILENAMES.DIFFICULTY.CONFIGS, difficultyConfigs);
}

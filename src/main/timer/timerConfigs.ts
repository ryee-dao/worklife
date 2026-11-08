import { DEFAULTS, FILENAMES } from "@shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "@shared/utils/files";
import { fromSaved, isPositiveMs } from "@shared/utils/configs";

const defaultTimerConfigs: TimerConfigs = {
  timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  warningThresholdMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS,
};

export interface TimerConfigs {
  timerDurationMs: number;
  warningThresholdMs: number;
}

let timerConfigs: TimerConfigs;
// The configs the app runs on. Saved changes are only applied after a break
let appliedTimerConfigs: TimerConfigs;

export const loadTimerConfigs = () => {
  const timerConfigsData = getUserDataFromFile<TimerConfigs>(FILENAMES.TIMER.CONFIGS);
  timerConfigs = fromSaved(defaultTimerConfigs, timerConfigsData?.fileContent, { timerDurationMs: isPositiveMs, warningThresholdMs: isPositiveMs });
  writeToUserDataFile(FILENAMES.TIMER.CONFIGS, timerConfigs);
  applyTimerConfigs();
}

export const applyTimerConfigs = () => {
  appliedTimerConfigs = { ...timerConfigs };
}

export const getAppliedTimerConfigs = () => {
  return appliedTimerConfigs;
}

export const getTimerConfigs = () => {
  return timerConfigs;
}

export const setTimerConfigs = (newTimerConfigs: TimerConfigs) => {
  timerConfigs = newTimerConfigs;
  writeToUserDataFile(FILENAMES.TIMER.CONFIGS, timerConfigs);
}
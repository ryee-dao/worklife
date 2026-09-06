import { DEFAULTS, FILENAMES } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

const defaultTimerConfigs: TimerConfigs = {
  timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
  warningThresholdMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS,
};

export interface TimerConfigs {
  timerDurationMs: number;
  breakDurationMs: number;
  warningThresholdMs: number;
}

let timerConfigs: TimerConfigs;

export const loadTimerConfigs = () => {
  const timerConfigsData = getUserDataFromFile<TimerConfigs>(FILENAMES.TIMER.CONFIGS);
  timerConfigs = { ...defaultTimerConfigs, ...timerConfigsData?.fileContent };
  writeToUserDataFile(FILENAMES.TIMER.CONFIGS, timerConfigs);
}

export const getTimerConfigs = () => {
  return timerConfigs;
}

export const setTimerConfigs = (newTimerConfigs: TimerConfigs) => {
  timerConfigs = newTimerConfigs;
  writeToUserDataFile(FILENAMES.TIMER.CONFIGS, timerConfigs);
}
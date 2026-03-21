import { DEFAULTS, FILENAMES } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

const defaultTimerSettings: TimerConfig = {
  timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
  warningThresholdMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS,
};

export interface TimerConfig {
  timerDurationMs: number;
  breakDurationMs: number;
  warningThresholdMs: number;
}

export function getTimerSettingsData(): TimerConfig {
  const timerSettingsData = getUserDataFromFile<TimerConfig>(FILENAMES.TIMER.SETTINGS);
  // let timerSettings: TimerConfig;
  // If no timer settings data is returned, set new state in file
  // If no timer data is returned, set new state in file
  const timerSettings = { ...defaultTimerSettings, ...timerSettingsData?.fileContent }
  writeToUserDataFile(FILENAMES.TIMER.SETTINGS, timerSettings);

  // if (!timerSettingsData.fileContent) {
  //   writeToUserDataFile(FILENAMES.TIMER.SETTINGS, defaultTimerSettings)
  //   timerSettings = defaultTimerSettings;
  // } else {
  //   timerSettings = timerSettingsData.fileContent;
  // }
  console.log('timersettings', timerSettings)
  return timerSettings;
}
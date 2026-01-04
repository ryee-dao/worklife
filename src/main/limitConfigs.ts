import { DEFAULTS, FILENAMES } from "../shared/constants";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../shared/utils/files";

const defaultLimitSettings: LimitConfig = {
  allotedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS,
};

export interface LimitConfig {
  allotedBreaks: number;
}

export function getLimitSettingsData(): LimitConfig {
  let timerSettingsData = getUserDataFromFile<LimitConfig>(
    FILENAMES.LIMIT.SETTINGS
  );
  let timerSettings: LimitConfig;
  // If no timer settings data is returned, set new state in file
  if (!timerSettingsData.fileContent) {
    writeToUserDataFile(FILENAMES.LIMIT.SETTINGS, defaultLimitSettings);
    timerSettings = defaultLimitSettings;
  } else {
    timerSettings = timerSettingsData.fileContent;
  }
  console.log(timerSettings);
  return timerSettings;
}

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
  let limitSettingsData = getUserDataFromFile<LimitConfig>(
    FILENAMES.LIMIT.SETTINGS
  );
  let limitSettings: LimitConfig;
  // If no limit settings data is returned, set new state in file
  if (!limitSettingsData.fileContent) {
    writeToUserDataFile(FILENAMES.LIMIT.SETTINGS, defaultLimitSettings);
    limitSettings = defaultLimitSettings;
  } else {
    limitSettings = limitSettingsData.fileContent;
  }
  console.log(limitSettings);
  return limitSettings;
}

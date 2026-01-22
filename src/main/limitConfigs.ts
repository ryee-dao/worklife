import { DEFAULTS, FILENAMES } from "../shared/constants";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../shared/utils/files";

const defaultLimitConfigs: LimitConfig = {
  allotedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS,
};

export interface LimitConfig {
  allotedBreaks: number;
}

let limitConfig: LimitConfig;

export function getLimitSettingsData(): LimitConfig {
  let limitSettingsData = getUserDataFromFile<LimitConfig>(
    FILENAMES.LIMIT.SETTINGS
  );
  // If no limit settings data is returned, set new state in file
  if (!limitSettingsData.fileContent) {
    writeToUserDataFile(FILENAMES.LIMIT.SETTINGS, defaultLimitConfigs);
    setLimitConfigs(defaultLimitConfigs);
  } else {
    setLimitConfigs(limitSettingsData.fileContent);
  }
  console.log(limitConfig);
  return getLimitConfig();
}

function setLimitConfigs(newLimitConfig: LimitConfig) {
  limitConfig = newLimitConfig;
}

export function getLimitConfig(): LimitConfig {
  return limitConfig;
}
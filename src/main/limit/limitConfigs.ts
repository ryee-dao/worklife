import { DEFAULTS, FILENAMES } from "../../shared/constants";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../../shared/utils/files";

const defaultLimitConfigs: LimitConfig = {
  allotedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS,
};

export interface LimitConfig {
  allotedBreaks: number;
}

let limitConfig: LimitConfig;

export function getLimitConfigsFileData(): LimitConfig {
  const limitSettingsData = getUserDataFromFile<LimitConfig>(
    FILENAMES.LIMIT.SETTINGS
  );
  // If no limit settings data is returned, set new state in file
  if (!limitSettingsData.fileContent) {
    setLimitConfigs(defaultLimitConfigs);
  } else {
    setLimitConfigs(limitSettingsData.fileContent);
  }
  // console.log(limitConfig);
  return getLimitConfig();
}

function setLimitConfigs(newLimitConfig: LimitConfig) {
  writeToUserDataFile(FILENAMES.LIMIT.SETTINGS, newLimitConfig);
  limitConfig = newLimitConfig;
}

export function getLimitConfig(): LimitConfig {
  return limitConfig;
}
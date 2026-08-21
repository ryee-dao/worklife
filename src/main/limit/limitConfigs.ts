import { DEFAULTS, FILENAMES } from "../../shared/constants";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../../shared/utils/files";

const defaultLimitConfigs: LimitConfigs = {
  allotedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS,
};

export interface LimitConfigs {
  allotedBreaks: number;
}

let limitConfig: LimitConfigs;

export function getLimitConfigsFileData(): LimitConfigs {
  const limitSettingsData = getUserDataFromFile<LimitConfigs>(
    FILENAMES.LIMIT.SETTINGS
  );
  // If no limit settings data is returned, set new state in file
  if (!limitSettingsData.fileContent) {
    setLimitConfigs(defaultLimitConfigs);
  } else {
    setLimitConfigs(limitSettingsData.fileContent);
  }
  return getLimitConfig();
}

function setLimitConfigs(newLimitConfig: LimitConfigs) {
  writeToUserDataFile(FILENAMES.LIMIT.SETTINGS, newLimitConfig);
  limitConfig = newLimitConfig;
}

export function getLimitConfig(): LimitConfigs {
  return limitConfig;
}
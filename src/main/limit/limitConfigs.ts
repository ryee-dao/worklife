import { DEFAULTS, FILENAMES } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

const defaultLimitConfigs: LimitConfigs = {
  allotedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS,
};

export interface LimitConfigs {
  allotedBreaks: number;
}

let limitConfigs: LimitConfigs;

export const loadLimitConfigs = () => {
  const limitConfigsData = getUserDataFromFile<LimitConfigs>(FILENAMES.LIMIT.CONFIGS);
  limitConfigs = { ...defaultLimitConfigs, ...limitConfigsData?.fileContent };
  writeToUserDataFile(FILENAMES.LIMIT.CONFIGS, limitConfigs);
}

export const getLimitConfigs = () => {
  return limitConfigs;
}

export const setLimitConfigs = (newLimitConfigs: LimitConfigs) => {
  limitConfigs = newLimitConfigs;
  writeToUserDataFile(FILENAMES.LIMIT.CONFIGS, limitConfigs);
}
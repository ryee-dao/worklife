import { DEFAULTS, FILENAMES } from "../../shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

const defaultLimitConfigs: LimitConfigs = {
  allottedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS,
};

export interface LimitConfigs {
  allottedBreaks: number;
}

let limitConfigs: LimitConfigs;
// The configs the app runs on. Saved changes are only applied after a break
let appliedLimitConfigs: LimitConfigs;

export const loadLimitConfigs = () => {
  const limitConfigsData = getUserDataFromFile<LimitConfigs>(FILENAMES.LIMIT.CONFIGS);
  limitConfigs = { ...defaultLimitConfigs, ...limitConfigsData?.fileContent };
  writeToUserDataFile(FILENAMES.LIMIT.CONFIGS, limitConfigs);
  applyLimitConfigs();
}

export const applyLimitConfigs = () => {
  appliedLimitConfigs = { ...limitConfigs };
}

export const getAppliedLimitConfigs = () => {
  return appliedLimitConfigs;
}

export const getLimitConfigs = () => {
  return limitConfigs;
}

export const setLimitConfigs = (newLimitConfigs: LimitConfigs) => {
  limitConfigs = newLimitConfigs;
  writeToUserDataFile(FILENAMES.LIMIT.CONFIGS, limitConfigs);
}
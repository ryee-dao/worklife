import { FILENAMES } from "../shared/constants";
import { getTodayDateAsString } from "../shared/utils/date";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../shared/utils/files";
import { getLimitSettingsData } from "./limitConfigs";

export interface LimitState {
  lastResetDate: string;
  skippedBreakCount: number;
}

let limitState: LimitState;

const limitCheckIntervalMs = 5 * 60 * 1000; // 5 mins
setInterval(resetDailyLimits, limitCheckIntervalMs); // Check if we need to reset daily limit on a timed basis

export const initLimits = () => {
  loadLimitStateFromFile();
  resetDailyLimits();
}

export function loadLimitStateFromFile() {
  let limitStateData = getUserDataFromFile<LimitState>(FILENAMES.LIMIT.STATE);
  // If no timer data is returned, set new state in file
  const defaultLimitData = {
    lastResetDate: getTodayDateAsString(),
    skippedBreakCount: 0,
  }

  if (!limitStateData.fileContent) {
    writeToUserDataFile(FILENAMES.TIMER.STATE, defaultLimitData);
    setLimitState(defaultLimitData);
  } else {
    setLimitState(limitStateData.fileContent);
  }
}

export function resetDailyLimits() {
  let newLimitState = getLimitState();
  // If the last reset date is not today, reset it and set the last reset date to today
  if (!(newLimitState.lastResetDate === getTodayDateAsString())) {
    setLimitState({
      lastResetDate: getTodayDateAsString(),
      skippedBreakCount: 0,
    });
  }
}

export function increaseSkippedBreakCount() {
  let limitStateData = getLimitState();
  let newLimitStateData = {
    ...limitStateData,
    skippedBreakCount: limitStateData.skippedBreakCount + 1,
  }
  writeToUserDataFile(FILENAMES.LIMIT.STATE, newLimitStateData);
  setLimitState(newLimitStateData);
}

export function calculateRemainingBreakSkips() {
  let limitStateData = getLimitState();
  let limitConfigs = getLimitSettingsData();
  return (
    limitConfigs.allotedBreaks - limitStateData.skippedBreakCount
  );
}

function setLimitState(newLimitState: LimitState) {
  writeToUserDataFile(FILENAMES.LIMIT.STATE, newLimitState)
  limitState = newLimitState;
}

export function getLimitState(): LimitState {
  return limitState;
}
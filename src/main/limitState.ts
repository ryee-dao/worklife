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

const limitCheckIntervalMs = 5 * 60 * 1000; // 5 mins
setInterval(resetDailyLimits, limitCheckIntervalMs); // Check if we need to reset daily limit on a timed basis

export function resetDailyLimits() {
  let limitStateData = getUserDataFromFile<LimitState>(FILENAMES.LIMIT.STATE);
  let newLimitState: LimitState;
  // If the last reset date is not today, reset it and set the last reset date to today
  if (!(limitStateData.fileContent?.lastResetDate === getTodayDateAsString())) {
    newLimitState = {
      lastResetDate: getTodayDateAsString(),
      skippedBreakCount: 0,
    };
    writeToUserDataFile(FILENAMES.LIMIT.STATE, newLimitState);
  }
  console.log(calculateRemainingBreakSkips())
}

export function increaseSkippedBreakCount() {
  let limitStateData = getUserDataFromFile<LimitState>(FILENAMES.LIMIT.STATE);
  writeToUserDataFile(FILENAMES.LIMIT.STATE, {
    ...limitStateData.fileContent!,
    skippedBreakCount: limitStateData.fileContent!.skippedBreakCount + 1,
  });
}

export function calculateRemainingBreakSkips() {
  let limitStateData = getUserDataFromFile<LimitState>(FILENAMES.LIMIT.STATE);
  let limitConfigs = getLimitSettingsData();
  return (
    limitConfigs.allotedBreaks - limitStateData.fileContent!.skippedBreakCount
  );
}

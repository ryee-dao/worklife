import { FILENAMES, LUNCHES_PER_DAY } from "../../shared/constants";
import { getTodayDateAsString } from "../../shared/utils/date";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../../shared/utils/files";
import { getAllottedPowerups } from "../difficulty/difficulty";

export interface LimitState {
  lastResetDate: string;
  powerupsUsed: number;
  lunchesUsed: number;
}

let limitState: LimitState;

const limitCheckIntervalMs = 5 * 60 * 1000; // 5 mins
setInterval(resetDailyLimits, limitCheckIntervalMs); // A check to see if daily limit needs to be reset

const getFreshLimitState = (): LimitState => ({
  lastResetDate: getTodayDateAsString(),
  powerupsUsed: 0,
  lunchesUsed: 0,
});

export const initLimits = () => {
  loadLimitStateFromFile();
  resetDailyLimits();
}

export function loadLimitStateFromFile() {
  const limitStateData = getUserDataFromFile<LimitState>(FILENAMES.LIMIT.STATE);
  // Merged over fresh counts, so a file saved before a count existed starts that count at 0
  setLimitState({ ...getFreshLimitState(), ...limitStateData.fileContent });
}

export function resetDailyLimits() {
  // If the last reset date is not today, start the day's counts over
  if (getLimitState().lastResetDate !== getTodayDateAsString()) {
    setLimitState(getFreshLimitState());
  }
}

export function increasePowerupsUsed() {
  setLimitState({ ...limitState, powerupsUsed: limitState.powerupsUsed + 1 });
}

export function calculateRemainingPowerups() {
  return getAllottedPowerups() - limitState.powerupsUsed;
}

export function increaseLunchesUsed() {
  setLimitState({ ...limitState, lunchesUsed: limitState.lunchesUsed + 1 });
}

export function calculateRemainingLunches() {
  return LUNCHES_PER_DAY - limitState.lunchesUsed;
}

function setLimitState(newLimitState: LimitState) {
  writeToUserDataFile(FILENAMES.LIMIT.STATE, newLimitState)
  limitState = newLimitState;
}

export function getLimitState(): LimitState {
  return limitState;
}

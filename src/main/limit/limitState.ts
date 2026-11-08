import { FILENAMES, LUNCHES_PER_DAY } from "@shared/constants";
import { getTodayDateAsString } from "@shared/utils/date";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "@shared/utils/files";
import { getAllottedPowerups } from "@main/difficulty/difficulty";

export interface LimitState {
  lastResetDate: string;
  powerupsUsed: number;
  lunchesUsed: number;
}

let limitState: LimitState;

const getFreshLimitState = (): LimitState => ({
  lastResetDate: getTodayDateAsString(),
  powerupsUsed: 0,
  lunchesUsed: 0,
});

export const initLimits = () => {
  loadLimitStateFromFile();
  resetLimitsIfNewDay();
}

export function loadLimitStateFromFile() {
  const limitStateData = getUserDataFromFile<LimitState>(FILENAMES.LIMIT.STATE);
  // Fresh counts when there is no file yet
  setLimitState({ ...getFreshLimitState(), ...limitStateData.fileContent });
}

export function resetLimitsIfNewDay() {
  // If the last reset date is not today, start the day's counts over
  if (getLimitState().lastResetDate !== getTodayDateAsString()) {
    resetTodayLimits();
  }
}

// Gives back today's power-ups and lunch. Used by the daily reset and the dev admin panel
export function resetTodayLimits() {
  setLimitState(getFreshLimitState());
}

export function increasePowerupsUsed() {
  setLimitState({ ...limitState, powerupsUsed: limitState.powerupsUsed + 1 });
}

// Checks the date first, so the counts come back right at midnight
export function calculateRemainingPowerups() {
  resetLimitsIfNewDay();
  return getAllottedPowerups() - limitState.powerupsUsed;
}

export function increaseLunchesUsed() {
  setLimitState({ ...limitState, lunchesUsed: limitState.lunchesUsed + 1 });
}

export function calculateRemainingLunches() {
  resetLimitsIfNewDay();
  return LUNCHES_PER_DAY - limitState.lunchesUsed;
}

function setLimitState(newLimitState: LimitState) {
  writeToUserDataFile(FILENAMES.LIMIT.STATE, newLimitState)
  limitState = newLimitState;
}

export function getLimitState(): LimitState {
  return limitState;
}

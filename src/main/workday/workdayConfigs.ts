import { FILENAMES } from "@shared/constants";
import { getTodayDateAsString } from "@shared/utils/date";
import { getUserDataFromFile, writeToUserDataFile } from "@shared/utils/files";
import { fromSaved } from "@shared/utils/configs";
import { isValidWorkdayHours } from "@shared/utils/time";

export interface WorkdayConfigs {
  days: number[];   // 0 = Sunday, matching Date.getDay()
  start: string;    // Local time as "HH:MM"
  end: string;      // Local time as "HH:MM"
  autoStopAtEnd: boolean;
}

// The configs the app runs on and the day they were applied. Saved so a restart keeps today's hours
interface WorkdayState {
  appliedDate: string;
  appliedConfigs: WorkdayConfigs;
}

const defaultWorkdayConfigs: WorkdayConfigs = {
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "17:00",
  autoStopAtEnd: false,
};

let workdayConfigs: WorkdayConfigs;
// Saved changes are only applied the next day, so each day keeps the hours it started with
let workdayState: WorkdayState;

export const loadWorkdayConfigs = () => {
  const workdayConfigsData = getUserDataFromFile<WorkdayConfigs>(FILENAMES.WORKDAY.CONFIGS);
  const saved = workdayConfigsData?.fileContent;
  const isTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const hoursValid = isTime(saved?.start) && isTime(saved?.end) && isValidWorkdayHours(saved!.start, saved!.end); // Start and end only make sense together
  workdayConfigs = fromSaved(defaultWorkdayConfigs, saved, {
    days: (value) => Array.isArray(value) && value.length > 0 && value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    start: () => hoursValid,
    end: () => hoursValid,
    autoStopAtEnd: (value) => typeof value === "boolean",
  });
  writeToUserDataFile(FILENAMES.WORKDAY.CONFIGS, workdayConfigs);

  const savedWorkdayState = getUserDataFromFile<WorkdayState>(FILENAMES.WORKDAY.STATE).fileContent;
  if (savedWorkdayState?.appliedDate === getTodayDateAsString()) {
    workdayState = savedWorkdayState;
  } else {
    applyWorkdayConfigs();
  }
}

export const applyWorkdayConfigs = () => {
  workdayState = { appliedDate: getTodayDateAsString(), appliedConfigs: { ...workdayConfigs } };
  writeToUserDataFile(FILENAMES.WORKDAY.STATE, workdayState);
}

export const applyWorkdayConfigsOnNewDay = () => {
  if (workdayState.appliedDate !== getTodayDateAsString()) {
    applyWorkdayConfigs();
  }
}

export const getAppliedWorkdayConfigs = () => {
  return workdayState.appliedConfigs;
}

export const getWorkdayConfigs = () => {
  return workdayConfigs;
}

export const setWorkdayConfigs = (newWorkdayConfigs: WorkdayConfigs) => {
  workdayConfigs = newWorkdayConfigs;
  return writeToUserDataFile(FILENAMES.WORKDAY.CONFIGS, workdayConfigs);
}

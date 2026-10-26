import { FILENAMES } from "../../shared/constants";
import { getTodayDateAsString } from "../../shared/utils/date";
import { getUserDataFromFile, writeToUserDataFile } from "../../shared/utils/files";

export interface WorkdayConfigs {
  days: number[];   // 0 = Sunday, matching Date.getDay()
  start: string;    // Local time as "HH:MM"
  end: string;      // Local time as "HH:MM"
  autoPauseAtEnd: boolean;
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
  autoPauseAtEnd: false,
};

let workdayConfigs: WorkdayConfigs;
// Saved changes are only applied the next day, so each day keeps the hours it started with
let workdayState: WorkdayState;

export const loadWorkdayConfigs = () => {
  const workdayConfigsData = getUserDataFromFile<WorkdayConfigs>(FILENAMES.WORKDAY.CONFIGS);
  workdayConfigs = { ...defaultWorkdayConfigs, ...workdayConfigsData?.fileContent };
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
  writeToUserDataFile(FILENAMES.WORKDAY.CONFIGS, workdayConfigs);
}

import { stopTimer, startTimer } from "../timer/timerState";
import { applyWorkdayConfigsOnNewDay, getAppliedWorkdayConfigs, WorkdayConfigs } from "./workdayConfigs";

const workdayCheckIntervalMs = 60 * 1000; // 1 minute
let workdayCheckTimer: NodeJS.Timeout;
let wasInWorkday: boolean;
let onWorkdayEnd: () => void;

const convertTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// shortcut: assumes start is before end (no overnight workdays), handle end < start here to support them
export const isInWorkday = (now: Date, configs: WorkdayConfigs) => {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return (
    configs.days.includes(now.getDay()) &&
    minutesNow >= convertTimeToMinutes(configs.start) &&
    minutesNow < convertTimeToMinutes(configs.end)
  );
};

const checkWorkday = () => {
  applyWorkdayConfigsOnNewDay();

  const configs = getAppliedWorkdayConfigs();
  const inWorkday = isInWorkday(new Date(), configs);
  const workdayStarted = inWorkday && !wasInWorkday;
  const workdayEnded = !inWorkday && wasInWorkday;

  // Only act the moment the workday starts or ends, so a stop in the middle of the day is left alone
  if (workdayStarted) {
    startTimer("SCHEDULE"); // Only resumes a stopped timer
  }
  if (workdayEnded && configs.autoStopAtEnd) {
    stopTimer("SCHEDULE");
  }
  if (workdayEnded) {
    onWorkdayEnd();
  }
  wasInWorkday = inWorkday;
};

export const initWorkday = (onEnd: () => void = () => {}) => {
  onWorkdayEnd = onEnd;
  wasInWorkday = isInWorkday(new Date(), getAppliedWorkdayConfigs());
  // E2E tests control time themselves, so a real-time check would make them flaky
  if (!process.env.PLAYWRIGHT_TEST) {
    workdayCheckTimer = setInterval(checkWorkday, workdayCheckIntervalMs);
  }
};

export const destroyWorkday = () => {
  clearInterval(workdayCheckTimer);
};

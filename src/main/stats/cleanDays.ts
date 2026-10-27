import { StatsEvent } from "./stats";

export type DayResult = "CLEAN" | "PARTIAL" | "NOT_CLEAN"; // Days that don't count are left out

type Interval = { start: number; end: number };

const allowedGapMs = 5 * 60 * 1000; // A quick restart still counts as running the whole workday
const minuteMs = 60 * 1000;

// "YYYY-MM-DD" in the timezone the event happened in
const getLocalDate = (event: StatsEvent) => {
  return new Date(event.at + event.tzOffsetMin * minuteMs).toISOString().slice(0, 10);
};

// Converts a local date and "HH:MM" time back to UTC epoch ms
const toEpochMs = (localDate: string, time: string, tzOffsetMin: number) => {
  return Date.parse(`${localDate}T${time}:00Z`) - tzOffsetMin * minuteMs;
};

// When the app was running, from each start to its quit
// shortcut: a crash has no APP_QUIT, so that run ends at its last event and can undercount, add a heartbeat event if that matters
const getRunningIntervals = (events: StatsEvent[], now: number): Interval[] => {
  const intervals: Interval[] = [];
  let current: Interval | null = null;

  for (const event of events) {
    if (event.type === "APP_STARTED") {
      if (current) intervals.push(current);
      current = { start: event.at, end: event.at };
    } else if (current) {
      current.end = event.at;
      if (event.type === "APP_QUIT") {
        intervals.push(current);
        current = null;
      }
    }
  }
  if (current) intervals.push({ ...current, end: now }); // Still running

  return intervals;
};

// True when the intervals cover the whole window, allowing short gaps
const coversWindow = (intervals: Interval[], window: Interval) => {
  let coveredUntil = window.start;
  for (const interval of intervals) {
    if (interval.start - coveredUntil > allowedGapMs) return false;
    coveredUntil = Math.max(coveredUntil, interval.end);
  }
  return window.end - coveredUntil <= allowedGapMs;
};

const judgeDay = (dayEvents: StatsEvent[], runningIntervals: Interval[], now: number): DayResult | null => {
  // Each day is judged by the workday it started with
  const { config, tzOffsetMin } = dayEvents[0];
  const localDate = getLocalDate(dayEvents[0]);
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  if (!config.workday.days.includes(weekday)) return null;

  const workWindow = {
    start: toEpochMs(localDate, config.workday.start, tzOffsetMin),
    end: toEpochMs(localDate, config.workday.end, tzOffsetMin),
  };
  const isDuringWork = (at: number) => at >= workWindow.start && at < workWindow.end;

  // Stopping by schedule (auto stop at the end of the workday) never costs the day
  const stoppedDuringWork = dayEvents.some(
    (event) => event.type === "STOPPED" && event.source !== "SCHEDULE" && isDuringWork(event.at)
  );
  if (stoppedDuringWork) return "NOT_CLEAN";
  if (now < workWindow.end) return null; // The workday isn't over yet

  const runningDuringWork = runningIntervals
    .map((interval) => ({
      start: Math.max(interval.start, workWindow.start),
      end: Math.min(interval.end, workWindow.end),
    }))
    .filter((interval) => interval.start < interval.end);

  if (runningDuringWork.length === 0) return null; // The app never ran during work hours
  return coversWindow(runningDuringWork, workWindow) ? "CLEAN" : "PARTIAL";
};

// Results by local date, "YYYY-MM-DD". Weekends and workdays the app never ran on are left out
export const getDayResults = (events: StatsEvent[], now = Date.now()) => {
  const sortedEvents = [...events].sort((a, b) => a.at - b.at);
  const runningIntervals = getRunningIntervals(sortedEvents, now);

  const eventsByDay = new Map<string, StatsEvent[]>();
  for (const event of sortedEvents) {
    const localDate = getLocalDate(event);
    eventsByDay.set(localDate, [...(eventsByDay.get(localDate) ?? []), event]);
  }

  const results: Record<string, DayResult> = {};
  for (const [localDate, dayEvents] of eventsByDay) {
    const result = judgeDay(dayEvents, runningIntervals, now);
    if (result) results[localDate] = result;
  }
  return results;
};

// A partial clean counts as half a day
export const countCleanDays = (results: Record<string, DayResult>) => {
  const dayValues: Record<DayResult, number> = { CLEAN: 1, PARTIAL: 0.5, NOT_CLEAN: 0 };
  return Object.values(results).reduce((total, result) => total + dayValues[result], 0);
};

import { randomUUID } from "crypto";
import { EVENTS, FILENAMES } from "../../shared/constants";
import { appendToUserDataFile, getUserDataFromFile, readUserDataTextFile, writeToUserDataFile } from "../../shared/utils/files";
import { getTimerState, timerEmitter, TimerStatus, TimerTransition } from "../timer/timerState";
import { getAppliedTimerConfigs } from "../timer/timerConfigs";
import { getAppliedOverdueConfigs } from "../overdue/overdueConfigs";
import { getAllottedBreaks, getAllottedSnoozes, getBreakDurationMs, getPartialThreshold, getSnoozeDurationMs } from "../difficulty/difficulty";
import { DifficultyLevel, getAppliedDifficultyConfigs } from "../difficulty/difficultyConfigs";
import { getAppliedWorkdayConfigs, WorkdayConfigs } from "../workday/workdayConfigs";
import { countCleanDays, getDayScores, getTodayScore } from "./cleanDays";

type AppQuit = { type: "APP_QUIT"; status: TimerStatus; countdownMs: number; overdueMs: number };
type Heartbeat = { type: "HEARTBEAT" }; // Shows the app was still alive, so a crash can be placed within a minute

// One line in events.jsonl. Every event carries its own context so it can be read on its own
export type StatsEvent = {
  v: 1;
  id: string;
  at: number;          // UTC epoch ms
  tzOffsetMin: number; // Local offset from UTC at that moment, e.g. -240 for UTC-4
  config: {
    timerDurationMs: number;
    breakDurationMs: number;
    warningThresholdMs: number;
    allottedBreaks: number;
    snoozeDurationMs: number;
    allottedSnoozes: number;
    partialThreshold: number;
    difficulty: DifficultyLevel;
    levelThresholdMs: number;
    workday: WorkdayConfigs;
  };
} & (TimerTransition | AppQuit | Heartbeat);

const heartbeatIntervalMs = 60 * 1000; // 1 minute
const todayScoringWindowMs = 7 * 24 * 60 * 60 * 1000; // 1 week
let heartbeatTimer: NodeJS.Timeout;
// shortcut: keeps the whole log in memory so today's score doesn't re-read the file every tick, trim to recent days if it grows large
let events: StatsEvent[] = [];

const recordEvent = (event: TimerTransition | AppQuit | Heartbeat) => {
  const statsEvent: StatsEvent = {
    v: 1,
    id: randomUUID(),
    at: Date.now(),
    tzOffsetMin: -new Date().getTimezoneOffset(), // getTimezoneOffset is positive west of UTC
    config: {
      timerDurationMs: getAppliedTimerConfigs().timerDurationMs,
      breakDurationMs: getBreakDurationMs(),
      warningThresholdMs: getAppliedTimerConfigs().warningThresholdMs,
      allottedBreaks: getAllottedBreaks(),
      snoozeDurationMs: getSnoozeDurationMs(),
      allottedSnoozes: getAllottedSnoozes(),
      partialThreshold: getPartialThreshold(),
      difficulty: getAppliedDifficultyConfigs().level,
      levelThresholdMs: getAppliedOverdueConfigs().levelThresholdMs,
      workday: getAppliedWorkdayConfigs(),
    },
    ...event,
  };
  events.push(statsEvent);
  appendToUserDataFile(FILENAMES.STATS.EVENTS, JSON.stringify(statsEvent) + "\n");
};

// Must run before initTimer so APP_STARTED is captured
export const initStats = () => {
  events = readEvents();
  timerEmitter.on(EVENTS.TIMER.TRANSITION, recordEvent);
  // E2E tests control time themselves, so a real-time heartbeat would make their logs unpredictable
  if (!process.env.PLAYWRIGHT_TEST) {
    heartbeatTimer = setInterval(() => recordEvent({ type: "HEARTBEAT" }), heartbeatIntervalMs);
  }
};

export const destroyStats = () => {
  clearInterval(heartbeatTimer);
};

export const getEvents = () => {
  return events;
};

export const recordAppQuit = () => {
  const { status, currentCountdownMs, overdueTimeMs } = getTimerState();
  recordEvent({ type: "APP_QUIT", status, countdownMs: currentCountdownMs, overdueMs: overdueTimeMs });
};

// A damaged line (like one cut off by a crash mid-write) is skipped so the rest of the log stays usable
export const parseEvents = (text: string): StatsEvent[] => {
  const events: StatsEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      console.warn(`Skipping damaged stats line: ${line}`);
    }
  }
  return events;
};

export const readEvents = () => {
  return parseEvents(readUserDataTextFile(FILENAMES.STATS.EVENTS));
};

// shortcut: only looks at the last week of events, so a stretch older than that (like overdue all week) is missed
export const getCurrentDayScore = () => {
  const since = Date.now() - todayScoringWindowMs;
  return getTodayScore(events.filter((event) => event.at > since));
};

export const getAllDayScores = () => {
  const scores = getDayScores(events);
  return { scores, totalCleanDays: countCleanDays(scores) };
};

// Returns the latest finished workday whose end-of-day card hasn't been shown yet, and marks it shown
export const takeUnseenSummaryDate = () => {
  const lastShown = getUserDataFromFile<{ lastSummaryDate: string }>(FILENAMES.STATS.STATE).fileContent?.lastSummaryDate ?? "";
  const unseenDates = Object.values(getDayScores(events))
    .filter((score) => score.result && score.localDate > lastShown)
    .map((score) => score.localDate)
    .sort();

  const localDate = unseenDates.at(-1);
  if (!localDate) return null;
  writeToUserDataFile(FILENAMES.STATS.STATE, { lastSummaryDate: localDate });
  return localDate;
};

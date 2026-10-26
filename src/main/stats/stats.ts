import { randomUUID } from "crypto";
import { EVENTS, FILENAMES } from "../../shared/constants";
import { appendToUserDataFile } from "../../shared/utils/files";
import { getTimerState, timerEmitter, TimerStatus, TimerTransition } from "../timer/timerState";
import { getAppliedTimerConfigs } from "../timer/timerConfigs";
import { getAppliedOverdueConfigs } from "../overdue/overdueConfigs";
import { getAllottedBreaks, getBreakDurationMs } from "../difficulty/difficulty";
import { DifficultyLevel, getAppliedDifficultyConfigs } from "../difficulty/difficultyConfigs";
import { getAppliedWorkdayConfigs, WorkdayConfigs } from "../workday/workdayConfigs";

type AppQuit = { type: "APP_QUIT"; status: TimerStatus; countdownMs: number; overdueMs: number };

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
    difficulty: DifficultyLevel;
    levelThresholdMs: number;
    workday: WorkdayConfigs;
  };
} & (TimerTransition | AppQuit);

const recordEvent = (event: TimerTransition | AppQuit) => {
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
      difficulty: getAppliedDifficultyConfigs().level,
      levelThresholdMs: getAppliedOverdueConfigs().levelThresholdMs,
      workday: getAppliedWorkdayConfigs(),
    },
    ...event,
  };
  appendToUserDataFile(FILENAMES.STATS.EVENTS, JSON.stringify(statsEvent) + "\n");
};

// Must run before initTimer so APP_STARTED is captured
export const initStats = () => {
  timerEmitter.on(EVENTS.TIMER.TRANSITION, recordEvent);
};

export const recordAppQuit = () => {
  const { status, currentCountdownMs, overdueTimeMs } = getTimerState();
  recordEvent({ type: "APP_QUIT", status, countdownMs: currentCountdownMs, overdueMs: overdueTimeMs });
};

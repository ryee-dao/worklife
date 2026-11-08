import { randomUUID } from "crypto";
import { EVENTS, FILENAMES } from "@shared/constants";
import { appendToUserDataFile, getUserDataFromFile, readUserDataTextFile, writeToUserDataFile } from "@shared/utils/files";
import { getTodayDateAsString } from "@shared/utils/date";
import { getTimerState, timerEmitter, TimerStatus, TimerTransition } from "@main/timer/timerState";
import { getAppliedTimerConfigs } from "@main/timer/timerConfigs";
import { getAppliedOverdueConfigs } from "@main/overdue/overdueConfigs";
import { getAllottedPowerups, getBreakDurationMs, getCheckpointDecayMs, getLunchDurationMs, getSnoozeDurationMs } from "@main/difficulty/difficulty";
import { DifficultyLevel, getAppliedDifficultyConfigs } from "@main/difficulty/difficultyConfigs";
import { applyWorkdayConfigsOnNewDay, getAppliedWorkdayConfigs, WorkdayConfigs } from "@main/workday/workdayConfigs";
import { DayScore, getDayScores, getTodayScore } from "./checkpoints";
import { IS_TEST } from "@main/testEnv";

type AppQuit = { type: "APP_QUIT"; status: TimerStatus; countdownMs: number; overdueMs: number };
type AppCrashed = { type: "APP_CRASHED" }; // Recorded on the next launch, at the last moment the app was known to be alive
type DayStarted = { type: "DAY_STARTED" }; // Gives a day the app runs through its own first event to take the config and offset from
type CheckpointAdjusted = { type: "CHECKPOINT_ADJUSTED"; by: number }; // Dev only: the admin panel moving today's level

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
    snoozeDurationMs: number;
    allottedPowerups: number;
    lunchDurationMs: number;
    checkpointDecayMs: number;
    difficulty: DifficultyLevel;
    levelThresholdMs: number;
    workday: WorkdayConfigs;
  };
} & (TimerTransition | AppQuit | AppCrashed | DayStarted | CheckpointAdjusted);

type StatsState = { lastSummaryDate?: string; lastAliveAt?: number };

const aliveIntervalMs = 60 * 1000; // 1 minute
const todayScoringWindowMs = 7 * 24 * 60 * 60 * 1000; // 1 week
let aliveTimer: NodeJS.Timeout;
let statsState: StatsState = {};
let lastSeenDate = "";
// shortcut: keeps the whole log in memory so today's score doesn't re-read the file every tick, trim to recent days if it grows large
let events: StatsEvent[] = [];
let todayScoreCache: { key: string; score: DayScore | null; computedAt: number; changesAt: number } | null = null;

const recordEvent = (event: TimerTransition | AppQuit | AppCrashed | DayStarted | CheckpointAdjusted, at = Date.now()) => {
  applyWorkdayConfigsOnNewDay(); // A day is scored by its first event, which can land before the workday check does
  const statsEvent: StatsEvent = {
    v: 1,
    id: randomUUID(),
    at,
    // Taken at the event's own moment, since a crash is recorded later and may sit on the other side of a clock change.
    // Flipped, since getTimezoneOffset is positive west of UTC. 0 - keeps UTC at 0, not -0
    tzOffsetMin: 0 - new Date(at).getTimezoneOffset(),
    config: {
      timerDurationMs: getAppliedTimerConfigs().timerDurationMs,
      breakDurationMs: getBreakDurationMs(),
      warningThresholdMs: getAppliedTimerConfigs().warningThresholdMs,
      snoozeDurationMs: getSnoozeDurationMs(),
      allottedPowerups: getAllottedPowerups(),
      lunchDurationMs: getLunchDurationMs(),
      checkpointDecayMs: getCheckpointDecayMs(),
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
  const text = readUserDataTextFile(FILENAMES.STATS.EVENTS);
  // A line cut off by a crash has no newline, and the next event would be appended onto it and lost with it
  if (text && !text.endsWith("\n")) appendToUserDataFile(FILENAMES.STATS.EVENTS, "\n");
  events = parseEvents(text);
  statsState = getUserDataFromFile<StatsState>(FILENAMES.STATS.STATE).fileContent ?? {};
  lastSeenDate = getTodayDateAsString();

  // Without a quit at the end, the app last ran until it crashed. The latest by time, since a crash is recorded late with an earlier time
  const latest = events.reduce<StatsEvent | undefined>((latest, event) => (latest && latest.at > event.at ? latest : event), undefined);
  if (latest && latest.type !== "APP_QUIT") {
    recordEvent({ type: "APP_CRASHED" }, Math.max(statsState.lastAliveAt ?? 0, latest.at));
  }

  timerEmitter.on(EVENTS.TIMER.TRANSITION, recordEvent);
  // E2E tests control time themselves, so a real-time interval would make their logs unpredictable
  if (!IS_TEST) {
    aliveTimer = setInterval(markAlive, aliveIntervalMs);
  }
};

// Saves when the app was last alive, so a crash can be placed within a minute, and starts each new day with an event
const markAlive = () => {
  statsState = { ...statsState, lastAliveAt: Date.now() };
  writeToUserDataFile(FILENAMES.STATS.STATE, statsState);

  const today = getTodayDateAsString();
  if (today !== lastSeenDate) {
    lastSeenDate = today;
    recordEvent({ type: "DAY_STARTED" });
  }
};

export const destroyStats = () => {
  clearInterval(aliveTimer);
};

export const getEvents = () => {
  return events;
};

export const recordAppQuit = () => {
  const { status, currentCountdownMs, overdueTimeMs } = getTimerState();
  recordEvent({ type: "APP_QUIT", status, countdownMs: currentCountdownMs, overdueMs: overdueTimeMs });
};

export const recordCheckpointAdjusted = (by: number) => {
  recordEvent({ type: "CHECKPOINT_ADJUSTED", by });
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

// The bar's last piece is the one still going, so it grows to now
const stretchLivePiece = (score: DayScore | null, computedAt: number, now: number) => {
  const live = score?.pieces.at(-1);
  if (live && score?.inProgress && computedAt > score.workStart) live.end = now;
};

// Runs every second, so the score is kept until a new event, a new day, or the next moment it changes on its own
// shortcut: only looks at the last week of events, so a stretch older than that (like overdue all week) is missed
// shortcut: bestPossible isn't refreshed while stopped since it's only shown while climbing, add its next drop to changesAt if that changes
export const getCurrentDayScore = () => {
  const now = Date.now();
  const key = `${events.length} ${events.at(-1)?.id} ${getTodayDateAsString()}`;
  const cache = todayScoreCache;
  const cacheIsFresh = cache && cache.key === key && now >= cache.computedAt && now < cache.changesAt;
  if (cacheIsFresh) {
    stretchLivePiece(cache.score, cache.computedAt, now);
    return cache.score;
  }

  const score = getTodayScore(events.filter((event) => event.at > now - todayScoringWindowMs), now);
  const changes = [score?.nextCheckpointAt, score?.workStart, score?.workEnd, score?.nextLossAt].filter((time): time is number => time != null && time >= now);
  // An event right now may have started a piece too short to show yet, so it isn't cached
  const startedNow = (events.at(-1)?.at ?? 0) >= now;
  todayScoreCache = { key, score, computedAt: now, changesAt: startedNow ? now : Math.min(...changes) };
  return score;
};

export const getAllDayScores = () => {
  return getDayScores(events);
};

// Returns the latest finished workday whose end-of-day card hasn't been shown yet, and marks it shown.
// Days the app was never open during work hours have nothing to show
export const takeUnseenSummaryDate = () => {
  const lastShown = statsState.lastSummaryDate ?? "";
  const unseenDates = Object.values(getDayScores(events))
    .filter((score) => !score.inProgress && score.localDate > lastShown)
    .filter((score) => score.pieces.some((piece) => piece.activity !== "CLOSED"))
    .map((score) => score.localDate)
    .sort();

  const localDate = unseenDates.at(-1);
  if (!localDate) return null;
  statsState = { ...statsState, lastSummaryDate: localDate };
  writeToUserDataFile(FILENAMES.STATS.STATE, statsState);
  return localDate;
};

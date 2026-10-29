import { CHECKPOINTS } from "../../shared/constants";
import type { StatsEvent } from "./stats";

// Overdue and breaks count as working: taking the break is the point
export type Activity = "WORKING" | "LUNCH" | "STOPPED" | "CLOSED";

// A stretch of time the app spent doing one thing
export interface Segment {
  start: number;
  end: number;
  activity: Activity;
  adjustBy?: number; // Dev only: the level moves by this much where the segment starts
}

export interface DayScore {
  localDate: string;               // "YYYY-MM-DD"
  level: number;                   // Index into CHECKPOINTS.NAMES. Where the workday ends is the day's result
  inProgress: boolean;             // The workday hasn't ended yet
  climbing: boolean;               // In an unbroken run, so the next checkpoint is on its way
  runStart: number | null;
  nextCheckpointAt: number | null; // When the run reaches the next checkpoint, if that's before the workday ends
  nextLossAt: number | null;       // While stopped, when the next checkpoint is lost
  losing: boolean;                 // Stopped during work hours, so checkpoints are draining
  bestPossible: number;            // The highest level still reachable today
  pieces: Segment[];               // The workday so far, for the day bar
  workStart: number;
  workEnd: number;
  powerupsUsed: number;
  lunchTaken: boolean;
}

export const MAX_LEVEL = CHECKPOINTS.NAMES.length - 1;
const minuteMs = 60 * 1000;

// What the app is doing after each event. Events not listed (SNOOZED, HEARTBEAT) don't change it
const activityAfter: Partial<Record<StatsEvent["type"], Activity>> = {
  APP_STARTED: "WORKING",
  RESUMED: "WORKING",
  OVERDUE_STARTED: "WORKING",
  BREAK_STARTED: "WORKING",
  BREAK_SKIPPED: "WORKING",
  BREAK_COMPLETED: "WORKING",
  LUNCH_STARTED: "LUNCH",
  LUNCH_ENDED: "WORKING",
  STOPPED: "STOPPED",
  APP_QUIT: "CLOSED",
};

// "YYYY-MM-DD" in the given timezone
const getLocalDate = (at: number, tzOffsetMin: number) => {
  return new Date(at + tzOffsetMin * minuteMs).toISOString().slice(0, 10);
};

// Converts a local date and "HH:MM" time back to UTC epoch ms
const toEpochMs = (localDate: string, time: string, tzOffsetMin: number) => {
  return Date.parse(`${localDate}T${time}:00Z`) - tzOffsetMin * minuteMs;
};

const buildSegments = (sortedEvents: StatsEvent[], now: number): Segment[] => {
  const segments: Segment[] = [];
  const switchTo = (at: number, activity: Activity, adjustBy?: number) => {
    const last = segments.at(-1);
    if (last) last.end = at;
    segments.push({ start: at, end: at, activity, ...(adjustBy !== undefined && { adjustBy }) });
  };

  let lastEventAt = 0;
  for (const event of sortedEvents) {
    // Starting while the app was never closed means it crashed, at its last sign of life
    const last = segments.at(-1);
    if (event.type === "APP_STARTED" && last && last.activity !== "CLOSED") {
      switchTo(lastEventAt, "CLOSED");
    }

    const activity = activityAfter[event.type];
    if (event.type === "CHECKPOINT_ADJUSTED") {
      // Split here, so scoring meets the adjustment at the right moment
      switchTo(event.at, segments.at(-1)?.activity ?? "WORKING", event.by);
    } else if (activity && activity !== segments.at(-1)?.activity) {
      switchTo(event.at, activity);
    }
    lastEventAt = event.at;
  }

  const last = segments.at(-1);
  if (last) last.end = now;
  return segments;
};

const scoreDay = (dayEvents: StatsEvent[], segments: Segment[], now: number): DayScore | null => {
  // Each day is judged by the workday it started with
  const { config, tzOffsetMin, at } = dayEvents[0];
  const localDate = getLocalDate(at, tzOffsetMin);
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  if (!config.workday.days.includes(weekday)) return null;

  const workStart = toEpochMs(localDate, config.workday.start, tzOffsetMin);
  const workEnd = toEpochMs(localDate, config.workday.end, tzOffsetMin);
  const climbMs = (workEnd - workStart) / MAX_LEVEL;
  const decayMs = config.checkpointDecayMs ?? (workEnd - workStart) * CHECKPOINTS.DECAY_RATIO;
  const scoredUntil = Math.min(Math.max(now, workStart), workEnd); // Only score time that has happened

  // The climb so far. While climbing, base is the level the run started from. While stopped, the level right after the drop
  let base = 0;
  let runStart: number | null = null;
  let stoppedAt: number | null = null; // When checkpoints started draining
  let stoppedToday = false;            // After a stop, a late start no longer counts as on time

  const levelAt = (time: number) => {
    if (runStart !== null) return Math.min(MAX_LEVEL, base + Math.floor((time - runStart) / climbMs));
    if (stoppedAt !== null) return Math.max(0, base - Math.floor((time - stoppedAt) / decayMs));
    return base;
  };

  const startRun = (time: number) => {
    base = levelAt(time);
    stoppedAt = null;
    const isOnTime = !stoppedToday && time <= workStart + CHECKPOINTS.LATE_START_GRACE_MS;
    runStart = isOnTime ? workStart : time;
  };

  // A stop knocks you down one checkpoint and the climb starts over
  const stopRun = (time: number) => {
    base = Math.max(0, levelAt(time) - 1);
    runStart = null;
    stoppedAt = time;
    stoppedToday = true;
  };

  // Moves the level, and like a stop, restarts the climb or the drain from here
  const adjustLevel = (time: number, by: number) => {
    base = Math.min(MAX_LEVEL, Math.max(0, levelAt(time) + by));
    if (runStart !== null) runStart = time;
    if (stoppedAt !== null) stoppedAt = time;
  };

  // shortcut: an adjustment outside work hours is ignored, move it to the workday's edge if testing then matters
  for (const segment of segments) {
    if (segment.end <= workStart) continue;
    const start = Math.max(segment.start, workStart);
    if (start >= scoredUntil) break;
    if (segment.adjustBy && segment.start >= workStart) adjustLevel(start, segment.adjustBy);

    switch (segment.activity) {
      case "WORKING":
      case "LUNCH": // Lunch doesn't break the run
        if (runStart === null) startRun(start);
        break;
      case "STOPPED": // A stop from before work hours has no run to break
        if (runStart !== null) stopRun(start);
        break;
      case "CLOSED": {
        // Reopening quickly is a restart. Closed for longer counts as a stop from when it closed
        const isRestart = segment.end - segment.start <= CHECKPOINTS.RESTART_GRACE_MS;
        if (runStart !== null && !isRestart) stopRun(start);
        break;
      }
    }
  }

  const level = levelAt(scoredUntil);
  const inProgress = now < workEnd;

  let nextCheckpointAt: number | null = null;
  if (runStart !== null && level < MAX_LEVEL) {
    nextCheckpointAt = runStart + (level - base + 1) * climbMs;
  }
  let nextLossAt: number | null = null;
  if (stoppedAt !== null && level > 0) {
    nextLossAt = stoppedAt + (base - level + 1) * decayMs;
  }
  const beforeWorkEnd = (time: number | null) => (time !== null && time <= workEnd ? time : null);

  // Climbing from the run's start, or from now if resumed right away
  const climbFrom = runStart ?? scoredUntil;
  const bestPossible = Math.min(MAX_LEVEL, (runStart !== null ? base : level) + Math.floor((workEnd - climbFrom) / climbMs));

  return {
    localDate,
    level,
    inProgress,
    climbing: runStart !== null,
    runStart,
    nextCheckpointAt: beforeWorkEnd(nextCheckpointAt),
    nextLossAt: beforeWorkEnd(nextLossAt),
    losing: stoppedAt !== null && inProgress && now >= workStart,
    bestPossible,
    pieces: segments
      .map((segment) => ({ ...segment, start: Math.max(segment.start, workStart), end: Math.min(segment.end, scoredUntil) }))
      .filter((piece) => piece.start < piece.end),
    workStart,
    workEnd,
    powerupsUsed: dayEvents.filter((event) => event.type === "SNOOZED" || event.type === "BREAK_SKIPPED").length,
    lunchTaken: dayEvents.some((event) => event.type === "LUNCH_STARTED"),
  };
};

// Scores by local date. Days off are left out
export const getDayScores = (events: StatsEvent[], now = Date.now()) => {
  const sortedEvents = [...events].sort((a, b) => a.at - b.at);
  const segments = buildSegments(sortedEvents, now);

  const eventsByDay = new Map<string, StatsEvent[]>();
  for (const event of sortedEvents) {
    const localDate = getLocalDate(event.at, event.tzOffsetMin);
    eventsByDay.set(localDate, [...(eventsByDay.get(localDate) ?? []), event]);
  }

  const scores: Record<string, DayScore> = {};
  for (const [localDate, dayEvents] of eventsByDay) {
    const score = scoreDay(dayEvents, segments, now);
    if (score) scores[localDate] = score;
  }
  return scores;
};

export const getTodayScore = (events: StatsEvent[], now = Date.now()) => {
  const latest = events.at(-1);
  if (!latest) return null;
  return getDayScores(events, now)[getLocalDate(now, latest.tzOffsetMin)] ?? null;
};

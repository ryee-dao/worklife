import { COMPLIANCE } from "../../shared/constants";
import type { StatsEvent } from "./stats";

export type DayResult = "CLEAN" | "PARTIAL" | "NOT_CLEAN";
type Activity = "RUNNING" | "STOPPED" | "OVERDUE" | "CLOSED";
type PieceKind = "COMPLIANT" | "VIOLATION" | "NOT_RUNNING";

// A stretch of time the app spent doing one thing
interface Segment {
  start: number;
  end: number;
  activity: Activity;
}

// A scored stretch of the workday, for the day's timeline strip
export interface Piece {
  start: number;
  end: number;
  kind: PieceKind;
}

export interface DayScore {
  localDate: string;           // "YYYY-MM-DD"
  result: DayResult | null;    // null while the workday is still going, or when the day doesn't count
  inProgress: boolean;
  compliance: number;          // Share of the workday that was compliant, 0 to 1
  bestPossible: number;        // The highest share still reachable today
  violated: boolean;
  cleanPossible: boolean;
  partialPossible: boolean;
  partialNeeded: number;       // Share needed for a partial: the threshold after a violation, otherwise the floor
  violatingNow: boolean;
  pieces: Piece[];
  workStart: number;
  workEnd: number;
  skipsUsed: number;
  allottedBreaks: number;
  snoozesUsed: number;
  allottedSnoozes: number;
}

const minuteMs = 60 * 1000;

// What the app is doing after each event. Events not listed (SNOOZED, HEARTBEAT) don't change it
const activityAfter: Partial<Record<StatsEvent["type"], Activity>> = {
  APP_STARTED: "RUNNING",
  RESUMED: "RUNNING",
  BREAK_STARTED: "RUNNING", // Taking the break is what we want, so it counts as compliant
  BREAK_SKIPPED: "RUNNING",
  BREAK_COMPLETED: "RUNNING",
  STOPPED: "STOPPED",
  OVERDUE_STARTED: "OVERDUE",
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
  const switchTo = (at: number, activity: Activity) => {
    const last = segments.at(-1);
    if (last) last.end = at;
    segments.push({ start: at, end: at, activity });
  };

  let lastEventAt = 0;
  for (const event of sortedEvents) {
    // Starting while the app was never closed means it crashed, at its last sign of life
    const last = segments.at(-1);
    if (event.type === "APP_STARTED" && last && last.activity !== "CLOSED") {
      switchTo(lastEventAt, "CLOSED");
    }

    const activity = activityAfter[event.type];
    if (activity && activity !== segments.at(-1)?.activity) {
      switchTo(event.at, activity);
    }
    lastEventAt = event.at;
  }

  const last = segments.at(-1);
  if (last) last.end = now;
  return segments;
};

const scoreDay = (dayEvents: StatsEvent[], segments: Segment[], now: number): DayScore | null => {
  // Each day is judged by the settings it started with
  const { config, tzOffsetMin, at } = dayEvents[0];
  const localDate = getLocalDate(at, tzOffsetMin);
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  if (!config.workday.days.includes(weekday)) return null;

  const workStart = toEpochMs(localDate, config.workday.start, tzOffsetMin);
  const workEnd = toEpochMs(localDate, config.workday.end, tzOffsetMin);
  const workdayMs = workEnd - workStart;
  const scoredUntil = Math.min(Math.max(now, workStart), workEnd); // Only score time that has happened
  const graceMs = config.timerDurationMs * COMPLIANCE.GRACE_RATIO;
  const overdueAllowanceMs = config.timerDurationMs * COMPLIANCE.OVERDUE_ALLOWANCE_RATIO;

  // Being closed before the day's first launch is a late start, not a violation
  const firstActive = segments.find(
    (segment) => segment.activity !== "CLOSED" && segment.end > workStart && segment.start < scoredUntil
  );
  const firstActiveAt = firstActive ? Math.max(firstActive.start, workStart) : Infinity;

  const pieces: Piece[] = [];
  const addPiece = (start: number, end: number, kind: PieceKind) => {
    const clippedStart = Math.max(start, workStart);
    const clippedEnd = Math.min(end, scoredUntil);
    if (clippedStart < clippedEnd) pieces.push({ start: clippedStart, end: clippedEnd, kind });
  };

  for (const segment of segments) {
    switch (segment.activity) {
      case "RUNNING":
        addPiece(segment.start, segment.end, "COMPLIANT");
        break;
      case "OVERDUE": {
        const allowanceEnd = segment.start + overdueAllowanceMs;
        addPiece(segment.start, Math.min(allowanceEnd, segment.end), "COMPLIANT");
        addPiece(allowanceEnd, segment.end, "VIOLATION");
        break;
      }
      case "STOPPED": {
        // A stop carried over from before work hours isn't a violation. The workday's auto stop is at the end, so it never lands here
        const isViolation = segment.start >= workStart;
        addPiece(segment.start, segment.end, isViolation ? "VIOLATION" : "NOT_RUNNING");
        break;
      }
      case "CLOSED": {
        const isRestart = segment.end - segment.start <= graceMs;
        const kind = segment.start < firstActiveAt ? "NOT_RUNNING" : isRestart ? "COMPLIANT" : "VIOLATION";
        addPiece(segment.start, segment.end, kind);
        break;
      }
    }
  }

  const compliantMs = pieces
    .filter((piece) => piece.kind === "COMPLIANT")
    .reduce((total, piece) => total + piece.end - piece.start, 0);
  const violated = pieces.some((piece) => piece.kind === "VIOLATION");
  const bestPossibleMs = compliantMs + (workEnd - scoredUntil);
  const partialNeeded = violated ? config.partialThreshold : COMPLIANCE.FLOOR_RATIO;
  const cleanPossible = !violated && bestPossibleMs >= workdayMs - graceMs;
  const partialPossible = bestPossibleMs / workdayMs >= partialNeeded;
  const inProgress = now < workEnd;
  const lastPiece = pieces.at(-1);

  let result: DayResult | null = null;
  if (!inProgress) {
    if (cleanPossible) result = "CLEAN";
    else if (compliantMs / workdayMs >= partialNeeded) result = "PARTIAL";
    else if (violated) result = "NOT_CLEAN";
  }

  return {
    localDate,
    result,
    inProgress,
    compliance: compliantMs / workdayMs,
    bestPossible: bestPossibleMs / workdayMs,
    violated,
    cleanPossible,
    partialPossible,
    partialNeeded,
    violatingNow: inProgress && lastPiece?.kind === "VIOLATION" && lastPiece.end === now,
    pieces,
    workStart,
    workEnd,
    skipsUsed: dayEvents.filter((event) => event.type === "BREAK_SKIPPED").length,
    allottedBreaks: config.allottedBreaks,
    snoozesUsed: dayEvents.filter((event) => event.type === "SNOOZED").length,
    allottedSnoozes: config.allottedSnoozes,
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

// A partial clean counts as half a day
export const countCleanDays = (scores: Record<string, DayScore>) => {
  const dayValues: Record<DayResult, number> = { CLEAN: 1, PARTIAL: 0.5, NOT_CLEAN: 0 };
  return Object.values(scores).reduce((total, score) => total + (score.result ? dayValues[score.result] : 0), 0);
};

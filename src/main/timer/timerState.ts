import { EventEmitter } from "events";
import { DEFAULTS, EVENTS, FILENAMES } from "../../shared/constants";
import { getAppliedTimerConfigs } from "../timer/timerConfigs";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../../shared/utils/files";
import { calculateRemainingBreakSkips, increaseSkippedBreakCount } from "../limit/limitState";
import { getAllottedBreaks, getBreakDurationMs } from "../difficulty/difficulty";

export type TimerStatus = "RUNNING" | "OVERDUE" | "PAUSED" | "BREAK";
export type Source = "WINDOW" | "TRAY" | "SCHEDULE"; // Where an action came from, SCHEDULE being the workday

// What happened in the timer, emitted on EVENTS.TIMER.TRANSITION for the stats log
export type TimerTransition =
  | { type: "APP_STARTED"; previousStatus: TimerStatus | null } // null = first run ever
  | { type: "PAUSED"; source: Source; countdownMs: number }
  | { type: "RESUMED"; source: Source; countdownMs: number }
  | { type: "OVERDUE_STARTED"; cause: "COUNTDOWN_ENDED" }
  | { type: "OVERDUE_STARTED"; cause: "TIMER_SKIPPED"; source: Source; countdownMs: number }
  | { type: "BREAK_STARTED"; source: Source; overdueMs: number }
  | { type: "BREAK_SKIPPED"; source: Source; from: "OVERDUE" | "BREAK"; overdueMs: number; breakElapsedMs: number; skipsLeft: number }
  | { type: "BREAK_COMPLETED" };
export type AvailableActions = "start" | "pause" | "skip" | "breaktime";
export interface TimerState {
  overdueTimeMs: number;
  currentCountdownMs: number;
  status: TimerStatus;
  availableActions: AvailableActions[];
  remainingSkips: number,
  allottedBreaks: number,
  isWarning: boolean;
  _bypassThreshold?: boolean
}

export interface StoredTimerState {
  overdueTimeMs: number;
  currentCountdownMs: number;
  status: TimerStatus;
  _bypassThreshold?: boolean // Only used in unit tests to bypass the {thresholdTimeMs} fallback
}

const writeIntervalMs = 30 * 1000; // 30 seconds
let tickCount = 0;
const tickIntervalMs = 1 * 1000; // 1 second
let timerState: TimerState | StoredTimerState;

let tickTimer: NodeJS.Timeout
const thresholdTimeMs = 1 * 60 * 1000; // Fallback delay time in case timeTilBreakMs is 0 immediately on startup
const defaultTimerData: StoredTimerState = {
  currentCountdownMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  status: "RUNNING",
  overdueTimeMs: 0,
};

export const timerEmitter = new EventEmitter();
const emitTransition = (transition: TimerTransition) => {
  timerEmitter.emit(EVENTS.TIMER.TRANSITION, transition);
};

export const initTimer = () => {
  const previousStatus = loadTimerStateFromFile();
  emitTransition({ type: "APP_STARTED", previousStatus });
  if (!timerState._bypassThreshold) {
    fallbackTimer();
  }
  timerState.overdueTimeMs = 0;
  tickCount = 0;
  runTimer();
};

export const destroyTimers = () => {
  clearInterval(tickTimer);
};

const fallbackTimer = () => {
  // Fallback time delay so break time doesn't start too soon on startup
  if (
    timerState.currentCountdownMs <= thresholdTimeMs ||
    timerState.status === "BREAK"
  ) {
    timerState.currentCountdownMs = thresholdTimeMs;
    timerState.status = "RUNNING";
  }
}

const getAvailableActions = (status: TimerStatus): AvailableActions[] => {
  const availableActions: AvailableActions[] = [];
  switch (status) {
    case "RUNNING":
      availableActions.push("pause");
      availableActions.push("skip");
      return availableActions;
    case "PAUSED":
      availableActions.push("start");
      return availableActions;
    case "OVERDUE":
      availableActions.push("breaktime");
      if (calculateRemainingBreakSkips() > 0) {
        availableActions.push("skip");
      }
      return availableActions;
    case "BREAK":
      if (calculateRemainingBreakSkips() > 0) {
        availableActions.push("skip");
      }
      return availableActions;
  }
};

export const emitTimerStatus = () => {
  /*
    NOTE: 
      Use this function to emit the timer state if its in {TimerStatus},
      otherwise, the timer status may be emitted to the UI without the state itself,
      which may cause bugs
  */

  // Given the status, emit the event and the state itself
  const statusMapper: Record<TimerStatus, string> = {
    RUNNING: EVENTS.TIMER.RUNNING,
    BREAK: EVENTS.TIMER.ON_BREAK,
    PAUSED: EVENTS.TIMER.PAUSED,
    OVERDUE: EVENTS.TIMER.ON_OVERDUE,
  };

  // Emit along additional data along with the timer state
  const stateWithActions = getTimerState();
  console.log('emitTimerStatus()', statusMapper[timerState.status], stateWithActions)
  timerEmitter.emit(statusMapper[timerState.status], stateWithActions);
};

const onTick = () => {
  // Using ticks to count down, otherwise paused status will also count down timer
  tickCount++;
  checkTimer();
  emitTimerStatus();

  // Write to file every {writeIntervalMs} seconds - based on number of ticks (1 tick = 1000ms = 1 second)
  if (writeIntervalMs / 1000 === tickCount) {
    writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
    tickCount = 0;
  }
};

const checkTimer = () => {
  console.log('checkTimer()', timerState);

  // Perform logic on timerState based on status
  switch (timerState.status) {
    case "PAUSED":
      break;
    case "RUNNING":
      timerState.currentCountdownMs -= tickIntervalMs;
      if (timerState.currentCountdownMs === getAppliedTimerConfigs().warningThresholdMs) {
        timerEmitter.emit(EVENTS.TIMER.WARNING);
      }
      if (timerState.currentCountdownMs <= 0) {
        emitTransition({ type: "OVERDUE_STARTED", cause: "COUNTDOWN_ENDED" });
        transitionToNextState();
      }
      break;
    case "BREAK":
      timerState.currentCountdownMs -= tickIntervalMs;
      if (timerState.currentCountdownMs <= 0) {
        emitTransition({ type: "BREAK_COMPLETED" });
        transitionToNextState();
      }
      break;
    case "OVERDUE":
      timerState.overdueTimeMs += tickIntervalMs;
      break;
  }
};

const transitionToNextState = () => {
  switch (timerState.status) {
    case "RUNNING":
      timerState.status = "OVERDUE";
      timerState.currentCountdownMs = 0;
      timerState.overdueTimeMs = 0;
      timerEmitter.emit(EVENTS.TIMER.START_OVERDUE);
      break;
    case "OVERDUE":
      timerState.status = "BREAK";
      timerState.currentCountdownMs = getBreakDurationMs();
      timerState.overdueTimeMs = 0;
      timerEmitter.emit(EVENTS.TIMER.START_BREAK);
      break;
    case "BREAK":
      timerEmitter.emit(EVENTS.TIMER.STOP_BREAK); // Place before changes so the configs update before status change
      timerState.status = "RUNNING";
      timerState.currentCountdownMs = getAppliedTimerConfigs().timerDurationMs;
      timerState.overdueTimeMs = 0;
      break;
    default:
      console.warn(`Unexpected transition from: ${timerState.status}`);
  }
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const pauseTimer = (source: Source) => {
  if (timerState.status !== "RUNNING") return; // A stale menu or window can send this after the status changed
  emitTransition({ type: "PAUSED", source, countdownMs: timerState.currentCountdownMs });
  // clearInterval(tickTimer);
  timerState.status = "PAUSED";
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const startTimer = (source: Source) => {
  if (timerState.status !== "PAUSED") return; // A stale menu or window can send this after the status changed
  emitTransition({ type: "RESUMED", source, countdownMs: timerState.currentCountdownMs });
  runTimer();
};

const runTimer = () => {
  clearInterval(tickTimer);
  // When running e2e tests, we don't set an interval to control the timing
  // This is to prevent flakiness in tests
  if (!process.env.PLAYWRIGHT_TEST) {
    tickTimer = setInterval(onTick, tickIntervalMs);
  }
  timerState.status = "RUNNING";
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const startBreak = (source: Source) => {
  if (timerState.status !== "OVERDUE") {
    return;
  }
  emitTransition({ type: "BREAK_STARTED", source, overdueMs: timerState.overdueTimeMs });
  clearInterval(tickTimer); // Clear any existing tick intervals

  // When running e2e tests, we don't set an interval to control the timing
  // This is to prevent flakiness in tests
  if (!process.env.PLAYWRIGHT_TEST) {
    tickTimer = setInterval(onTick, tickIntervalMs);
  }
  transitionToNextState();
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const skipBreak = (source: Source) => {
  if (calculateRemainingBreakSkips() <= 0) return;
  if (timerState.status !== "BREAK" && timerState.status !== "OVERDUE") return; // Guard against wrong state
  increaseSkippedBreakCount();
  const isBreak = timerState.status === "BREAK";
  emitTransition({
    type: "BREAK_SKIPPED",
    source,
    from: timerState.status,
    overdueMs: timerState.overdueTimeMs,
    breakElapsedMs: isBreak ? getBreakDurationMs() - timerState.currentCountdownMs : 0,
    skipsLeft: calculateRemainingBreakSkips(),
  });
  timerState.status = "BREAK";
  transitionToNextState();
  emitTimerStatus();
};

export const skipTimer = (source: Source) => {
  if (timerState.status !== "RUNNING") return; // A stale menu or window can send this after the status changed
  emitTransition({ type: "OVERDUE_STARTED", cause: "TIMER_SKIPPED", source, countdownMs: timerState.currentCountdownMs });
  timerState.currentCountdownMs = 0;
  transitionToNextState();
  emitTimerStatus();
};

const isInWarning = () => {
  const { warningThresholdMs } = getAppliedTimerConfigs();
  return (
    timerState.status === "RUNNING" &&
    !!warningThresholdMs &&
    timerState.currentCountdownMs > 0 &&
    timerState.currentCountdownMs <= warningThresholdMs
  );
};

// Returns the status saved by the last run, or null on the first run ever
const loadTimerStateFromFile = (): TimerStatus | null => {
  const timerData = getUserDataFromFile<TimerState>(FILENAMES.TIMER.STATE);

  // If no timer data is returned, set new state in file
  timerState = { ...defaultTimerData, ...timerData?.fileContent }
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);

  console.log("init timer", JSON.stringify(timerState));
  return timerData?.fileContent?.status ?? null;
};

export const getTimerState = (): TimerState => ({
  ...timerState,
  availableActions: getAvailableActions(timerState.status),
  remainingSkips: Math.max(0, calculateRemainingBreakSkips()),
  allottedBreaks: getAllottedBreaks(),
  isWarning: isInWarning(),
});

// Expose a function that allows end to end tests to manually speed up timers 
if (process.env.PLAYWRIGHT_TEST) {
  global.__test_fastForwardTimerOneSecond = () => {
    // Can only fast forward one second/tick at a time 
    // because for some reason, the event loop doesn't allow batches (not sure why)
    onTick();
  };
}
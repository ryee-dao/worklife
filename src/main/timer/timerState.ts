import { EventEmitter } from "events";
import { DEFAULTS, EVENTS, FILENAMES } from "../../shared/constants";
import { getAppliedTimerConfigs } from "../timer/timerConfigs";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../../shared/utils/files";
import { calculateRemainingLunches, calculateRemainingPowerups, increaseLunchesUsed, increasePowerupsUsed } from "../limit/limitState";
import { getAllottedPowerups, getBreakDurationMs, getLunchDurationMs, getSnoozeDurationMs } from "../difficulty/difficulty";

export type TimerStatus = "RUNNING" | "OVERDUE" | "STOPPED" | "BREAK" | "LUNCH";
export type Source = "WINDOW" | "TRAY" | "SCHEDULE"; // Where an action came from, SCHEDULE being the workday

// What happened in the timer, emitted on EVENTS.TIMER.TRANSITION for the stats log
export type TimerTransition =
  | { type: "APP_STARTED"; previousStatus: TimerStatus | null } // null = first run ever
  | { type: "STOPPED"; source: Source; from: "RUNNING" | "OVERDUE" | "BREAK"; countdownMs: number }
  | { type: "RESUMED"; source: Source; countdownMs: number }
  | { type: "OVERDUE_STARTED"; cause: "COUNTDOWN_ENDED" }
  | { type: "OVERDUE_STARTED"; cause: "TIMER_SKIPPED"; source: Source; countdownMs: number } // Forward to break, named before the rename
  | { type: "BREAK_STARTED"; source: Source; overdueMs: number }
  | { type: "BREAK_SKIPPED"; source: Source; from: "OVERDUE" | "BREAK"; overdueMs: number; breakElapsedMs: number; powerupsLeft: number }
  | { type: "BREAK_COMPLETED" }
  | { type: "SNOOZED"; source: Source; snoozeMs: number; countdownMs: number; powerupsLeft: number }
  | { type: "LUNCH_STARTED"; source: Source; from: "RUNNING" | "OVERDUE"; lunchMs: number }
  | { type: "LUNCH_ENDED"; cause: "TIME_UP" }
  | { type: "LUNCH_ENDED"; cause: "ENDED_EARLY"; source: Source; lunchLeftMs: number };
export type AvailableActions = "start" | "stop" | "forward" | "skip" | "breaktime" | "snooze" | "lunch";
export interface TimerState {
  overdueTimeMs: number;
  currentCountdownMs: number;
  status: TimerStatus;
  availableActions: AvailableActions[];
  remainingPowerups: number,
  allottedPowerups: number,
  remainingLunches: number,
  snoozeDurationMs: number,
  lunchDurationMs: number,
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
  // A restart ends lunch, back to work with a full timer
  if (timerState.status === "LUNCH") {
    timerState.currentCountdownMs = getAppliedTimerConfigs().timerDurationMs;
  }
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

// Stop is offered on the break screens too, as an escape hatch. It costs a checkpoint like any stop
const getAvailableActions = (status: TimerStatus): AvailableActions[] => {
  const availableActions: AvailableActions[] = [];
  const hasPowerups = calculateRemainingPowerups() > 0;
  const hasLunch = calculateRemainingLunches() > 0;
  switch (status) {
    case "RUNNING":
      availableActions.push("stop");
      availableActions.push("forward");
      if (hasPowerups) {
        availableActions.push("snooze");
      }
      if (hasLunch) {
        availableActions.push("lunch");
      }
      return availableActions;
    case "STOPPED":
    case "LUNCH": // Starting during lunch ends it early
      availableActions.push("start");
      return availableActions;
    case "OVERDUE":
      availableActions.push("breaktime");
      if (hasPowerups) {
        availableActions.push("skip");
      }
      if (hasLunch) {
        availableActions.push("lunch");
      }
      availableActions.push("stop");
      return availableActions;
    case "BREAK":
      if (hasPowerups) {
        availableActions.push("skip");
      }
      availableActions.push("stop");
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
    STOPPED: EVENTS.TIMER.STOPPED,
    OVERDUE: EVENTS.TIMER.ON_OVERDUE,
    LUNCH: EVENTS.TIMER.ON_LUNCH,
  };

  // Emit along additional data along with the timer state
  const stateWithActions = getTimerState();
  console.log('emitTimerStatus()', statusMapper[timerState.status], stateWithActions)
  timerEmitter.emit(statusMapper[timerState.status], stateWithActions);
};

const onTick = () => {
  // Using ticks to count down, otherwise stopped status will also count down timer
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
    case "STOPPED":
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
    case "LUNCH":
      timerState.currentCountdownMs -= tickIntervalMs;
      if (timerState.currentCountdownMs <= 0) {
        emitTransition({ type: "LUNCH_ENDED", cause: "TIME_UP" });
        transitionToNextState();
      }
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
    case "LUNCH": // Back to work with a full timer
      timerState.status = "RUNNING";
      timerState.currentCountdownMs = getAppliedTimerConfigs().timerDurationMs;
      timerState.overdueTimeMs = 0;
      break;
    default:
      console.warn(`Unexpected transition from: ${timerState.status}`);
  }
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const stopTimer = (source: Source) => {
  const from = timerState.status;
  if (from !== "RUNNING" && from !== "OVERDUE" && from !== "BREAK") return; // A stale menu or window can send this after the status changed
  emitTransition({ type: "STOPPED", source, from, countdownMs: timerState.currentCountdownMs });
  // Stopping from a break screen closes it, and resuming later starts a fresh work session
  if (from !== "RUNNING") {
    timerEmitter.emit(EVENTS.TIMER.STOP_BREAK); // Before the countdown resets, so it uses the configs applied after the break
    timerState.currentCountdownMs = getAppliedTimerConfigs().timerDurationMs;
    timerState.overdueTimeMs = 0;
  }
  timerState.status = "STOPPED";
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const startTimer = (source: Source) => {
  if (timerState.status === "LUNCH") {
    emitTransition({ type: "LUNCH_ENDED", cause: "ENDED_EARLY", source, lunchLeftMs: timerState.currentCountdownMs });
    transitionToNextState();
    emitTimerStatus();
    return;
  }
  if (timerState.status !== "STOPPED") return; // A stale menu or window can send this after the status changed
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
  if (calculateRemainingPowerups() <= 0) return;
  if (timerState.status !== "BREAK" && timerState.status !== "OVERDUE") return; // Guard against wrong state
  increasePowerupsUsed();
  const isBreak = timerState.status === "BREAK";
  emitTransition({
    type: "BREAK_SKIPPED",
    source,
    from: timerState.status,
    overdueMs: timerState.overdueTimeMs,
    breakElapsedMs: isBreak ? getBreakDurationMs() - timerState.currentCountdownMs : 0,
    powerupsLeft: calculateRemainingPowerups(),
  });
  timerState.status = "BREAK";
  transitionToNextState();
  emitTimerStatus();
};

export const forwardToBreak = (source: Source) => {
  if (timerState.status !== "RUNNING") return; // A stale menu or window can send this after the status changed
  emitTransition({ type: "OVERDUE_STARTED", cause: "TIMER_SKIPPED", source, countdownMs: timerState.currentCountdownMs });
  timerState.currentCountdownMs = 0;
  transitionToNextState();
  emitTimerStatus();
};

export const snoozeTimer = (source: Source) => {
  if (timerState.status !== "RUNNING") return; // Once overdue, a skip is the way out
  if (calculateRemainingPowerups() <= 0) return;
  increasePowerupsUsed();
  const snoozeMs = getSnoozeDurationMs();
  emitTransition({
    type: "SNOOZED",
    source,
    snoozeMs,
    countdownMs: timerState.currentCountdownMs,
    powerupsLeft: calculateRemainingPowerups(),
  });
  timerState.currentCountdownMs += snoozeMs;
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

// Lunch pauses the day without breaking the checkpoint climb. Taking it while overdue counts as taking the break
export const startLunch = (source: Source) => {
  const from = timerState.status;
  if (from !== "RUNNING" && from !== "OVERDUE") return;
  if (calculateRemainingLunches() <= 0) return;
  increaseLunchesUsed();
  const lunchMs = getLunchDurationMs();
  emitTransition({ type: "LUNCH_STARTED", source, from, lunchMs });
  if (from === "OVERDUE") {
    timerEmitter.emit(EVENTS.TIMER.STOP_BREAK); // Closes the overdue window
  }
  timerState.status = "LUNCH";
  timerState.currentCountdownMs = lunchMs;
  timerState.overdueTimeMs = 0;
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
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
  remainingPowerups: Math.max(0, calculateRemainingPowerups()),
  allottedPowerups: getAllottedPowerups(),
  remainingLunches: Math.max(0, calculateRemainingLunches()),
  snoozeDurationMs: getSnoozeDurationMs(),
  lunchDurationMs: getLunchDurationMs(),
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
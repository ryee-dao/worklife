import { EventEmitter } from "events";
import { DEFAULTS, EVENTS, FILENAMES } from "../../shared/constants";
import { getTimerConfigs } from "../timer/timerConfigs";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../../shared/utils/files";
import { calculateRemainingBreakSkips } from "../limit/limitState";
import { getLimitConfigs } from "../limit/limitConfigs";

export type TimerStatus = "RUNNING" | "OVERDUE" | "PAUSED" | "BREAK";
export type AvailableActions = "start" | "pause" | "skip" | "breaktime";
export interface TimerState {
  overdueTimeMs: number;
  currentCountdownMs: number;
  status: TimerStatus;
  availableActions: AvailableActions[];
  remainingSkips: number,
  allotedBreaks: number,
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
let newTimerTimeMs: number;
let breakTimeMs: number;
let warningThresholdMs: number;
const thresholdTimeMs = 1 * 60 * 1000; // Fallback delay time in case timeTilBreakMs is 0 immediately on startup
const defaultTimerData: StoredTimerState = {
  currentCountdownMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  status: "RUNNING",
  overdueTimeMs: 0,
};

export const timerEmitter = new EventEmitter();
export const initTimer = () => {
  loadTimerStateFromFile();
  loadTimerConfigsIntoState();
  if (!timerState._bypassThreshold) {
    fallbackTimer();
  }
  timerState.overdueTimeMs = 0;
  tickCount = 0;
  startTimer();
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
  const stateWithActions: TimerState = {
    ...timerState,
    availableActions: getAvailableActions(timerState.status),
    remainingSkips: Math.max(0, calculateRemainingBreakSkips()),
    allotedBreaks: getLimitConfigs().allotedBreaks
  };
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
      if (timerState.currentCountdownMs === warningThresholdMs) {
        timerEmitter.emit(EVENTS.TIMER.WARNING);
      }
      if (timerState.currentCountdownMs <= 0) {
        transitionToNextState();
      }
      break;
    case "BREAK":
      timerState.currentCountdownMs -= tickIntervalMs;
      if (timerState.currentCountdownMs <= 0) {
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
      timerState.currentCountdownMs = breakTimeMs;
      timerState.overdueTimeMs = 0;
      timerEmitter.emit(EVENTS.TIMER.START_BREAK);
      break;
    case "BREAK":
      timerEmitter.emit(EVENTS.TIMER.STOP_BREAK); // Place before changes so the configs update before status change
      timerState.status = "RUNNING";
      timerState.currentCountdownMs = newTimerTimeMs;
      timerState.overdueTimeMs = 0;
      break;
    default:
      console.warn(`Unexpected transition from: ${timerState.status}`);
  }
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const pauseTimer = () => {
  // clearInterval(tickTimer);
  timerState.status = "PAUSED";
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const startTimer = () => {
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

export const startBreak = () => {
  if (timerState.status !== "OVERDUE") {
    return;
  }
  clearInterval(tickTimer); // Clear any existing tick intervals

  // When running e2e tests, we don't set an interval to control the timing
  // This is to prevent flakiness in tests
  if (!process.env.PLAYWRIGHT_TEST) {
    tickTimer = setInterval(onTick, tickIntervalMs);
  }
  timerState.status = "BREAK";
  timerState.currentCountdownMs = breakTimeMs;
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const skipBreak = () => {
  if (timerState.status !== "BREAK" && timerState.status !== "OVERDUE") return; // Guard against wrong state
  timerState.status = "BREAK";
  timerState.currentCountdownMs = 0;   // next tick transitions BREAK → RUNNING
};

export const skipTimer = () => {
  timerState.currentCountdownMs = 0;
  emitTimerStatus();
  transitionToNextState()
};

const loadTimerStateFromFile = () => {
  const timerData = getUserDataFromFile<TimerState>(FILENAMES.TIMER.STATE);

  // If no timer data is returned, set new state in file
  timerState = { ...defaultTimerData, ...timerData?.fileContent }
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);

  console.log("init timer", JSON.stringify(timerState));
};

export const loadTimerConfigsIntoState = () => {
  const timerConfigs = getTimerConfigs();
  newTimerTimeMs = timerConfigs.timerDurationMs;
  breakTimeMs = timerConfigs.breakDurationMs;
  warningThresholdMs = timerConfigs.warningThresholdMs;
};

export const getTimerState = () => {
  return timerState
};

// Expose a function that allows end to end tests to manually speed up timers 
if (process.env.PLAYWRIGHT_TEST) {
  global.__test_fastForwardTimerOneSecond = () => {
    // Can only fast forward one second/tick at a time 
    // because for some reason, the event loop doesn't allow batches (not sure why)
    onTick();
  };
}
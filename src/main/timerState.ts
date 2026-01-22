import { EventEmitter } from "events";
import { DEFAULTS, EVENTS, FILENAMES } from "../shared/constants";
import { getTimerSettingsData } from "./timerConfigs";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "../shared/utils/files";
import { calculateRemainingBreakSkips, getLimitState } from "./limitState";
import { getLimitConfig } from "./limitConfigs";

export type TimerStatus = "RUNNING" | "PAUSED" | "BREAK";
export type AvailableActions = "start" | "pause" | "skip";
export interface TimerState {
  currentCountdownMs: number;
  status: TimerStatus;
  availableActions: AvailableActions[];
  remainingSkips: number,
  allotedBreaks: number
}

interface StoredTimerState {
  currentCountdownMs: number;
  status: TimerStatus;
}

const writeIntervalMs = 30 * 1000; // 30 seconds
let tickCount = 0;
const tickIntervalMs = 1 * 1000; // 1 second
let timerState: TimerState | StoredTimerState;
let tickTimer: NodeJS.Timeout, emitTimer: NodeJS.Timeout;
let newTimerTimeMs: number;
let breakTimeMs: number;
const thresholdTimeMs = 1 * 60 * 1000; // Fallback delay time in case timeTilBreakMs is 0 immediately on startup
const defaultTimerData: StoredTimerState = {
  currentCountdownMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  status: "RUNNING",
};

export const timerEmitter = new EventEmitter();
export const initTimer = () => {
  loadTimerStateFromFile();
  loadTimerConfigsIntoState();
  // Fallback time delay so break time doesn't start too soon on startup
  if (
    timerState.currentCountdownMs <= thresholdTimeMs ||
    timerState.status === "BREAK"
  ) {
    timerState.currentCountdownMs = thresholdTimeMs;
    timerState.status = "RUNNING";
  }
  startTimer();
  emitTimer = setInterval(emitTimerStatus, tickIntervalMs); // Emit event every second
};

const getAvailableActions = (status: TimerStatus): AvailableActions[] => {
  let availableActions: AvailableActions[] = [];
  switch (status) {
    case "RUNNING":
      availableActions.push("pause");
      availableActions.push("skip");
      return availableActions;
    case "PAUSED":
      availableActions.push("start");
      return availableActions;
    case "BREAK":
      if (calculateRemainingBreakSkips() > 0) {
        availableActions.push("skip");
      }
      return availableActions;
  }
};

const emitTimerStatus = () => {
  // Given the status, emit the event and the state itself
  const statusMapper: Record<TimerStatus, string> = {
    RUNNING: EVENTS.TIMER.RUNNING,
    BREAK: EVENTS.TIMER.ON_BREAK,
    PAUSED: EVENTS.TIMER.PAUSED,
  };

  // Emit along with the state, the available actions
  const stateWithActions: TimerState = {
    ...timerState,
    availableActions: getAvailableActions(timerState.status),
    remainingSkips: Math.max(0, calculateRemainingBreakSkips()),
    allotedBreaks: getLimitConfig().allotedBreaks
  };
  timerEmitter.emit(statusMapper[timerState.status], stateWithActions);
};

const onTick = () => {
  tickCount++;
  checkTimer();

  // Write to file every {writeIntervalMs} seconds - based on number of ticks (1 tick = 1000ms = 1 second)
  // Doing it this way, otherwise paused status will not trigger saves
  if (writeIntervalMs / tickCount === 1000) {
    writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
    tickCount = 0;
  }
};

const checkTimer = () => {
  // Don't count down if paused
  if (timerState.status === "PAUSED") return;

  // Countdown
  timerState.currentCountdownMs -= tickIntervalMs;
  console.log(timerState);

  // Check for transition
  if (timerState.currentCountdownMs <= 0) {
    transitionToNextState();
  }
};

const transitionToNextState = () => {
  switch (timerState.status) {
    case "RUNNING":
      timerState.status = "BREAK";
      timerState.currentCountdownMs = breakTimeMs;
      timerEmitter.emit(EVENTS.TIMER.START_BREAK);
      break;

    case "BREAK":
      timerEmitter.emit(EVENTS.TIMER.STOP_BREAK);
      timerState.status = "RUNNING";
      timerState.currentCountdownMs = newTimerTimeMs;
      timerEmitter.emit(EVENTS.TIMER.RUNNING);
      loadTimerConfigsIntoState(); // Update timer config changes only after break
      break;

    default:
      console.warn(`Unexpected transition from: ${timerState.status}`);
  }
};

export const pauseTimer = () => {
  clearInterval(tickTimer);
  timerState.status = "PAUSED";
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const startTimer = () => {
  clearInterval(tickTimer); // Clear any existing tick intervals
  tickTimer = setInterval(onTick, tickIntervalMs);
  timerState.status = "RUNNING";
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const skipBreak = () => {
  timerState.status = "BREAK";
  timerState.currentCountdownMs = 0;
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

export const skipTimer = () => {
  timerState.status = "RUNNING";
  timerState.currentCountdownMs = 0;
  emitTimerStatus();
  writeToUserDataFile(FILENAMES.TIMER.STATE, timerState);
};

const loadTimerStateFromFile = () => {
  let timerData = getUserDataFromFile<TimerState>(FILENAMES.TIMER.STATE);
  // If no timer data is returned, set new state in file
  if (!timerData.fileContent) {
    writeToUserDataFile(FILENAMES.TIMER.STATE, defaultTimerData);
    timerState = defaultTimerData;
  } else {
    timerState = timerData.fileContent;
  }
  console.log("init timer", JSON.stringify(timerState));
};

export const loadTimerConfigsIntoState = () => {
  const timerConfig = getTimerSettingsData();
  newTimerTimeMs = timerConfig.timerDurationMs;
  breakTimeMs = timerConfig.breakDurationMs;
};

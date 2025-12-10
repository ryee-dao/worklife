import { app } from "electron";
import path from "path";
import fs from "fs";
import { EventEmitter } from "events";
import { EVENTS } from "../shared/constants";
import { appEnvironment } from "./main";

export type TimerStatus = "RUNNING" | "PAUSED" | "BREAK";
export type AvailableActions = "start" | "pause" | "skip"
export interface TimerState {
  currentCountdownMs: number;
  status: TimerStatus;
  availableActions: AvailableActions[];
}

interface StoredTimerState {
  currentCountdownMs: number;
  status: TimerStatus;
}
interface TimerStateData {
  filePath: string;
  fileContent: StoredTimerState;
}

const writeIntervalMs = 30 * 1000; // 30 seconds
let tickCount = 0;
const tickIntervalMs = 1 * 1000; // 1 second
const timerStateFileName = "timerState.json";
let timerState: TimerState | StoredTimerState;
let tickTimer: NodeJS.Timeout,
  emitTimer: NodeJS.Timeout,
  writeTimer: NodeJS.Timeout;
const newTimerTimeMs = 1 * 60 * 1000;
const breakTimeMs = 45 * 1000;
const thresholdTimeMs = 30 * 1000; // Fallback delay time in case timeTilBreakMs is 0 immediately on startup
const newTimerData: StoredTimerState = {
  currentCountdownMs: newTimerTimeMs,
  status: "RUNNING",
};
let nextStatus: TimerStatus, nextEvent: string, nextTimerMs: number;

export const timerEmitter = new EventEmitter();
export const initTimer = () => {
  loadTimerStateFromFile();
  // Fallback time delay so break time doesn't start too soon on startup
  if (timerState.currentCountdownMs <= thresholdTimeMs) {
    timerState.currentCountdownMs = thresholdTimeMs;
    timerState.status = "RUNNING";
  }
  startTimer();
  emitTimer = setInterval(emitTimerStatus, tickIntervalMs); // Emit event every second
};

const getAvailableActions = (status: TimerStatus): AvailableActions[] => {
  switch (status) {
    case "RUNNING": return ["pause"];
    case "PAUSED": return ["start"];
    case "BREAK": return [];
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
  };
  timerEmitter.emit(statusMapper[timerState.status], stateWithActions);
};

const writeTimerStateToFile = () => {
  // Write new timer state to file
  fs.writeFileSync(
    path.join(app.getPath("userData"), timerStateFileName),
    JSON.stringify(timerState)
  );
  console.log(JSON.stringify(timerState));
};

const onTick = () => {
  tickCount++;
  checkTimer();

  // If the writeIntervalMs is reached based on number of ticks (1 tick = 1000ms = 1 second)
  if (writeIntervalMs / tickCount === 1000) {
    writeTimerStateToFile();
    tickCount = 0;
  }
};

const checkTimer = () => {
  // Don't tick if paused
  if (timerState.status === "PAUSED") return;
  
  // Countdown
  timerState.currentCountdownMs -= tickIntervalMs;
  
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
      timerState.status = "RUNNING";
      timerState.currentCountdownMs = newTimerTimeMs;
      timerEmitter.emit(EVENTS.TIMER.RUNNING);
      break;
      
    default:
      console.warn(`Unexpected transition from: ${timerState.status}`);
  }
};

export const pauseTimer = () => {
  clearInterval(tickTimer);
  timerState.status = "PAUSED";
  emitTimerStatus();
  writeTimerStateToFile()
};

export const startTimer = () => {
  clearInterval(tickTimer); // Clear any existing tick intervals
  tickTimer = setInterval(onTick, tickIntervalMs);
  timerState.status = "RUNNING";
  emitTimerStatus();
  writeTimerStateToFile()
};

const getTimerStateData = (): TimerStateData => {
  const filePath = path.join(app.getPath("userData"), timerStateFileName);
  let fileContent = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : undefined;
  return { filePath, fileContent };
};

const loadTimerStateFromFile = () => {
  let timerData = getTimerStateData();
  // If no timer data is returned, set new state in file
  if (!timerData.fileContent) {
    fs.writeFileSync(
      path.join(app.getPath("userData"), timerStateFileName),
      JSON.stringify(newTimerData)
    );
    timerState = newTimerData;
  } else {
    timerState = timerData.fileContent;
  }
  console.log("init timer", JSON.stringify(timerState));
};

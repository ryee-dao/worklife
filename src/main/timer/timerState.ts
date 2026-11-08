import { EventEmitter } from "events";
import { DEFAULTS, EVENTS, FILENAMES } from "@shared/constants";
import { getAppliedTimerConfigs, getTimerConfigs } from "@main/timer/timerConfigs";
import {
  getUserDataFromFile,
  writeToUserDataFile,
} from "@shared/utils/files";
import { calculateRemainingLunches, calculateRemainingPowerups, increaseLunchesUsed, increasePowerupsUsed } from "@main/limit/limitState";
import { getAllottedPowerups, getBreakDurationMs, getLunchDurationMs, getSnoozeDurationMs } from "@main/difficulty/difficulty";
import { IS_TEST } from "@main/testEnv";
import { act, tick, TICK_MS, timerStateOf, TimerCore, TimerEffect, TimerRules, TimerStep } from "./timerRules";
import type { AvailableActions, Source, TimerStatus, TimerTransition } from "./timerRules";

export type { AvailableActions, Source, TimerState, TimerStatus, TimerTransition } from "./timerRules";

export interface StoredTimerState extends TimerCore {
  savedAt?: number;          // So a relaunch knows how long the app was closed
  _bypassThreshold?: boolean // Only used in unit tests to bypass the {startupGraceMs} fallback
}

const writeIntervalMs = 30 * 1000; // 30 seconds
let tickCount = 0;
let timerState: StoredTimerState;

let tickTimer: NodeJS.Timeout
let heldTick: (() => void) | null = null; // The tour's clock, run in the timer's place while a tour holds it

// The one interval: the timer's tick, or the tour's while it holds the timer
const startTicking = () => {
  clearInterval(tickTimer);
  // When running e2e tests, there's no interval, so the tests control the timing themselves
  if (!IS_TEST) {
    tickTimer = setInterval(heldTick ?? onTick, TICK_MS);
  }
};
const startupGraceMs = 1 * 60 * 1000; // A relaunch gets at least this long before the overdue window
const defaultTimerData: StoredTimerState = {
  currentCountdownMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  status: "RUNNING",
  overdueTimeMs: 0,
};

export const timerEmitter = new EventEmitter();
const emitTransition = (transition: TimerTransition) => {
  timerEmitter.emit(EVENTS.TIMER.TRANSITION, transition);
};

// The settings in force and what's left of the day's power-ups and lunch
const rules = (): TimerRules => ({
  workMs: getAppliedTimerConfigs().timerDurationMs,
  nextWorkMs: getTimerConfigs().timerDurationMs,
  breakMs: getBreakDurationMs(),
  snoozeMs: getSnoozeDurationMs(),
  lunchMs: getLunchDurationMs(),
  warningMs: getAppliedTimerConfigs().warningThresholdMs,
  powerups: getAllottedPowerups(),
  powerupsLeft: calculateRemainingPowerups(),
  lunchesLeft: calculateRemainingLunches(),
});

const STATUS_EVENTS: Record<TimerStatus, string> = {
  RUNNING: EVENTS.TIMER.RUNNING,
  BREAK: EVENTS.TIMER.ON_BREAK,
  STOPPED: EVENTS.TIMER.STOPPED,
  OVERDUE: EVENTS.TIMER.ON_OVERDUE,
  LUNCH: EVENTS.TIMER.ON_LUNCH,
};

const EFFECT_EVENTS: Partial<Record<TimerEffect, string>> = {
  OPEN_OVERDUE: EVENTS.TIMER.START_OVERDUE,
  OPEN_BREAK: EVENTS.TIMER.START_BREAK,
  CLOSE_BREAK: EVENTS.TIMER.STOP_BREAK, // Closes the window, and applies saved configs: the step already used them for the next work block
  WARNING: EVENTS.TIMER.WARNING,
};

// Takes a step. The stats log hears the transition first, with the configs of its moment
const apply = (step: TimerStep | null) => {
  if (!step) return false;
  if (step.transition) emitTransition(step.transition);
  timerState = { ...timerState, ...step.core };
  for (const effect of step.effects) {
    if (effect === "SPEND_POWERUP") increasePowerupsUsed();
    else if (effect === "SPEND_LUNCH") increaseLunchesUsed();
    else timerEmitter.emit(EFFECT_EVENTS[effect]!);
  }
  return true;
};

export const initTimer = () => {
  const saved = loadTimerStateFromFile();
  emitTransition({ type: "APP_STARTED", previousStatus: saved?.status ?? null });
  if (timerState.status === "LUNCH") {
    // Lunch goes on while the app is closed. Once it has run out, it's back to work with a full timer
    const lunchLeftMs = timerState.currentCountdownMs - (Date.now() - (saved?.savedAt ?? Date.now()));
    if (lunchLeftMs > 0) timerState.currentCountdownMs = lunchLeftMs;
    else timerState = { status: "RUNNING", currentCountdownMs: getAppliedTimerConfigs().timerDurationMs, overdueTimeMs: 0 };
  } else {
    if (!timerState._bypassThreshold) applyStartupGrace();
    timerState.status = "RUNNING";
  }
  timerState.overdueTimeMs = 0;
  tickCount = 0;
  startTicking();
  emitTimerStatus();
  save();
};

// Saves on the way out, since ticks only save every 30 seconds
export const destroyTimers = () => {
  clearInterval(tickTimer);
  if (timerState) save();
};

// shortcut: a crash leaves savedAt up to 30 seconds stale, like the countdown it was saved with; fine unless lunch relaunches need to be exact
const save = () => writeToUserDataFile(FILENAMES.TIMER.STATE, { ...timerState, savedAt: Date.now() });

// A tour holds the timer: no ticks and nothing logged, with the tour's own clock in the interval's place
export const holdTimer = (tick: () => void) => {
  heldTick = tick;
  startTicking();
};

export const releaseTimer = () => {
  heldTick = null;
  startTicking();
};

// The first run waits for the tour's start prompt. Nothing is logged: no work was interrupted
export const holdForFirstRun = () => {
  timerState.status = "STOPPED";
  save();
};

// A relaunch always runs (see initTimer), and a break or a countdown about to end gets the grace minute first
const applyStartupGrace = () => {
  if (timerState.currentCountdownMs <= startupGraceMs || timerState.status === "BREAK") {
    timerState.currentCountdownMs = startupGraceMs;
  }
}

// Always sends the state with the status event, so a window never hears a status it can't draw
export const emitTimerStatus = (currentRules = rules()) => {
  timerEmitter.emit(STATUS_EVENTS[timerState.status], timerStateOf(timerState, currentRules));
};

const onTick = () => {
  tickCount++;
  const currentRules = rules();
  const step = tick(timerState, currentRules);
  apply(step);
  emitTimerStatus(currentRules);

  // Saved on every transition, and otherwise every {writeIntervalMs}
  if (step.transition || tickCount >= writeIntervalMs / TICK_MS) {
    save();
    tickCount = 0;
  }
};

// A button, from a window, the tray or the workday schedule. Nothing happens when the state doesn't allow it
const run = (action: AvailableActions, source: Source) => {
  const currentRules = rules();
  if (!apply(act(action, timerState, source, currentRules))) return;
  emitTimerStatus(currentRules);
  save();
};

export const stopTimer = (source: Source) => run("stop", source);
export const startTimer = (source: Source) => run("start", source);
export const startBreak = (source: Source) => run("breaktime", source);
export const skipBreak = (source: Source) => run("skip", source);
export const forwardToBreak = (source: Source) => run("forward", source);
export const snoozeTimer = (source: Source) => run("snooze", source);
export const startLunch = (source: Source) => run("lunch", source);

// Returns the status saved by the last run, or null on the first run ever
const loadTimerStateFromFile = (): StoredTimerState | undefined => {
  const saved = getUserDataFromFile<StoredTimerState>(FILENAMES.TIMER.STATE).fileContent;
  timerState = { ...defaultTimerData, ...saved };
  delete timerState.savedAt; // Only meaningful at the moment of saving
  return saved;
};

// The state the windows draw, for the real timer or for a clock shown in its place
export const timerStateFor = (core: TimerCore) => timerStateOf(core, rules());
export const getTimerState = () => timerStateFor(timerState);

// Expose a function that allows end to end tests to manually speed up timers
if (IS_TEST) {
  global.__test_fastForwardTimerOneSecond = () => {
    // Can only fast forward one second/tick at a time
    // because for some reason, the event loop doesn't allow batches (not sure why)
    (heldTick ?? onTick)();
  };
}

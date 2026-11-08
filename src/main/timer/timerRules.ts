// The timer's rules and nothing else: no clock, files or Electron, so the app and the web demo run the same ones.
// Each step takes the state and gives back the next one, the transition for the stats log, and the effects its owner performs

export type TimerStatus = "RUNNING" | "OVERDUE" | "STOPPED" | "BREAK" | "LUNCH";
export type Source = "WINDOW" | "TRAY" | "SCHEDULE"; // Where an action came from, SCHEDULE being the workday

// What happened in the timer, emitted on EVENTS.TIMER.TRANSITION for the stats log
export type TimerTransition =
  | { type: "APP_STARTED"; previousStatus: TimerStatus | null } // null = first run ever
  | { type: "STOPPED"; source: Source; from: "RUNNING" | "OVERDUE" | "BREAK" | "LUNCH"; countdownMs: number }
  | { type: "RESUMED"; source: Source; countdownMs: number }
  | { type: "OVERDUE_STARTED"; cause: "COUNTDOWN_ENDED" }
  | { type: "OVERDUE_STARTED"; cause: "FORWARDED"; source: Source; countdownMs: number }
  | { type: "BREAK_STARTED"; source: Source; overdueMs: number }
  | { type: "BREAK_SKIPPED"; source: Source; from: "OVERDUE" | "BREAK"; overdueMs: number; breakElapsedMs: number; powerupsLeft: number }
  | { type: "BREAK_COMPLETED" }
  | { type: "SNOOZED"; source: Source; snoozeMs: number; countdownMs: number; powerupsLeft: number }
  | { type: "LUNCH_STARTED"; source: Source; from: "RUNNING" | "OVERDUE"; lunchMs: number }
  | { type: "LUNCH_ENDED"; cause: "TIME_UP" }
  | { type: "LUNCH_ENDED"; cause: "ENDED_EARLY"; source: Source; lunchLeftMs: number };
export type AvailableActions = "start" | "stop" | "forward" | "skip" | "breaktime" | "snooze" | "lunch";

export interface TimerCore {
  overdueTimeMs: number;
  currentCountdownMs: number;
  status: TimerStatus;
}

// What the windows draw
export interface TimerState extends TimerCore {
  availableActions: AvailableActions[];
  remainingPowerups: number,
  allottedPowerups: number,
  remainingLunches: number,
  snoozeDurationMs: number,
  lunchDurationMs: number,
  isWarning: boolean;
}

// The settings and the day's budget a step runs on
export interface TimerRules {
  workMs: number;     // A work block on the settings in force
  nextWorkMs: number; // A work block after the break screens close, which is when saved settings take effect
  breakMs: number;
  snoozeMs: number;
  lunchMs: number;
  warningMs: number;
  powerups: number;   // The day's allotment
  powerupsLeft: number;
  lunchesLeft: number;
}

// What the owner does around a step: the windows and sound in the app, the day's counts in both
export type TimerEffect = "OPEN_OVERDUE" | "OPEN_BREAK" | "CLOSE_BREAK" | "WARNING" | "SPEND_POWERUP" | "SPEND_LUNCH";

export interface TimerStep {
  core: TimerCore;
  transition?: TimerTransition;
  effects: TimerEffect[];
}

export const TICK_MS = 1000;

type Action = (core: TimerCore, source: Source, rules: TimerRules) => TimerStep | null; // Null when the state doesn't allow it

const work = (ms: number): TimerCore => ({ status: "RUNNING", currentCountdownMs: ms, overdueTimeMs: 0 });
const OVERDUE: TimerCore = { status: "OVERDUE", currentCountdownMs: 0, overdueTimeMs: 0 };

const onlyIf = (allowed: boolean, action: AvailableActions): AvailableActions[] => (allowed ? [action] : []);

// Stop is offered on the break screens too, as an escape hatch. It costs a checkpoint like any stop
export const availableActions = (status: TimerStatus, { powerupsLeft, lunchesLeft }: TimerRules): AvailableActions[] => {
  const snooze = onlyIf(powerupsLeft > 0, "snooze");
  const skip = onlyIf(powerupsLeft > 0, "skip");
  const lunch = onlyIf(lunchesLeft > 0, "lunch");
  switch (status) {
    case "RUNNING": return ["stop", "forward", ...snooze, ...lunch];
    case "STOPPED":
    case "LUNCH": return ["start"]; // Starting during lunch ends it early
    case "OVERDUE": return ["breaktime", ...lunch, ...skip, "stop"];
    case "BREAK": return [...skip, "stop"];
  }
};

export const isInWarning = ({ status, currentCountdownMs }: TimerCore, warningMs: number) =>
  status === "RUNNING" && !!warningMs && currentCountdownMs > 0 && currentCountdownMs <= warningMs;

export const timerStateOf = (core: TimerCore, rules: TimerRules): TimerState => ({
  ...core,
  availableActions: availableActions(core.status, rules),
  remainingPowerups: Math.max(0, rules.powerupsLeft),
  allottedPowerups: rules.powerups,
  remainingLunches: Math.max(0, rules.lunchesLeft),
  snoozeDurationMs: rules.snoozeMs,
  lunchDurationMs: rules.lunchMs,
  isWarning: isInWarning(core, rules.warningMs),
});

// One second
export const tick = (core: TimerCore, rules: TimerRules): TimerStep => {
  const currentCountdownMs = core.currentCountdownMs - TICK_MS;
  switch (core.status) {
    case "RUNNING":
      if (currentCountdownMs <= 0) return { core: OVERDUE, transition: { type: "OVERDUE_STARTED", cause: "COUNTDOWN_ENDED" }, effects: ["OPEN_OVERDUE"] };
      return { core: { ...core, currentCountdownMs }, effects: currentCountdownMs === rules.warningMs ? ["WARNING"] : [] };
    case "OVERDUE":
      return { core: { ...core, overdueTimeMs: core.overdueTimeMs + TICK_MS }, effects: [] };
    case "BREAK":
      if (currentCountdownMs <= 0) return { core: work(rules.nextWorkMs), transition: { type: "BREAK_COMPLETED" }, effects: ["CLOSE_BREAK"] };
      return { core: { ...core, currentCountdownMs }, effects: [] };
    case "LUNCH": // Back to work with a full timer
      if (currentCountdownMs <= 0) return { core: work(rules.workMs), transition: { type: "LUNCH_ENDED", cause: "TIME_UP" }, effects: [] };
      return { core: { ...core, currentCountdownMs }, effects: [] };
    case "STOPPED":
      return { core, effects: [] };
  }
};

const stop: Action = (core, source, rules) => {
  const from = core.status;
  // A stale menu or window can send this after the status changed. Only the end of the workday can stop lunch
  if (from === "STOPPED" || (from === "LUNCH" && source !== "SCHEDULE")) return null;
  const transition: TimerTransition = { type: "STOPPED", source, from, countdownMs: core.currentCountdownMs };
  if (from === "RUNNING") return { core: { ...core, status: "STOPPED" }, transition, effects: [] };
  // Stopping from a break screen closes it, and resuming later starts a fresh work session, as it does after lunch
  return { core: { ...work(rules.nextWorkMs), status: "STOPPED" }, transition, effects: ["CLOSE_BREAK"] };
};

const start: Action = (core, source, rules) => {
  if (core.status === "LUNCH") {
    if (source === "SCHEDULE") return null; // The workday starting doesn't cut lunch short
    return { core: work(rules.workMs), transition: { type: "LUNCH_ENDED", cause: "ENDED_EARLY", source, lunchLeftMs: core.currentCountdownMs }, effects: [] };
  }
  if (core.status !== "STOPPED") return null;
  return { core: { ...core, status: "RUNNING" }, transition: { type: "RESUMED", source, countdownMs: core.currentCountdownMs }, effects: [] };
};

const startBreak: Action = (core, source, rules) => {
  if (core.status !== "OVERDUE") return null;
  return {
    core: { status: "BREAK", currentCountdownMs: rules.breakMs, overdueTimeMs: 0 },
    transition: { type: "BREAK_STARTED", source, overdueMs: core.overdueTimeMs },
    effects: ["OPEN_BREAK"],
  };
};

const skipBreak: Action = (core, source, rules) => {
  if (rules.powerupsLeft <= 0 || (core.status !== "BREAK" && core.status !== "OVERDUE")) return null;
  return {
    core: work(rules.nextWorkMs),
    transition: {
      type: "BREAK_SKIPPED",
      source,
      from: core.status,
      overdueMs: core.overdueTimeMs,
      breakElapsedMs: core.status === "BREAK" ? rules.breakMs - core.currentCountdownMs : 0,
      powerupsLeft: rules.powerupsLeft - 1,
    },
    effects: ["SPEND_POWERUP", "CLOSE_BREAK"],
  };
};

const forwardToBreak: Action = (core, source) => {
  if (core.status !== "RUNNING") return null;
  return { core: OVERDUE, transition: { type: "OVERDUE_STARTED", cause: "FORWARDED", source, countdownMs: core.currentCountdownMs }, effects: ["OPEN_OVERDUE"] };
};

const snooze: Action = (core, source, rules) => {
  if (core.status !== "RUNNING" || rules.powerupsLeft <= 0) return null; // Once overdue, a skip is the way out
  return {
    core: { ...core, currentCountdownMs: core.currentCountdownMs + rules.snoozeMs },
    transition: { type: "SNOOZED", source, snoozeMs: rules.snoozeMs, countdownMs: core.currentCountdownMs, powerupsLeft: rules.powerupsLeft - 1 },
    effects: ["SPEND_POWERUP"],
  };
};

// Lunch pauses the day without breaking the checkpoint climb. Taking it while overdue counts as taking the break
const startLunch: Action = (core, source, rules) => {
  const from = core.status;
  if ((from !== "RUNNING" && from !== "OVERDUE") || rules.lunchesLeft <= 0) return null;
  return {
    core: { status: "LUNCH", currentCountdownMs: rules.lunchMs, overdueTimeMs: 0 },
    transition: { type: "LUNCH_STARTED", source, from, lunchMs: rules.lunchMs },
    effects: from === "OVERDUE" ? ["SPEND_LUNCH", "CLOSE_BREAK"] : ["SPEND_LUNCH"],
  };
};

const actions: Record<AvailableActions, Action> = { start, stop, forward: forwardToBreak, skip: skipBreak, breaktime: startBreak, snooze, lunch: startLunch };

export const act = (action: AvailableActions, core: TimerCore, source: Source, rules: TimerRules) => actions[action](core, source, rules);

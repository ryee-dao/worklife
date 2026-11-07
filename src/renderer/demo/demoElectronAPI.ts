import type { ElectronAPI } from "@shared/types/electron";
import type { AvailableActions, TimerState, TimerStatus, TimerTransition } from "@main/timer/timerState";
import type { StatsEvent } from "@main/stats/stats";
import type { TimerConfigs } from "@main/timer/timerConfigs";
import type { DifficultyConfigs } from "@main/difficulty/difficultyConfigs";
import type { OverdueConfigs } from "@main/overdue/overdueConfigs";
import type { WorkdayConfigs } from "@main/workday/workdayConfigs";
import { getDayScores, getTodayScore } from "@main/stats/checkpoints";
import { createOverdueLevelsArray } from "@main/overdue/overdueGeometry";
import { getPresetConfigs } from "@shared/utils/difficulty";
import { LUNCHES_PER_DAY } from "@shared/constants";
import { tourScore } from "@shared/tour/score";
import { currentBeat, hasTimedOut, namesAction, nextSession, prevSession, showsRealTimer, skipSession, startSession, tickSession, TOUR, TourSession, TourUpdate, tourUpdateOf } from "@shared/tour/session";

const DOWNLOAD_URL = "https://github.com/ryee-dao/worklife/releases";

interface DemoConfigs {
  timer: TimerConfigs;
  difficulty: DifficultyConfigs;
  overdue: OverdueConfigs;
  workday: WorkdayConfigs;
}

// Short enough to see a whole cycle in a couple of minutes
export const DEMO_CONFIGS: DemoConfigs = {
  timer: { timerDurationMs: 2 * 60 * 1000, warningThresholdMs: 60 * 1000 }, // The settings page wants whole minutes
  difficulty: {
    level: "CUSTOM",
    custom: { breakDurationMs: 30 * 1000, snoozeDurationMs: 60 * 1000, allottedPowerups: 3, lunchDurationMs: 5 * 60 * 1000, checkpointDecayMs: 60 * 1000 },
  },
  overdue: { levelThresholdMs: 10 * 1000, windowLevelCap: 5, windowRatioCap: 0.9 },
  workday: { days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59", autoStopAtEnd: false }, // Any time the page is opened is a workday in progress
};

// Past days are scored on ordinary settings, so a ten-minute stop costs a checkpoint rather than ten
const HISTORY_CONFIGS: DemoConfigs = {
  ...DEMO_CONFIGS,
  timer: { timerDurationMs: 45 * 60 * 1000, warningThresholdMs: 2 * 60 * 1000 },
  difficulty: { ...DEMO_CONFIGS.difficulty, custom: { ...DEMO_CONFIGS.difficulty.custom, checkpointDecayMs: 15 * 60 * 1000 } },
};

const HISTORY_DAYS = 45;

type AppQuit = { type: "APP_QUIT"; status: TimerStatus; countdownMs: number; overdueMs: number };
type DemoTransition = TimerTransition | AppQuit;

const difficultyValues = ({ difficulty, timer, workday }: DemoConfigs) => {
  return difficulty.level === "CUSTOM" ? difficulty.custom : getPresetConfigs(difficulty.level, timer.timerDurationMs, workday);
};

// An event as the app would log it, with the settings of its moment
const makeEvent = (transition: DemoTransition, at: number, configs: DemoConfigs): StatsEvent => {
  const values = difficultyValues(configs);
  return {
    v: 1,
    id: crypto.randomUUID(),
    at,
    tzOffsetMin: 0 - new Date(at).getTimezoneOffset(),
    config: {
      timerDurationMs: configs.timer.timerDurationMs,
      breakDurationMs: values.breakDurationMs,
      warningThresholdMs: configs.timer.warningThresholdMs,
      snoozeDurationMs: values.snoozeDurationMs,
      allottedPowerups: values.allottedPowerups,
      lunchDurationMs: values.lunchDurationMs,
      checkpointDecayMs: values.checkpointDecayMs,
      difficulty: configs.difficulty.level,
      levelThresholdMs: configs.overdue.levelThresholdMs,
      workday: configs.workday,
    },
    ...transition,
  };
};

// A clock time of the demo's workday, "HH:MM", on a day
const atTime = (day: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime();
};
const workdayStart = (day: Date) => atTime(day, DEMO_CONFIGS.workday.start);
const workdayEnd = (day: Date) => atTime(day, DEMO_CONFIGS.workday.end);

// A few weeks of workdays, in a repeating mix: a full day, a short stop, a lunch, and a late start
export const seedHistory = (now: number): StatsEvent[] => {
  const events: StatsEvent[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
    const day = new Date(today);
    day.setDate(today.getDate() - daysAgo);
    if (!DEMO_CONFIGS.workday.days.includes(day.getDay())) continue;

    const push = (transition: DemoTransition, time: number) => events.push(makeEvent(transition, time, HISTORY_CONFIGS));
    const shape = day.getDate() % 4;
    const [start, end] = [workdayStart(day), workdayEnd(day)];
    const mid = (start + end) / 2;
    const minutes = (count: number) => count * 60 * 1000;

    push({ type: "APP_STARTED", previousStatus: null }, shape === 3 ? start + minutes(80) : start);
    if (shape === 1) {
      push({ type: "STOPPED", source: "WINDOW", from: "RUNNING", countdownMs: 0 }, mid);
      push({ type: "RESUMED", source: "WINDOW", countdownMs: 0 }, mid + minutes(10));
    }
    if (shape === 2) {
      push({ type: "LUNCH_STARTED", source: "WINDOW", from: "RUNNING", lunchMs: minutes(45) }, mid);
      push({ type: "LUNCH_ENDED", cause: "TIME_UP" }, mid + minutes(45));
    }
    push({ type: "APP_QUIT", status: "RUNNING", countdownMs: 0, overdueMs: 0 }, end);
  }

  // Today's work started on time too, so the stats show a day in progress rather than one that began when the page opened
  if (DEMO_CONFIGS.workday.days.includes(today.getDay()) && now > workdayStart(today)) {
    events.push(makeEvent({ type: "APP_STARTED", previousStatus: null }, workdayStart(today), DEMO_CONFIGS));
  }
  return events;
};

interface DemoOptions {
  now?: () => number;
  autoTick?: boolean; // Off in tests, which move time with fastForward
}

// The main process, simulated in the page: the same timer states, actions and stats scoring, with nothing saved.
// shortcut: a copy of timerState.ts's rules rather than the module itself, which is tied to Electron and files
export function createDemoElectronAPI({ now = () => Date.now(), autoTick = true }: DemoOptions = {}) {
  let saved = structuredClone(DEMO_CONFIGS);
  let applied = structuredClone(DEMO_CONFIGS);
  // A fresh page is a first run: it opens on the tour, with the timer waiting for the tour's start prompt
  const timer = { status: "STOPPED" as TimerStatus, currentCountdownMs: applied.timer.timerDurationMs, overdueTimeMs: 0 };
  let tour: TourSession | null = startSession(true);
  let powerupsUsed = 0;
  let lunchesUsed = 0;
  const events = seedHistory(now());
  const timerListeners = new Set<(state: TimerState) => void>();
  const scoreListeners = new Set<(score: ReturnType<typeof getTodayScore>) => void>();
  const tourListeners = new Set<(update: TourUpdate | null) => void>();

  const values = () => difficultyValues(applied);
  const remainingPowerups = () => values().allottedPowerups - powerupsUsed;
  const remainingLunches = () => LUNCHES_PER_DAY - lunchesUsed;
  const record = (transition: DemoTransition) => events.push(makeEvent(transition, now(), applied));
  record({ type: "APP_STARTED", previousStatus: null });

  const availableActions = (status: TimerStatus): AvailableActions[] => {
    const hasPowerups = remainingPowerups() > 0;
    const hasLunch = remainingLunches() > 0;
    switch (status) {
      case "RUNNING": return ["stop", "forward", ...(hasPowerups ? ["snooze" as const] : []), ...(hasLunch ? ["lunch" as const] : [])];
      case "STOPPED":
      case "LUNCH": return ["start"];
      case "OVERDUE": return ["breaktime", ...(hasPowerups ? ["skip" as const] : []), ...(hasLunch ? ["lunch" as const] : []), "stop"];
      case "BREAK": return [...(hasPowerups ? ["skip" as const] : []), "stop"];
    }
  };

  const realState = (): TimerState => ({
    ...timer,
    availableActions: availableActions(timer.status),
    remainingPowerups: Math.max(0, remainingPowerups()),
    allottedPowerups: values().allottedPowerups,
    remainingLunches: Math.max(0, remainingLunches()),
    snoozeDurationMs: values().snoozeDurationMs,
    lunchDurationMs: values().lunchDurationMs,
    isWarning: timer.status === "RUNNING" && timer.currentCountdownMs > 0 && timer.currentCountdownMs <= applied.timer.warningThresholdMs,
  });

  // While the tour is on, the page shows its clock in place of the timer, until the last card hands the timer back
  const getState = (): TimerState => {
    if (!tour || showsRealTimer(tour)) return realState();
    return { ...realState(), ...tour.clock, availableActions: availableActions(tour.clock.status), isWarning: false };
  };

  // The demo's break beat says what a browser can't do, and where the app is
  const tourUpdate = (): TourUpdate | null => {
    if (!tour) return null;
    const update = tourUpdateOf(tour);
    if (update.beat.demo !== "BREAK") return update;
    return {
      ...update,
      beat: {
        ...update.beat,
        body: `${update.beat.body} A browser tab can't take your whole screen. The app can.`,
        link: { label: "Download the app", href: DOWNLOAD_URL },
      },
    };
  };

  const todayScore = () => (tour && tourScore(currentBeat(tour), now())) ?? getTodayScore(events, now());

  const emit = () => {
    const state = getState();
    timerListeners.forEach((listener) => listener(state));
    const score = todayScore();
    scoreListeners.forEach((listener) => listener(score));
    const update = tourUpdate();
    tourListeners.forEach((listener) => listener(update));
  };

  // Back to work with a full timer. Saved settings take effect here, like the app
  const endBreak = () => {
    applied = structuredClone(saved);
    timer.status = "RUNNING";
    timer.currentCountdownMs = applied.timer.timerDurationMs;
    timer.overdueTimeMs = 0;
  };

  const tick = () => {
    // The tour holds the timer and runs its own clock
    if (tour) {
      const next = tickSession(tour);
      if (hasTimedOut(next)) return endTour();
      tour = next;
      emit();
      return;
    }
    switch (timer.status) {
      case "RUNNING":
        timer.currentCountdownMs -= 1000;
        if (timer.currentCountdownMs <= 0) {
          record({ type: "OVERDUE_STARTED", cause: "COUNTDOWN_ENDED" });
          timer.status = "OVERDUE";
          timer.currentCountdownMs = 0;
          timer.overdueTimeMs = 0;
        }
        break;
      case "OVERDUE":
        timer.overdueTimeMs += 1000;
        break;
      case "BREAK":
        timer.currentCountdownMs -= 1000;
        if (timer.currentCountdownMs <= 0) {
          record({ type: "BREAK_COMPLETED" });
          endBreak();
        }
        break;
      case "LUNCH":
        timer.currentCountdownMs -= 1000;
        if (timer.currentCountdownMs <= 0) {
          record({ type: "LUNCH_ENDED", cause: "TIME_UP" });
          timer.status = "RUNNING";
          timer.currentCountdownMs = applied.timer.timerDurationMs;
        }
        break;
      case "STOPPED":
        break;
    }
    emit();
  };

  const stop = () => {
    const from = timer.status;
    if (from === "STOPPED" || from === "LUNCH") return;
    record({ type: "STOPPED", source: "WINDOW", from, countdownMs: timer.currentCountdownMs });
    if (from !== "RUNNING") endBreak();
    timer.status = "STOPPED";
    emit();
  };

  const start = () => {
    if (timer.status === "LUNCH") {
      record({ type: "LUNCH_ENDED", cause: "ENDED_EARLY", source: "WINDOW", lunchLeftMs: timer.currentCountdownMs });
      timer.status = "RUNNING";
      timer.currentCountdownMs = applied.timer.timerDurationMs;
      emit();
      return;
    }
    if (timer.status !== "STOPPED") return;
    record({ type: "RESUMED", source: "WINDOW", countdownMs: timer.currentCountdownMs });
    timer.status = "RUNNING";
    emit();
  };

  const startBreak = () => {
    if (timer.status !== "OVERDUE") return;
    record({ type: "BREAK_STARTED", source: "WINDOW", overdueMs: timer.overdueTimeMs });
    timer.status = "BREAK";
    timer.currentCountdownMs = values().breakDurationMs;
    timer.overdueTimeMs = 0;
    emit();
  };

  const skipBreak = () => {
    if (remainingPowerups() <= 0) return;
    if (timer.status !== "BREAK" && timer.status !== "OVERDUE") return;
    powerupsUsed += 1;
    record({
      type: "BREAK_SKIPPED",
      source: "WINDOW",
      from: timer.status,
      overdueMs: timer.overdueTimeMs,
      breakElapsedMs: timer.status === "BREAK" ? values().breakDurationMs - timer.currentCountdownMs : 0,
      powerupsLeft: remainingPowerups(),
    });
    endBreak();
    emit();
  };

  const forwardToBreak = () => {
    if (timer.status !== "RUNNING") return;
    record({ type: "OVERDUE_STARTED", cause: "FORWARDED", source: "WINDOW", countdownMs: timer.currentCountdownMs });
    timer.status = "OVERDUE";
    timer.currentCountdownMs = 0;
    timer.overdueTimeMs = 0;
    emit();
  };

  const snooze = () => {
    if (timer.status !== "RUNNING" || remainingPowerups() <= 0) return;
    powerupsUsed += 1;
    const snoozeMs = values().snoozeDurationMs;
    record({ type: "SNOOZED", source: "WINDOW", snoozeMs, countdownMs: timer.currentCountdownMs, powerupsLeft: remainingPowerups() });
    timer.currentCountdownMs += snoozeMs;
    emit();
  };

  const startLunch = () => {
    const from = timer.status;
    if ((from !== "RUNNING" && from !== "OVERDUE") || remainingLunches() <= 0) return;
    lunchesUsed += 1;
    const lunchMs = values().lunchDurationMs;
    record({ type: "LUNCH_STARTED", source: "WINDOW", from, lunchMs });
    if (from === "OVERDUE") applied = structuredClone(saved); // Lunch closes the overdue window, which applies saved settings
    timer.status = "LUNCH";
    timer.currentCountdownMs = lunchMs;
    timer.overdueTimeMs = 0;
    emit();
  };

  // The tour, as the app runs it: a mock scenario where only the button a card names does anything
  const endTour = () => {
    tour = null;
    emit();
  };
  const advance = (next: TourSession | null) => (next ? ((tour = next), emit()) : endTour());
  const realStopped = () => timer.status === "STOPPED";
  const tourAction = (action: AvailableActions) => {
    if (!tour || !namesAction(tour, action)) return;
    advance(nextSession(tour, realStopped()));
    if (action === "start") start(); // The first run's last card: the real start, once the tour is out of the way
  };
  const fromWindow = (action: AvailableActions, real: () => void) => () => (tour ? tourAction(action) : real());

  if (autoTick) setInterval(tick, 1000);

  const api: ElectronAPI = {
    onTimerUpdate: (callback) => {
      timerListeners.add(callback);
      callback(getState()); // The app sends the state as soon as a window loads
      return () => timerListeners.delete(callback);
    },
    onWarning: () => () => {}, // No warning sound: browsers block audio the visitor didn't ask for
    getTimerState: async () => getState(),
    onTodayScore: (callback) => {
      scoreListeners.add(callback);
      callback(todayScore());
      return () => scoreListeners.delete(callback);
    },
    onShowDay: () => () => {},
    getDayScores: async () => getDayScores(events, now()),
    takeUnseenDaySummary: async () => null,
    stop: fromWindow("stop", stop),
    start: fromWindow("start", start),
    startBreak: fromWindow("breaktime", startBreak),
    skipBreak: fromWindow("skip", skipBreak),
    forwardToBreak: fromWindow("forward", forwardToBreak),
    snooze: fromWindow("snooze", snooze),
    startLunch: fromWindow("lunch", startLunch),
    saveTimerConfigs: async (configs) => { saved = { ...saved, timer: configs }; },
    saveDifficultyConfigs: async (configs) => { saved = { ...saved, difficulty: configs }; },
    saveOverdueConfigs: async (configs) => { saved = { ...saved, overdue: configs }; },
    saveWorkdayConfigs: async (configs) => { saved = { ...saved, workday: configs }; },
    devApplyWorkday: async () => {},
    devResetDay: async () => {},
    devAdjustCheckpoint: async () => {},
    loadTimerConfigs: async () => saved.timer,
    loadDifficultyConfigs: async () => saved.difficulty,
    loadOverdueConfigs: async () => saved.overdue,
    loadWorkdayConfigs: async () => saved.workday,
    onTourUpdate: (callback) => {
      tourListeners.add(callback);
      callback(tourUpdate());
      return () => tourListeners.delete(callback);
    },
    getTour: async () => tourUpdate(),
    startTour: () => {
      if (tour) return;
      tour = startSession(false);
      emit();
    },
    tourNext: () => {
      if (tour) advance(nextSession(tour, realStopped()));
    },
    tourPrev: () => {
      if (!tour) return;
      tour = prevSession(tour);
      emit();
    },
    tourSkip: () => {
      if (!tour) return;
      tour = skipSession(tour, realStopped());
      emit();
    },
  };

  return {
    api,
    // The tour's window grows on its own, faster, clock
    getOverdueLevels: () => createOverdueLevelsArray(tour ? { ...applied.overdue, levelThresholdMs: TOUR.LEVEL_MS } : applied.overdue),
    fastForward: (seconds: number) => {
      for (let i = 0; i < seconds; i++) tick();
    },
  };
}

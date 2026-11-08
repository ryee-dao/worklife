import type { ElectronAPI } from "@shared/types/electron";
import type { AvailableActions, TimerState, TimerStatus, TimerTransition } from "@main/timer/timerState";
import { act, availableActions, tick as tickTimer, timerStateOf, TimerCore, TimerRules, TimerStep } from "@main/timer/timerRules";
import type { StatsEvent } from "@main/stats/stats";
import type { TimerConfigs } from "@main/timer/timerConfigs";
import type { DifficultyConfigs } from "@main/difficulty/difficultyConfigs";
import type { OverdueConfigs } from "@main/overdue/overdueConfigs";
import type { WorkdayConfigs } from "@main/workday/workdayConfigs";
import type { SoundConfigs } from "@main/sound/soundConfigs";
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
  sound: SoundConfigs;
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
  sound: { volume: 0.5 },
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

// The main process, simulated in the page: the app's timer rules and stats scoring, with nothing saved.
// shortcut: the glue around the rules (rules(), apply(), the tour's advance/action routing) mirrors timerState.ts and tour.ts
// by hand; lift the counters a step changes into timerRules if the two drift
export function createDemoElectronAPI({ now = () => Date.now(), autoTick = true }: DemoOptions = {}) {
  let saved = structuredClone(DEMO_CONFIGS);
  let applied = structuredClone(DEMO_CONFIGS);
  // A fresh page is a first run: it opens on the tour, with the timer waiting for the tour's start prompt
  let timer: TimerCore = { status: "STOPPED", currentCountdownMs: applied.timer.timerDurationMs, overdueTimeMs: 0 };
  let tour: TourSession | null = startSession(/* firstRun */ true);
  let powerupsUsed = 0;
  let lunchesUsed = 0;
  const events = seedHistory(now());
  const timerListeners = new Set<(state: TimerState) => void>();
  const scoreListeners = new Set<(score: ReturnType<typeof getTodayScore>) => void>();
  const tourListeners = new Set<(update: TourUpdate | null) => void>();

  const values = () => difficultyValues(applied);
  const record = (transition: DemoTransition) => events.push(makeEvent(transition, now(), applied));
  record({ type: "APP_STARTED", previousStatus: null });

  const rules = (): TimerRules => ({
    workMs: applied.timer.timerDurationMs,
    nextWorkMs: saved.timer.timerDurationMs,
    breakMs: values().breakDurationMs,
    snoozeMs: values().snoozeDurationMs,
    lunchMs: values().lunchDurationMs,
    warningMs: applied.timer.warningThresholdMs,
    powerups: values().allottedPowerups,
    powerupsLeft: values().allottedPowerups - powerupsUsed,
    lunchesLeft: LUNCHES_PER_DAY - lunchesUsed,
  });

  const realState = (): TimerState => timerStateOf(timer, rules());

  // While the tour is on, the page shows its clock in place of the timer, until the last card hands the timer back
  const getState = (): TimerState => {
    if (!tour || showsRealTimer(tour)) return realState();
    return { ...realState(), ...tour.clock, availableActions: availableActions(tour.clock.status, rules()), isWarning: false };
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

  // Takes a step as the app does, minus its windows and sound: the page draws the state it's sent
  const apply = (step: TimerStep | null) => {
    if (!step) return;
    if (step.transition) record(step.transition);
    timer = step.core;
    for (const effect of step.effects) {
      if (effect === "CLOSE_BREAK") applied = structuredClone(saved); // Saved settings take effect here, like the app
      if (effect === "SPEND_POWERUP") powerupsUsed += 1;
      if (effect === "SPEND_LUNCH") lunchesUsed += 1;
    }
    emit();
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
    apply(tickTimer(timer, rules()));
  };

  const run = (action: AvailableActions) => apply(act(action, timer, "WINDOW", rules()));

  // The tour, as the app runs it: a mock scenario where only the button a card names does anything
  const set = (next: TourSession | null) => {
    tour = next;
    emit();
  };
  const endTour = () => set(null);
  const advance = (next: TourSession | null) => (next ? set(next) : endTour());
  const realStopped = () => timer.status === "STOPPED";
  const tourAction = (action: AvailableActions) => {
    if (!tour || !namesAction(tour, action)) return;
    advance(nextSession(tour, realStopped()));
    if (action === "start") run("start"); // The first run's last card: the real start, once the tour is out of the way
  };
  const fromWindow = (action: AvailableActions) => () => (tour ? tourAction(action) : run(action));

  if (autoTick) setInterval(tick, 1000);

  const api: ElectronAPI = {
    // Each subscribe answers at once, where the app's push can land before a window subscribes, so the app's windows fetch as well
    onTimerUpdate: (callback) => {
      timerListeners.add(callback);
      callback(getState());
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
    stop: fromWindow("stop"),
    start: fromWindow("start"),
    startBreak: fromWindow("breaktime"),
    skipBreak: fromWindow("skip"),
    forwardToBreak: fromWindow("forward"),
    snooze: fromWindow("snooze"),
    startLunch: fromWindow("lunch"),
    saveTimerConfigs: async (configs) => { saved = { ...saved, timer: configs }; },
    saveDifficultyConfigs: async (configs) => { saved = { ...saved, difficulty: configs }; },
    saveOverdueConfigs: async (configs) => { saved = { ...saved, overdue: configs }; },
    saveWorkdayConfigs: async (configs) => { saved = { ...saved, workday: configs }; },
    saveSoundConfigs: async (configs) => { saved = { ...saved, sound: configs }; },
    devApplyWorkday: async () => {},
    devResetDay: async () => {},
    devAdjustCheckpoint: async () => {},
    loadTimerConfigs: async () => saved.timer,
    loadDifficultyConfigs: async () => saved.difficulty,
    loadOverdueConfigs: async () => saved.overdue,
    loadWorkdayConfigs: async () => saved.workday,
    loadSoundConfigs: async () => saved.sound,
    onTourUpdate: (callback) => {
      tourListeners.add(callback);
      callback(tourUpdate());
      return () => tourListeners.delete(callback);
    },
    getTour: async () => tourUpdate(),
    startTour: () => {
      if (!tour) set(startSession(/* firstRun */ false));
    },
    tourNext: () => {
      if (tour) advance(nextSession(tour, realStopped()));
    },
    tourPrev: () => {
      if (tour) set(prevSession(tour));
    },
    tourSkip: () => {
      if (tour) set(skipSession(tour, realStopped()));
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

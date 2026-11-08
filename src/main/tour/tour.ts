import { EventEmitter } from "events";
import { EVENTS } from "@shared/constants";
import { createOverdueLevelsArray, OverdueLevelObject } from "@main/overdue/overdueGeometry";
import { getAppliedOverdueConfigs } from "@main/overdue/overdueConfigs";
import {
  AvailableActions, emitTimerStatus, getTimerState, holdForFirstRun, holdTimer, releaseTimer, startTimer, timerStateFor, TimerState, TimerStatus,
} from "@main/timer/timerState";
import { activateKioskModeForBreakWindow, closeBreakWindow, createBreakWindow, moveBreakWindowAwayFrom, resizeBreakWindow } from "@main/windows/breakWindow";
import { settingsWindow } from "@main/windows/settingsWindow";
import { currentBeat, hasTimedOut, namesAction, nextSession, prevSession, showsRealTimer, skipSession, startSession, tickSession, TOUR, TourSession, tourUpdateOf } from "@shared/tour/session";
import { tourScore } from "@shared/tour/score";
import { isTourSeen, markTourSeen } from "./tourState";

// The tour: a mock scenario on the real screens. It holds the timer, shows its own clock in the timer's place, and opens the real
// overdue and break windows on that clock, so what happens is shown without anything happening to the day
export const tourEmitter = new EventEmitter(); // EVENTS.TOUR.UPDATE, with what the windows should draw, or null once it's over
let session: TourSession | null = null;
let levels: OverdueLevelObject[] = [];

export const getTour = () => (session ? tourUpdateOf(session) : null);

const clockState = (): TimerState => ({ ...timerStateFor(session!.clock), isWarning: false });

// The timer state the windows see: a tour's clock while one is on, until the last card hands the real timer back
export const shownTimerState = (): TimerState => (session && !showsRealTimer(session) ? clockState() : getTimerState());

// The day the Stats tab shows while a tour is on, where a beat has one
export const tourTodayScore = () => (session ? tourScore(currentBeat(session), Date.now()) : null);

const inWindow = (status?: TimerStatus) => status === "OVERDUE" || status === "BREAK";

// The break window follows the tour's clock the way it follows the real one. Going back can open it straight onto a break
const applyWindow = (from: TimerStatus | undefined, to: TimerStatus | undefined) => {
  if (inWindow(to) && !inWindow(from)) {
    createBreakWindow(() => session?.clock.status ?? getTimerState().status); // Kiosk on load when it opens on a break
    if (to === "OVERDUE") resizeBreakWindow(clockState(), levels);
    if (settingsWindow) moveBreakWindowAwayFrom(settingsWindow.getBounds()); // So the card on the dashboard stays readable while it grows
  } else if (to === "OVERDUE") {
    resizeBreakWindow(clockState(), levels);
  }
  if (to === "BREAK" && from === "OVERDUE") activateKioskModeForBreakWindow();
  if (inWindow(from) && !inWindow(to)) closeBreakWindow();
};

const publish = () => {
  tourEmitter.emit(EVENTS.TOUR.UPDATE, getTour());
  emitTimerStatus(); // The windows get the clock, or the real timer back
};

const set = (next: TourSession | null) => {
  const from = session?.clock.status;
  session = next;
  applyWindow(from, next?.clock.status);
  publish();
};

export const startTour = () => {
  if (session) return;
  levels = createOverdueLevelsArray({ ...getAppliedOverdueConfigs(), levelThresholdMs: TOUR.LEVEL_MS });
  closeBreakWindow(); // A real overdue or break window comes back when the tour ends
  holdTimer(tick);
  set(startSession(!isTourSeen()));
};

const endTour = () => {
  set(null);
  markTourSeen();
  releaseTimer();
  if (inWindow(getTimerState().status)) createBreakWindow(); // The real window the tour held back
};

const tick = () => {
  if (!session) return;
  const next = tickSession(session);
  if (hasTimedOut(next)) return endTour();
  set(next);
};

const realStopped = () => getTimerState().status === "STOPPED";
const advance = (next: TourSession | null) => (next ? set(next) : endTour());

export const tourNext = () => {
  if (session) advance(nextSession(session, realStopped()));
};

export const tourPrev = () => {
  if (session) set(prevSession(session));
};

export const tourSkip = () => {
  if (session) set(skipSession(session, realStopped()));
};

// A window button while a tour is on. Only the one its card names does anything, so a tour can't be stopped or skipped from the window
export const tourAction = (action: AvailableActions) => {
  if (!session || !namesAction(session, action)) return;
  advance(nextSession(session, realStopped()));
  if (action === "start") startTimer("WINDOW"); // The first run's last card: the real start, once the tour is out of the way
};

// The first run opens on the tour, with the timer waiting for its start prompt
export const initTour = () => {
  if (isTourSeen()) return;
  holdForFirstRun();
  startTour();
};

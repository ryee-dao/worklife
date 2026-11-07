import type { AvailableActions, TimerStatus } from "@main/timer/timerState";
import { END_BEATS, TOUR_BEATS, TourBeat, TourEnd } from "./beats";

// The tour's own numbers, whatever the settings say
export const TOUR = {
  COUNTDOWN_MS: 45 * 60 * 1000, // The clock the tour opens on
  RUN_MS: 3 * 1000,             // How long that clock visibly runs before it holds, and the countdown to the overdue window
  LEVEL_MS: 4 * 1000,           // The overdue window grows every few seconds, not minutes
  BREAK_MS: 15 * 1000,
  IDLE_MS: 30 * 1000,           // A replay with no click for this long ends, so a tour can't hold the real timer for long
  FADE_MS: 5 * 1000,            // The cards fade for this long before that
} as const;

// The clock shown in place of the real one
export interface TourClock {
  status: TimerStatus;
  currentCountdownMs: number;
  overdueTimeMs: number;
}

export interface TourSession {
  firstRun: boolean;
  step: number;        // Index into TOUR_BEATS
  end: TourEnd | null; // Set once the tour is on its last card
  clock: TourClock;
  runMs: number;       // Clock time left to tick before it holds
  idleMs: number;      // Since the last click
}

// What the windows draw
export interface TourUpdate {
  beat: TourBeat;
  step: number;
  total: number;
  fading: boolean;
}

const HELD: TourClock = { status: "RUNNING", currentCountdownMs: TOUR.COUNTDOWN_MS, overdueTimeMs: 0 };

export const startSession = (firstRun: boolean): TourSession => ({ firstRun, step: 0, end: null, clock: HELD, runMs: TOUR.RUN_MS, idleMs: 0 });

export const currentBeat = (session: TourSession): TourBeat => (session.end ? END_BEATS[session.end] : TOUR_BEATS[session.step]);

// The last card hands the real timer back, so it shows through there
export const showsRealTimer = (session: TourSession) => session.end !== null;

// A first run never times out: there's no timer running to cheat
export const isFading = (session: TourSession) => !session.firstRun && session.idleMs >= TOUR.IDLE_MS - TOUR.FADE_MS;
export const hasTimedOut = (session: TourSession) => !session.firstRun && session.idleMs >= TOUR.IDLE_MS;

export const namesAction = (session: TourSession, action: AvailableActions) => currentBeat(session).advanceOn === action;

export const tourUpdateOf = (session: TourSession): TourUpdate => ({
  beat: currentBeat(session),
  step: session.end ? TOUR_BEATS.length : session.step,
  total: TOUR_BEATS.length,
  fading: isFading(session),
});

const endOf = (session: TourSession, realStopped: boolean): TourEnd => (session.firstRun && realStopped ? "FIRST_RUN" : "REPLAY");

// The clock a beat opens on: the overdue beat runs the last seconds down, the break beat starts the break,
// and the rest keep a running clock or hold a fresh one
const clockFor = (beat: TourBeat, session: TourSession): Pick<TourSession, "clock" | "runMs"> => {
  if (beat.demo === "OVERDUE") return { clock: { status: "RUNNING", currentCountdownMs: TOUR.RUN_MS, overdueTimeMs: 0 }, runMs: TOUR.RUN_MS };
  if (beat.demo === "BREAK") return { clock: { status: "BREAK", currentCountdownMs: TOUR.BREAK_MS, overdueTimeMs: 0 }, runMs: 0 };
  if (session.clock.status === "RUNNING") return { clock: session.clock, runMs: session.runMs };
  return { clock: HELD, runMs: 0 };
};

// The card's button, or the real button a beat names. Null once the tour is over
export const nextSession = (session: TourSession, realStopped: boolean): TourSession | null => {
  if (session.end) return null;
  const step = session.step + 1;
  if (step === TOUR_BEATS.length) return { ...session, idleMs: 0, end: endOf(session, realStopped), clock: HELD, runMs: 0 };
  return { ...session, step, idleMs: 0, ...clockFor(TOUR_BEATS[step], session) };
};

// A skipped first run still ends on the start prompt, so the timer gets started
export const skipSession = (session: TourSession, realStopped: boolean): TourSession => {
  if (session.end) return session;
  return { ...session, idleMs: 0, end: session.firstRun && realStopped ? "FIRST_RUN" : "SKIPPED", clock: HELD, runMs: 0 };
};

// One second
export const tickSession = (session: TourSession): TourSession => {
  const idleMs = session.idleMs + 1000;
  const { clock } = session;
  switch (clock.status) {
    case "RUNNING": {
      if (session.runMs <= 0) return { ...session, idleMs };
      const currentCountdownMs = clock.currentCountdownMs - 1000;
      if (currentCountdownMs <= 0) return { ...session, idleMs, runMs: 0, clock: { status: "OVERDUE", currentCountdownMs: 0, overdueTimeMs: 0 } };
      return { ...session, idleMs, runMs: session.runMs - 1000, clock: { ...clock, currentCountdownMs } };
    }
    case "OVERDUE":
      return { ...session, idleMs, clock: { ...clock, overdueTimeMs: clock.overdueTimeMs + 1000 } };
    case "BREAK": {
      const currentCountdownMs = clock.currentCountdownMs - 1000;
      if (currentCountdownMs <= 0) return nextSession(session, false) ?? session; // A finished break moves on by itself, as the window closes
      return { ...session, idleMs, clock: { ...clock, currentCountdownMs } };
    }
    default:
      return { ...session, idleMs };
  }
};

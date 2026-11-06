import type { AvailableActions, TimerState } from "@main/timer/timerState";
import type { OverdueConfigs } from "@main/overdue/overdueConfigs";
import { createOverdueLevelsArray } from "@main/overdue/overdueGeometry";

export type DemoWindow = "OVERDUE" | "BREAK";

export interface TourBeat {
  route: string;       // The tab shown behind the overlay
  target?: string;     // data-testid to spotlight. None: nothing is dimmed
  demo?: DemoWindow;   // A break window drawn inside the dashboard, over a dimmed tab
  advanceOn?: string;  // data-testid of the demo window button that moves the tour on, in place of a card button
  title: string;
  body: string;
  action?: string;     // The card button's label
}

// One beat per screen. Short, and about what the app does for you, not how it's built
export const TOUR_BEATS: TourBeat[] = [
  {
    route: "/timer", target: "timer-time-digits",
    title: "Already running.",
    body: "Nothing to set up. Work, and the break comes to you.",
    action: "Next",
  },
  {
    route: "/timer", target: "toggle-timer-button",
    title: "One rule.",
    body: "Don't click stop. Every unbroken stretch earns a checkpoint. Stopping costs one, and more the longer you stay stopped.",
    action: "Got it",
  },
  {
    route: "/timer", demo: "OVERDUE", advanceOn: "overdue-window-start-break-button",
    title: "Time's up.",
    body: "This window appears and keeps growing until you take the break. Finish your thought, then press the palm.",
  },
  {
    route: "/timer", demo: "BREAK",
    title: "Breaks find you.",
    body: "The break takes the whole screen, so you actually get up. Mid-flow? Skip it with a power-up.",
    action: "Next",
  },
  {
    route: "/stats", target: "today-panel",
    title: "Stats.",
    body: "Today's checkpoint, and the month at a glance.",
    action: "Next",
  },
  {
    route: "/settings/difficulty", target: "difficulty-presets",
    title: "Difficulty.",
    body: "How many power-ups you get, how long breaks last, and how fast checkpoints drain when you stop. Normal is a good start.",
    action: "Next",
  },
  {
    route: "/timer",
    title: "That's it.",
    body: "Keep working, and don't click stop.",
    action: "Start working",
  },
];

// Skipping ends on this beat, so the way back is shown before the tour goes away
export const SKIP_BEAT: TourBeat = {
  route: "/timer", target: "replay-tour",
  title: "Skipped.",
  body: "Press ? in the corner whenever you want the tour back.",
  action: "OK",
};

export const DEMO_LEVEL_THRESHOLD_MS = 4 * 1000; // The real window grows every few minutes; the demo every few seconds
export const DEMO_BREAK_MS = 30 * 1000;

// The user's own overdue settings, on the demo's clock
export const demoOverdueLevels = (configs: OverdueConfigs) => {
  return createOverdueLevelsArray({ ...configs, levelThresholdMs: DEMO_LEVEL_THRESHOLD_MS });
};

// The break window's state for the demo, with the user's real power-ups and lunch, so the buttons match what they'll get
export const startDemo = (timerState: TimerState, demo: DemoWindow): TimerState => {
  const availableActions: AvailableActions[] = demo === "OVERDUE" ? ["breaktime"] : [];
  if (timerState.remainingPowerups > 0) availableActions.push("skip");
  if (demo === "OVERDUE" && timerState.remainingLunches > 0) availableActions.push("lunch");
  availableActions.push("stop");

  return {
    ...timerState,
    status: demo,
    overdueTimeMs: 0,
    currentCountdownMs: demo === "BREAK" ? DEMO_BREAK_MS : 0,
    availableActions,
    isWarning: false,
  };
};

// One second of the demo: overdue counts up, a break counts down and waits at zero
export const tickDemo = (state: TimerState): TimerState => {
  if (state.status === "OVERDUE") return { ...state, overdueTimeMs: state.overdueTimeMs + 1000 };
  return { ...state, currentCountdownMs: Math.max(0, state.currentCountdownMs - 1000) };
};

export const CARD_MARGIN_PX = 16;

// The card sits at the bottom, unless the spotlight reaches into that band and the top band is clear
export const placeCard = (target: { top: number; height: number } | null, screenHeight: number, cardHeight: number): "top" | "bottom" => {
  if (!target) return "bottom";
  const bottomBandTop = screenHeight - CARD_MARGIN_PX - cardHeight;
  const topBandBottom = CARD_MARGIN_PX + cardHeight;
  const touchesBottom = target.top + target.height > bottomBandTop;
  const touchesTop = target.top < topBandBottom;
  return touchesBottom && !touchesTop ? "top" : "bottom";
};

import type { AvailableActions } from "@main/timer/timerState";

export type DemoWindow = "OVERDUE" | "BREAK";
export type TourScore = "CLIMBING" | "STOPPED";

export interface TourBeat {
  route: string;        // The dashboard tab behind the card
  target?: string;      // data-testid to spotlight. None: nothing is dimmed
  demo?: DemoWindow;    // The break window, open on the tour's clock. A break covers the screen, so its card is drawn in the window
  score?: TourScore;    // The day the Stats tab shows in place of today's
  advanceOn?: Extract<AvailableActions, "breaktime" | "start">; // The real button that moves the tour on, in place of a card button
  title: string;
  body: string;
  windowBody?: string;  // A line repeated inside the window, for a card that goes by fast
  action?: string;      // The card button's label
  link?: { label: string; href: string };
}

// One beat per screen. Short, plain, and about what the app does for you, not how it's built
export const TOUR_BEATS: TourBeat[] = [
  {
    route: "/timer", target: "timer-time-digits",
    title: "The timer.",
    body: "Counts down your work block. At zero, you've earned a break.",
    action: "Next",
  },
  {
    route: "/timer", target: "toggle-timer-button",
    title: "One rule.",
    body: "Don't click stop. Stopping is the only thing that costs you.",
    action: "Got it",
  },
  {
    route: "/timer", target: "timer-time-digits", demo: "OVERDUE", advanceOn: "breaktime",
    title: "Time's up.",
    body: "Watch the timer. At zero a window opens and grows. Try moving it off screen. Then press the palm tree.",
    windowBody: "Try moving this window off screen. Then press the palm tree.",
  },
  {
    route: "/timer", demo: "BREAK",
    title: "The break.",
    body: "Takes the whole screen so you actually get up. Skip it with a power-up.",
    action: "Next",
  },
  {
    route: "/stats", target: "today-checkpoint", score: "CLIMBING",
    title: "Checkpoints.",
    body: "One level for each quarter of the day you don't stop. Five total levels, Dim to Radiant.",
    action: "Next",
  },
  {
    route: "/stats", target: "today-panel", score: "STOPPED",
    title: "If you stop.",
    body: "You drop a level, and keep dropping the longer you stay stopped.",
    action: "Next",
  },
  {
    route: "/settings/timer", target: "timer-duration",
    title: "Timer.",
    body: "How long each work block is.",
    action: "Next",
  },
  {
    route: "/settings/workday", target: "workday-schedule",
    title: "Workday.",
    body: "Your days and hours. Checkpoints only run during them.",
    action: "Next",
  },
  {
    route: "/settings/overdue", target: "settings-fields",
    title: "Overdue.",
    body: "How fast the window grows, and how big it gets.",
    action: "Next",
  },
  {
    route: "/settings/difficulty", target: "difficulty-presets",
    title: "Difficulty.",
    body: "Power-ups per day, break length, and how fast checkpoints drain when stopped.",
    action: "Next",
  },
];

// How a tour ends. The first run waits for the real start button, a replay hands the timer back, and a skip shows the way back
export const END_BEATS = {
  FIRST_RUN: {
    route: "/timer", target: "toggle-timer-button", advanceOn: "start",
    title: "Press start.",
    body: "That's all. ? in the corner replays this.",
  },
  REPLAY: {
    route: "/timer",
    title: "That's it.",
    body: "Keep working, and don't click stop.",
    action: "OK",
  },
  SKIPPED: {
    route: "/timer", target: "replay-tour",
    title: "Skipped.",
    body: "Press ? in the corner whenever you want the tour back.",
    action: "OK",
  },
} satisfies Record<string, TourBeat>;

export type TourEnd = keyof typeof END_BEATS;

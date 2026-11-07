import type { AvailableActions } from "@main/timer/timerState";

export type DemoWindow = "OVERDUE" | "BREAK";

export interface TourBeat {
  route: string;        // The dashboard tab behind the card
  target?: string;      // data-testid to spotlight. None: nothing is dimmed
  demo?: DemoWindow;    // The break window, open on the tour's clock. A break covers the screen, so its card is drawn in the window
  advanceOn?: Extract<AvailableActions, "breaktime" | "start">; // The real button that moves the tour on, in place of a card button
  title: string;
  body: string;
  action?: string;      // The card button's label
  link?: { label: string; href: string };
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
    route: "/timer", demo: "OVERDUE", advanceOn: "breaktime",
    title: "Time's up.",
    body: "This window appears and keeps growing until you take the break. Try dragging it off the screen. Go on. Then press the palm.",
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
];

// How a tour ends. The first run waits for the real start button, a replay hands the timer back, and a skip shows the way back
export const END_BEATS = {
  FIRST_RUN: {
    route: "/timer", target: "toggle-timer-button", advanceOn: "start",
    title: "Press start.",
    body: "Keep working, and don't click stop. The ? in the corner brings the tour back.",
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

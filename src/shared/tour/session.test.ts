import { describe, test, expect } from 'vitest';
import { END_BEATS, TOUR_BEATS, TourBeat } from './beats';
import { currentBeat, hasTimedOut, isFading, namesAction, nextSession, prevSession, showsRealTimer, skipSession, startSession, tickSession, TOUR, TourSession, tourUpdateOf } from './session';

const ticks = (session: TourSession, seconds: number) => {
  for (let i = 0; i < seconds; i++) session = tickSession(session);
  return session;
};
const toStep = (session: TourSession, step: number) => {
  while (session.step < step) session = nextSession(session, true)!;
  return session;
};
const OVERDUE_STEP = TOUR_BEATS.findIndex((beat) => beat.demo === 'OVERDUE');

describe('tour beats', () => {
  test('every beat moves on by one button only: the card, or a real one', () => {
    const beats: TourBeat[] = [...TOUR_BEATS, ...Object.values(END_BEATS)];
    for (const beat of beats) {
      expect(Boolean(beat.action) !== Boolean(beat.advanceOn), beat.title).toBe(true);
    }
  });

  test('the first run ends on the real start button, and a skip points at the button that brings the tour back', () => {
    expect(END_BEATS.FIRST_RUN).toMatchObject({ advanceOn: 'start', target: 'toggle-timer-button' });
    expect(END_BEATS.SKIPPED).toMatchObject({ target: 'replay-tour', action: 'OK' });
  });
});

describe('the tour clock', () => {
  test('opens on 45:00, runs a few seconds, then holds', () => {
    const session = startSession(true);
    expect(session.clock).toMatchObject({ status: 'RUNNING', currentCountdownMs: TOUR.COUNTDOWN_MS });
    expect(ticks(session, 10).clock.currentCountdownMs).toBe(TOUR.COUNTDOWN_MS - TOUR.RUN_MS);
  });

  test('the overdue beat counts the last seconds down, opens the window, and grows it until the palm', () => {
    let session = toStep(startSession(true), OVERDUE_STEP);
    expect(session.clock.currentCountdownMs).toBe(TOUR.RUN_MS);
    session = ticks(session, TOUR.RUN_MS / 1000);
    expect(session.clock).toMatchObject({ status: 'OVERDUE', overdueTimeMs: 0 });
    expect(ticks(session, 5).clock.overdueTimeMs).toBe(5000);

    expect(namesAction(session, 'stop')).toBe(false);
    expect(namesAction(session, 'breaktime')).toBe(true);
    const onBreak = nextSession(session, true)!;
    expect(onBreak.clock).toMatchObject({ status: 'BREAK', currentCountdownMs: TOUR.BREAK_MS });
  });

  test('a finished break moves the tour on by itself, with a fresh held clock', () => {
    const onBreak = toStep(startSession(true), OVERDUE_STEP + 1);
    const after = ticks(onBreak, TOUR.BREAK_MS / 1000);
    expect(after.step).toBe(OVERDUE_STEP + 2);
    expect(after.clock).toMatchObject({ status: 'RUNNING', currentCountdownMs: TOUR.COUNTDOWN_MS });
    expect(ticks(after, 5).clock.currentCountdownMs).toBe(TOUR.COUNTDOWN_MS);
  });
});

describe('going back', () => {
  test('steps back a beat, out of the window and into it again, and from the last card; not from the first beat or a skip', () => {
    const first = startSession(false);
    expect(tourUpdateOf(first).canGoBack).toBe(false);
    expect(prevSession(first)).toBe(first);

    const overdue = ticks(toStep(first, OVERDUE_STEP), TOUR.RUN_MS / 1000);
    const before = prevSession(overdue);
    expect(before.step).toBe(OVERDUE_STEP - 1);
    expect(before.clock).toMatchObject({ status: 'RUNNING', currentCountdownMs: TOUR.COUNTDOWN_MS }); // The window closes with the beat
    const onBreak = nextSession(overdue, true)!;
    expect(prevSession(onBreak).clock).toMatchObject({ status: 'RUNNING', currentCountdownMs: TOUR.RUN_MS }); // Counts down to the window again
    expect(prevSession(nextSession(onBreak, true)!).clock.status).toBe('BREAK');

    const end = nextSession(toStep(first, TOUR_BEATS.length - 1), true)!;
    expect(tourUpdateOf(end).canGoBack).toBe(true);
    expect(prevSession(end)).toMatchObject({ step: TOUR_BEATS.length - 1, end: null });
    expect(tourUpdateOf(skipSession(first, false)).canGoBack).toBe(false);
    expect(tourUpdateOf(skipSession(startSession(true), true)).canGoBack).toBe(false); // A skipped first run's start prompt: just the start button
  });
});

describe('how a tour ends', () => {
  test('a first run ends on the start prompt, showing the real stopped timer, and the start action finishes it', () => {
    const last = toStep(startSession(true), TOUR_BEATS.length - 1);
    const end = nextSession(last, true)!;
    expect(currentBeat(end)).toBe(END_BEATS.FIRST_RUN);
    expect(showsRealTimer(end)).toBe(true);
    expect(tourUpdateOf(end).step).toBe(TOUR_BEATS.length);
    expect(nextSession(end, true)).toBeNull();
  });

  test('a first run whose timer was started another way, or a replay, just hands the timer back', () => {
    const last = toStep(startSession(true), TOUR_BEATS.length - 1);
    expect(currentBeat(nextSession(last, false)!)).toBe(END_BEATS.REPLAY);
    expect(currentBeat(nextSession(toStep(startSession(false), TOUR_BEATS.length - 1), true)!)).toBe(END_BEATS.REPLAY);
  });

  test('skipping a first run goes to the start prompt, skipping a replay shows the way back', () => {
    expect(currentBeat(skipSession(startSession(true), true))).toBe(END_BEATS.FIRST_RUN);
    expect(currentBeat(skipSession(startSession(false), true))).toBe(END_BEATS.SKIPPED);
    const skipped = skipSession(toStep(startSession(false), OVERDUE_STEP), false);
    expect(skipped.clock.status).toBe('RUNNING'); // The window goes away with the beat
  });

  test('a replay fades, then times out, when nothing is clicked; a click resets that', () => {
    let session = ticks(startSession(false), (TOUR.IDLE_MS - TOUR.FADE_MS) / 1000);
    expect(isFading(session)).toBe(true);
    expect(hasTimedOut(session)).toBe(false);
    expect(isFading(nextSession(session, true)!)).toBe(false);
    session = ticks(session, TOUR.FADE_MS / 1000);
    expect(hasTimedOut(session)).toBe(true);
  });

  test('a first run never times out', () => {
    const session = ticks(startSession(true), TOUR.IDLE_MS / 1000 + 10);
    expect(isFading(session)).toBe(false);
    expect(hasTimedOut(session)).toBe(false);
  });
});

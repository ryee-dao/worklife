import { describe, test, expect } from 'vitest';
import type { TimerState } from '@main/timer/timerState';
import { DEFAULTS } from '@shared/constants';
import { DEMO_BREAK_MS, DEMO_LEVEL_THRESHOLD_MS, demoOverdueLevels, placeCard, SKIP_BEAT, startDemo, tickDemo, TOUR_BEATS } from './beats';

const running: TimerState = {
  status: 'RUNNING',
  currentCountdownMs: 10 * 60 * 1000,
  overdueTimeMs: 0,
  availableActions: ['stop', 'forward', 'snooze', 'lunch'],
  remainingPowerups: 3,
  allottedPowerups: 3,
  remainingLunches: 1,
  snoozeDurationMs: 5 * 60 * 1000,
  lunchDurationMs: 45 * 60 * 1000,
  isWarning: false,
};

describe('tour beats', () => {
  test('every beat moves on by one button only: the card, or one in the demo window', () => {
    for (const beat of TOUR_BEATS) {
      expect(Boolean(beat.action) !== Boolean(beat.advanceOn), beat.title).toBe(true);
    }
  });

  test('the overdue demo moves on from its palm button, and the last beat starts work', () => {
    const overdue = TOUR_BEATS.find((beat) => beat.demo === 'OVERDUE')!;
    expect(overdue.advanceOn).toBe('overdue-window-start-break-button');
    expect(TOUR_BEATS.at(-1)).toMatchObject({ route: '/timer', action: 'Start working' });
  });

  test('skipping points at the button that brings the tour back', () => {
    expect(SKIP_BEAT).toMatchObject({ target: 'replay-tour', action: 'OK' });
    expect(SKIP_BEAT.demo).toBeUndefined();
  });
});

describe('demo break window', () => {
  test('overdue offers the same buttons as the real window, with the real power-ups and lunch', () => {
    expect(startDemo(running, 'OVERDUE')).toMatchObject({
      status: 'OVERDUE', overdueTimeMs: 0, currentCountdownMs: 0,
      availableActions: ['breaktime', 'skip', 'lunch', 'stop'],
    });
    expect(startDemo({ ...running, remainingPowerups: 0, remainingLunches: 0 }, 'OVERDUE').availableActions).toEqual(['breaktime', 'stop']);
  });

  test('a break counts down from the demo length and can only be skipped with a power-up', () => {
    expect(startDemo(running, 'BREAK')).toMatchObject({ status: 'BREAK', currentCountdownMs: DEMO_BREAK_MS, availableActions: ['skip', 'stop'] });
    expect(startDemo({ ...running, remainingPowerups: 0 }, 'BREAK').availableActions).toEqual(['stop']);
  });

  test('overdue counts up, a break counts down and waits at zero', () => {
    expect(tickDemo(startDemo(running, 'OVERDUE')).overdueTimeMs).toBe(1000);
    const breakState = { ...startDemo(running, 'BREAK'), currentCountdownMs: 1000 };
    expect(tickDemo(breakState).currentCountdownMs).toBe(0);
    expect(tickDemo(tickDemo(breakState)).currentCountdownMs).toBe(0);
  });

  test('the demo window grows through every level on a faster clock', () => {
    const levels = demoOverdueLevels({ levelThresholdMs: DEFAULTS.DEFAULT_LEVEL_THRESHOLD_MS, windowLevelCap: 5, windowRatioCap: 0.9 });
    expect(levels.map((level) => level.levelStartMs)).toEqual([0, 1, 2, 3, 4].map((level) => level * DEMO_LEVEL_THRESHOLD_MS));
    expect(levels.at(-1)!.levelWindowRatio).toBe(0.9);
  });
});

describe('placeCard', () => {
  const cardHeight = 140; // Bands: top 16..156, bottom 444..600 on a 600px screen

  test('the card moves to the top only when the spotlight reaches the bottom band and the top band is clear', () => {
    expect(placeCard({ top: 100, height: 50 }, 600, cardHeight)).toBe('bottom');
    expect(placeCard({ top: 420, height: 100 }, 600, cardHeight)).toBe('top');
    expect(placeCard({ top: 120, height: 400 }, 600, cardHeight)).toBe('bottom'); // Touches both, so the bottom, which covers nothing it points at
    expect(placeCard(null, 600, cardHeight)).toBe('bottom');
  });
});

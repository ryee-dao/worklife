import { describe, test, expect } from 'vitest';
import type { StatsEvent } from '@main/stats/stats';
import { getTodayScore } from '@main/stats/checkpoints';
import { TOUR_BEATS } from './beats';
import { tourScore } from './score';

const beatWith = (score: 'CLIMBING' | 'STOPPED') => TOUR_BEATS.find((beat) => beat.score === score)!;

describe('the tour day', () => {
  test('climbs, then drops a level and drains when the stop beat comes', () => {
    const now = Date.now();
    const climbing = tourScore(beatWith('CLIMBING'), now)!;
    const stopped = tourScore(beatWith('STOPPED'), now)!;
    expect(climbing).toMatchObject({ level: 2, losing: false, climbing: true });
    expect(stopped).toMatchObject({ level: 1, losing: true, runStart: null });
    expect(stopped.nextLossAt).toBeGreaterThan(now);
    expect(stopped.pieces.at(-1)).toMatchObject({ activity: 'STOPPED', end: now });
    expect(tourScore(TOUR_BEATS[0], now)).toBeNull();
  });

  // The day is built by hand, so this keeps it honest: the real scorer, given the same day, must say the same
  test('is what the scorer would make of that day', () => {
    const now = new Date(2026, 0, 14, 13, 1).getTime(); // 1:01 PM local, a minute past four hours into a nine-to-five
    const workday = { days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00', autoStopAtEnd: false };
    const event = (at: number, transition: { type: 'APP_STARTED'; previousStatus: null } | { type: 'STOPPED'; source: 'WINDOW'; from: 'RUNNING'; countdownMs: number }): StatsEvent => ({
      v: 1,
      id: String(at),
      at,
      tzOffsetMin: 0 - new Date(at).getTimezoneOffset(),
      config: {
        timerDurationMs: 0, breakDurationMs: 0, warningThresholdMs: 0, snoozeDurationMs: 0, allottedPowerups: 0, lunchDurationMs: 0,
        checkpointDecayMs: 15 * 60 * 1000, difficulty: 'NORMAL', levelThresholdMs: 0, workday,
      },
      ...transition,
    });
    const climbing = tourScore(beatWith('CLIMBING'), now)!;
    const stopped = tourScore(beatWith('STOPPED'), now)!;
    const started = event(climbing.workStart, { type: 'APP_STARTED', previousStatus: null });
    const stop = event(stopped.pieces.at(-1)!.start, { type: 'STOPPED', source: 'WINDOW', from: 'RUNNING', countdownMs: 0 });

    expect(getTodayScore([started], now)).toEqual(climbing);
    expect(getTodayScore([started, stop], now)).toEqual(stopped);
  });
});

import { describe, test, expect } from 'vitest';
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
});

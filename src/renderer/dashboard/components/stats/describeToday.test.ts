import { describe, test, expect } from 'vitest';
import type { DayScore } from '@main/stats/checkpoints';
import { describeToday } from './describeToday';

const HOUR = 60 * 60 * 1000;
const workStart = new Date(2026, 9, 26, 9, 0).getTime();
const workEnd = workStart + 8 * HOUR;
const now = workStart + 3 * HOUR; // Noon, Glimmer

const day = (overrides: Partial<DayScore> = {}): DayScore => ({
  localDate: '2026-10-26', level: 1, inProgress: true, climbing: true, runStart: workStart, nextCheckpointAt: workStart + 4 * HOUR,
  nextLossAt: null, losing: false, bestPossible: 4, pieces: [], workStart, workEnd, powerupsUsed: 0, lunchTaken: false, ...overrides,
});

describe('the today panel', () => {
  test('counts down to the next checkpoint while climbing', () => {
    expect(describeToday(day(), now)).toEqual({ countdown: '1:00:00', unit: 'until Glow', line: 'Unbroken for 3:00:00 · Radiant still reachable', stopped: false });
  });

  test('counts down the day when no checkpoint fits before it ends, and at Radiant', () => {
    expect(describeToday(day({ nextCheckpointAt: null }), workEnd - 30 * 60 * 1000)).toMatchObject({ countdown: '30:00', unit: 'left · hold Glimmer' });
    expect(describeToday(day({ level: 4, nextCheckpointAt: null }), now)).toMatchObject({ countdown: '5:00:00', unit: 'left', line: 'The whole day, unbroken' });
  });

  test('while stopped, warns and says when the next checkpoint goes', () => {
    const stopped = day({ climbing: false, runStart: null, losing: true, nextLossAt: now + 10 * 60 * 1000 });
    expect(describeToday(stopped, now)).toEqual({ countdown: null, unit: 'Resume to climb again', line: 'Stopped · drop to Dim in 10:00', stopped: true });
    expect(describeToday(day({ ...stopped, level: 0, nextLossAt: null }), now).line).toBe('Stopped');
  });

  test('before and after the workday there is no countdown', () => {
    expect(describeToday(day(), workStart - HOUR)).toMatchObject({ countdown: null, unit: /^Workday starts at/ });
    expect(describeToday(day({ inProgress: false }), workEnd + HOUR)).toEqual({ countdown: null, unit: null, line: 'Where the workday ended', stopped: false });
  });
});

import { describe, test, expect } from 'vitest';
import { countCleanDays, DayScore, getDayScores, getTodayScore } from './cleanDays';
import { StatsEvent } from './stats';
import { WorkdayConfigs } from '../workday/workdayConfigs';

const defaultWorkday: WorkdayConfigs = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false };
const normalConfig = { timerDurationMs: 45 * 60 * 1000, partialThreshold: 0.5, workday: defaultWorkday };
const hardConfig = { ...normalConfig, partialThreshold: 0.7 };
const tzOffsetMin = -240; // New York in October

// Monday, October 26, 2026 is a workday. The 31st is a Saturday
const monday = '2026-10-26';

// Helper: epoch ms of a local New York time, e.g. at('2026-10-26 09:00')
const at = (localTime: string) => Date.parse(`${localTime.replace(' ', 'T')}:00-04:00`);
const nextMorning = at('2026-10-27 08:00');

// Helper: an event at a local time on Monday, with only the fields scoring looks at
const createEvent = (type: string, time: string, extra: object = {}, config: object = normalConfig) => ({
  v: 1,
  id: `${type}-${time}`,
  at: at(`${monday} ${time}`),
  tzOffsetMin,
  config,
  type,
  ...extra,
}) as unknown as StatsEvent;

// Helper: Monday's score once the day is over
const scoreMonday = (events: StatsEvent[], now = nextMorning) => getDayScores(events, now)[monday];

describe('A full workday', () => {
  test('running all day without a violation is clean', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('APP_QUIT', '17:30')];

    expect(scoreMonday(events).result).toBe('CLEAN');
  });

  test('a short stop costs the clean but not the partial', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('STOPPED', '13:00', { source: 'WINDOW' }),
      createEvent('RESUMED', '13:10', { source: 'WINDOW' }),
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).result).toBe('PARTIAL');
  });

  test('stopping for the rest of the day is partial when compliant time reaches the threshold', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('STOPPED', '13:00', { source: 'WINDOW' }), // 4 of 8 hours compliant, exactly 50%
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).result).toBe('PARTIAL');
  });

  test('stopping for the rest of the day is not clean when compliant time is below the threshold', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('STOPPED', '11:00', { source: 'TRAY' }), // 2 of 8 hours compliant
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).result).toBe('NOT_CLEAN');
  });

  test('the threshold comes from the difficulty the day started with', () => {
    const events = [
      createEvent('APP_STARTED', '08:30', {}, hardConfig),
      createEvent('STOPPED', '13:00', { source: 'WINDOW' }, hardConfig), // 50% compliant, Hard needs 70%
      createEvent('APP_QUIT', '17:30', {}, hardConfig),
    ];

    expect(scoreMonday(events).result).toBe('NOT_CLEAN');
  });

  test('uses the workday the day started with', () => {
    const lateConfig = { ...normalConfig, workday: { ...defaultWorkday, start: '11:00' } };
    const events = [createEvent('APP_STARTED', '11:00', {}, lateConfig), createEvent('APP_QUIT', '17:30', {}, lateConfig)];

    expect(scoreMonday(events).result).toBe('CLEAN');
  });
});

describe('Starting late', () => {
  test('opening the app partway through with no violations is partial past the floor', () => {
    const events = [createEvent('APP_STARTED', '14:00'), createEvent('APP_QUIT', '17:30')]; // 3 of 8 hours

    expect(scoreMonday(events).result).toBe('PARTIAL');
  });

  test('opening the app too late to reach the floor does not count', () => {
    const events = [createEvent('APP_STARTED', '16:00'), createEvent('APP_QUIT', '17:30')]; // 1 of 8 hours

    expect(scoreMonday(events).result).toBeNull();
  });

  test('being closed overnight before a late start is not a violation', () => {
    const sundayQuit = { ...createEvent('APP_QUIT', '20:00'), at: at('2026-10-25 20:00') };
    const events = [sundayQuit, createEvent('APP_STARTED', '14:00'), createEvent('APP_QUIT', '17:30')];

    expect(scoreMonday(events).result).toBe('PARTIAL');
  });

  test('a few minutes late is still clean', () => {
    const events = [createEvent('APP_STARTED', '09:03'), createEvent('APP_QUIT', '17:30')];

    expect(scoreMonday(events).result).toBe('CLEAN');
  });

  test('a stop carried over from before work hours is not a violation', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('STOPPED', '08:50', { source: 'WINDOW' }),
      createEvent('RESUMED', '09:01', { source: 'SCHEDULE' }), // The workday check runs once a minute
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).result).toBe('CLEAN');
  });
});

describe('The app closing', () => {
  test('a restart within the grace period is still clean', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('APP_QUIT', '12:00'),
      createEvent('APP_STARTED', '12:04'), // 10% of a 45 minute timer is 4.5 minutes
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).result).toBe('CLEAN');
  });

  test('the grace period scales with the timer', () => {
    const pomodoroConfig = { ...normalConfig, timerDurationMs: 15 * 60 * 1000 }; // 1.5 minute grace
    const events = [
      createEvent('APP_STARTED', '08:30', {}, pomodoroConfig),
      createEvent('APP_QUIT', '12:00', {}, pomodoroConfig),
      createEvent('APP_STARTED', '12:04', {}, pomodoroConfig),
      createEvent('APP_QUIT', '17:30', {}, pomodoroConfig),
    ];

    expect(scoreMonday(events).result).toBe('PARTIAL');
  });

  test('quitting during work hours counts like a stop', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('APP_QUIT', '11:00')]; // 2 of 8 hours

    expect(scoreMonday(events).result).toBe('NOT_CLEAN');
  });

  test('a crash is placed at the last heartbeat and counts like a stop', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('HEARTBEAT', '12:00'),
      createEvent('APP_STARTED', '13:00'), // No APP_QUIT, so it crashed after 12:00
      createEvent('APP_QUIT', '17:30'),
    ];
    const score = scoreMonday(events);

    expect(score.result).toBe('PARTIAL');
    expect(score.compliance).toBe(7 / 8);
  });
});

describe('Overdue', () => {
  test('overdue within the allowance is still clean', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('OVERDUE_STARTED', '10:00', { cause: 'COUNTDOWN_ENDED' }),
      createEvent('BREAK_STARTED', '10:08', { source: 'WINDOW' }), // 20% of a 45 minute timer is 9 minutes
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).result).toBe('CLEAN');
  });

  test('overdue past the allowance is a violation', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('OVERDUE_STARTED', '10:00', { cause: 'COUNTDOWN_ENDED' }),
      createEvent('BREAK_STARTED', '13:00', { source: 'WINDOW' }),
      createEvent('APP_QUIT', '17:30'),
    ];
    const score = scoreMonday(events);

    expect(score.result).toBe('PARTIAL');
    expect(score.compliance).toBeCloseTo((8 * 60 - (3 * 60 - 9)) / (8 * 60)); // Everything but the overdue past 9 minutes
  });

  test('the break itself counts as compliant', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('OVERDUE_STARTED', '10:00', { cause: 'COUNTDOWN_ENDED' }),
      createEvent('BREAK_STARTED', '10:01', { source: 'WINDOW' }),
      createEvent('BREAK_COMPLETED', '10:03'),
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).compliance).toBe(1);
  });
});

describe('Days that do not count', () => {
  test('the workday\'s own auto stop is not a violation', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('STOPPED', '17:00', { source: 'SCHEDULE' }),
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).result).toBe('CLEAN');
  });

  test('days off are left out', () => {
    const saturday = (time: string) => ({ ...createEvent('APP_STARTED', time), at: at(`2026-10-31 ${time}`) });
    const events = [saturday('08:30')];

    expect(getDayScores(events, at('2026-11-01 08:00'))).toEqual({});
  });

  test('a workday where the app only ran outside work hours does not count', () => {
    const events = [createEvent('APP_STARTED', '18:00'), createEvent('APP_QUIT', '20:00')];

    expect(scoreMonday(events).result).toBeNull();
  });
});

describe('Today, while the workday is still going', () => {
  test('is not judged yet', () => {
    const events = [createEvent('APP_STARTED', '08:30')];
    const score = scoreMonday(events, at(`${monday} 12:00`));

    expect(score.result).toBeNull();
    expect(score.inProgress).toBe(true);
    expect(score.compliance).toBe(3 / 8);
    expect(score.cleanPossible).toBe(true);
  });

  test('shows when a violation is happening right now', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('STOPPED', '10:00', { source: 'WINDOW' })];
    const score = scoreMonday(events, at(`${monday} 11:00`));

    expect(score.violatingNow).toBe(true);
    expect(score.cleanPossible).toBe(false);
    expect(score.partialPossible).toBe(true);
  });

  test('stops showing the violation once resumed', () => {
    const events = [
      createEvent('APP_STARTED', '08:30'),
      createEvent('STOPPED', '10:00', { source: 'WINDOW' }),
      createEvent('RESUMED', '10:05', { source: 'WINDOW' }),
    ];

    expect(scoreMonday(events, at(`${monday} 11:00`)).violatingNow).toBe(false);
  });

  test('knows when even a partial is out of reach', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('STOPPED', '09:30', { source: 'WINDOW' })];
    // At 14:00: 0.5h compliant + 3h left = 3.5 of 8 hours, below 50%

    expect(scoreMonday(events, at(`${monday} 14:00`)).partialPossible).toBe(false);
  });

  test('before work hours nothing is scored yet', () => {
    const events = [createEvent('APP_STARTED', '08:00')];
    const score = scoreMonday(events, at(`${monday} 08:30`));

    expect(score.compliance).toBe(0);
    expect(score.cleanPossible).toBe(true);
  });

  test('getTodayScore returns the score for the current local date', () => {
    const events = [createEvent('APP_STARTED', '08:30')];

    expect(getTodayScore(events, at(`${monday} 12:00`))?.localDate).toBe(monday);
    expect(getTodayScore([], at(`${monday} 12:00`))).toBeNull();
  });
});

describe('Day details', () => {
  test('counts the skips and snoozes used that day', () => {
    const config = { ...normalConfig, allottedBreaks: 3, allottedSnoozes: 3 };
    const events = [
      createEvent('APP_STARTED', '08:30', {}, config),
      createEvent('SNOOZED', '09:40', { source: 'WINDOW' }, config),
      createEvent('OVERDUE_STARTED', '10:00', { cause: 'COUNTDOWN_ENDED' }, config),
      createEvent('BREAK_SKIPPED', '10:01', { source: 'WINDOW' }, config),
      createEvent('APP_QUIT', '17:30', {}, config),
    ];
    const score = scoreMonday(events);

    expect(score.skipsUsed).toBe(1);
    expect(score.snoozesUsed).toBe(1);
    expect(score.allottedBreaks).toBe(3);
  });

  test('the best possible share counts the time left in the day', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('STOPPED', '10:00', { source: 'WINDOW' })];
    // At 13:00: 1 hour compliant + 4 hours left = 5 of 8 hours

    expect(scoreMonday(events, at(`${monday} 13:00`)).bestPossible).toBe(5 / 8);
  });
});

describe('Counting clean days', () => {
  test('a clean day is 1, a partial clean is half, and the rest are 0', () => {
    const withResult = (result: DayScore['result']) => ({ result }) as DayScore;

    expect(countCleanDays({
      '2026-10-26': withResult('CLEAN'),
      '2026-10-27': withResult('PARTIAL'),
      '2026-10-28': withResult('NOT_CLEAN'),
      '2026-10-29': withResult(null),
      '2026-10-30': withResult('CLEAN'),
    })).toBe(2.5);
  });
});

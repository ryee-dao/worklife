import { describe, test, expect } from 'vitest';
import { countCleanDays, getDayResults } from './cleanDays';
import { StatsEvent } from './stats';
import { WorkdayConfigs } from '../workday/workdayConfigs';

const defaultWorkday: WorkdayConfigs = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false };
const tzOffsetMin = -240; // New York in October

// Helper: an event at a local New York time, e.g. at('2026-10-26 09:00')
const at = (localTime: string) => Date.parse(`${localTime.replace(' ', 'T')}:00-04:00`);

// Helper: build an event with only the fields clean days look at
const createEvent = (type: string, localTime: string, extra: object = {}, workday = defaultWorkday) => ({
  v: 1,
  id: localTime,
  at: at(localTime),
  tzOffsetMin,
  config: { workday },
  type,
  ...extra,
}) as unknown as StatsEvent;

// Monday, October 26, 2026 is a workday. The 31st is a Saturday
const monday = '2026-10-26';
const nextMorning = at('2026-10-27 08:00');

describe('Judging a workday', () => {
  test('running the whole workday without stopping is clean', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'CLEAN' });
  });

  test('stopping during work hours is not clean', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('STOPPED', `${monday} 13:00`, { source: 'WINDOW' }),
      createEvent('RESUMED', `${monday} 13:10`, { source: 'WINDOW' }),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'NOT_CLEAN' });
  });

  test('stopping outside work hours does not count', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('STOPPED', `${monday} 08:45`, { source: 'TRAY' }),
      createEvent('RESUMED', `${monday} 09:00`, { source: 'SCHEDULE' }),
      createEvent('STOPPED', `${monday} 17:15`, { source: 'TRAY' }),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'CLEAN' });
  });

  test('the workday\'s own auto stop does not count', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('STOPPED', `${monday} 16:59`, { source: 'SCHEDULE' }),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'CLEAN' });
  });

  test('running only part of the workday without stopping is a partial clean', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 11:00`),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'PARTIAL' });
  });

  test('quitting before the workday ends is a partial clean', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('APP_QUIT', `${monday} 15:00`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'PARTIAL' });
  });

  test('uses the workday the day started with', () => {
    const lateWorkday = { ...defaultWorkday, start: '11:00' };
    const events = [
      createEvent('APP_STARTED', `${monday} 11:00`, {}, lateWorkday),
      createEvent('APP_QUIT', `${monday} 17:30`, {}, lateWorkday),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'CLEAN' });
  });
});

describe('Gaps while the app was not running', () => {
  test('a restart under 5 minutes is still clean', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('APP_QUIT', `${monday} 12:00`),
      createEvent('APP_STARTED', `${monday} 12:04`),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'CLEAN' });
  });

  test('a gap over 5 minutes makes it a partial clean', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('APP_QUIT', `${monday} 12:00`),
      createEvent('APP_STARTED', `${monday} 12:10`),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'PARTIAL' });
  });

  test('a crash ends the run at its last event', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('OVERDUE_STARTED', `${monday} 10:00`, { cause: 'COUNTDOWN_ENDED' }),
      // Crashed with no APP_QUIT, restarted an hour later
      createEvent('APP_STARTED', `${monday} 11:00`),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'PARTIAL' });
  });

  test('starting a few minutes late is still clean', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 09:03`),
      createEvent('APP_QUIT', `${monday} 17:30`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({ [monday]: 'CLEAN' });
  });
});

describe('Days that do not count', () => {
  test('days off are left out', () => {
    const saturday = '2026-10-31';
    const events = [
      createEvent('APP_STARTED', `${saturday} 08:30`),
      createEvent('STOPPED', `${saturday} 12:00`, { source: 'WINDOW' }),
      createEvent('APP_QUIT', `${saturday} 17:30`),
    ];

    expect(getDayResults(events, at('2026-11-01 08:00'))).toEqual({});
  });

  test('a workday where the app only ran outside work hours is left out', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 18:00`),
      createEvent('APP_QUIT', `${monday} 20:00`),
    ];

    expect(getDayResults(events, nextMorning)).toEqual({});
  });

  test('today is not judged until the workday ends', () => {
    const events = [createEvent('APP_STARTED', `${monday} 08:30`)];

    expect(getDayResults(events, at(`${monday} 12:00`))).toEqual({});
  });

  test('a stop today counts right away', () => {
    const events = [
      createEvent('APP_STARTED', `${monday} 08:30`),
      createEvent('STOPPED', `${monday} 10:00`, { source: 'WINDOW' }),
    ];

    expect(getDayResults(events, at(`${monday} 12:00`))).toEqual({ [monday]: 'NOT_CLEAN' });
  });

  test('a run that is still going counts up to now', () => {
    const events = [createEvent('APP_STARTED', `${monday} 08:30`)];

    expect(getDayResults(events, at(`${monday} 18:00`))).toEqual({ [monday]: 'CLEAN' });
  });
});

describe('Counting clean days', () => {
  test('a clean day is 1, a partial clean is half, and not clean is 0', () => {
    expect(countCleanDays({
      '2026-10-26': 'CLEAN',
      '2026-10-27': 'PARTIAL',
      '2026-10-28': 'NOT_CLEAN',
      '2026-10-29': 'CLEAN',
    })).toBe(2.5);
  });

  test('no days is 0', () => {
    expect(countCleanDays({})).toBe(0);
  });
});

import { describe, test, expect } from 'vitest';
import { getDayScores, getTodayScore } from './checkpoints';
import { StatsEvent } from './stats';
import { WorkdayConfigs } from '../workday/workdayConfigs';

const defaultWorkday: WorkdayConfigs = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false };
const normalConfig = { workday: defaultWorkday };
const tzOffsetMin = -240; // New York in October

// Monday, October 26, 2026 is a workday. The 31st is a Saturday
const monday = '2026-10-26';

// The levels by name, so a test reads as the checkpoint it expects
const DIM = 0, GLIMMER = 1, GLOW = 2, SHINE = 3, RADIANT = 4;

// Helper: epoch ms of a local New York time, e.g. at('2026-10-26 09:00')
const at = (localTime: string) => Date.parse(`${localTime.replace(' ', 'T')}:00-04:00`);
const onMonday = (time: string) => at(`${monday} ${time}`);
const nextMorning = at('2026-10-27 08:00');

// Helper: an event at a local time on Monday, with only the fields scoring looks at
const createEvent = (type: string, time: string, extra: object = {}, config: object = normalConfig) => ({
  v: 1,
  id: `${type}-${time}`,
  at: onMonday(time),
  tzOffsetMin,
  config,
  type,
  ...extra,
}) as unknown as StatsEvent;

// Helper: Monday's score at a moment, by default once the day is over
const scoreMonday = (events: StatsEvent[], now = nextMorning) => getDayScores(events, now)[monday];

// Helper: started before work, then the given events, then quit after work
const workdayWith = (...events: StatsEvent[]) => [
  createEvent('APP_STARTED', '08:30'),
  ...events,
  createEvent('APP_QUIT', '17:30'),
];

describe('Climbing', () => {
  test('running all day reaches Radiant', () => {
    expect(scoreMonday(workdayWith()).level).toBe(RADIANT);
  });

  test.each([
    { time: '10:59', level: DIM },
    { time: '11:00', level: GLIMMER },
    { time: '13:00', level: GLOW },
    { time: '15:00', level: SHINE },
    { time: '16:59', level: SHINE },
  ])('each unbroken quarter of the workday climbs one checkpoint: $time', ({ time, level }) => {
    expect(scoreMonday(workdayWith(), onMonday(time)).level).toBe(level);
  });

  test('overdue and breaks keep the run going', () => {
    const events = workdayWith(
      createEvent('OVERDUE_STARTED', '10:00', { cause: 'COUNTDOWN_ENDED' }),
      createEvent('BREAK_STARTED', '10:20'),
      createEvent('BREAK_COMPLETED', '10:25'),
    );

    expect(scoreMonday(events).level).toBe(RADIANT);
  });

  test('lunch keeps the run going', () => {
    const events = workdayWith(
      createEvent('LUNCH_STARTED', '12:00', { from: 'RUNNING' }),
      createEvent('LUNCH_ENDED', '12:45', { cause: 'TIME_UP' }),
    );

    expect(scoreMonday(events).level).toBe(RADIANT);
  });

  test('uses the workday the day started with', () => {
    const lateConfig = { workday: { ...defaultWorkday, start: '11:00' } }; // 6 hours, so a checkpoint every 1.5
    const events = [createEvent('APP_STARTED', '11:00', {}, lateConfig), createEvent('APP_QUIT', '17:30', {}, lateConfig)];

    expect(scoreMonday(events, onMonday('12:30')).level).toBe(GLIMMER);
    expect(scoreMonday(events).level).toBe(RADIANT);
  });
});

describe('Stopping', () => {
  test('a stop drops one checkpoint and the climb starts over', () => {
    const events = workdayWith(
      createEvent('STOPPED', '16:00', { from: 'RUNNING' }), // At Shine
      createEvent('RESUMED', '16:00'),
    );

    expect(scoreMonday(events).level).toBe(GLOW); // One hour left isn't enough to climb back
  });

  test('a stop early enough leaves time to climb back', () => {
    const events = workdayWith(
      createEvent('STOPPED', '15:00', { from: 'RUNNING' }), // At Shine
      createEvent('RESUMED', '15:00'),
    );

    expect(scoreMonday(events).level).toBe(SHINE); // Glow, plus 2 unbroken hours
  });

  test('staying stopped loses another checkpoint every 1/32 of the workday', () => {
    const events = workdayWith(createEvent('STOPPED', '15:00', { from: 'RUNNING' })); // Shine, down to Glow

    expect(scoreMonday(events, onMonday('15:14')).level).toBe(GLOW);
    expect(scoreMonday(events, onMonday('15:15')).level).toBe(GLIMMER);
    expect(scoreMonday(events, onMonday('15:30')).level).toBe(DIM);
    expect(scoreMonday(events).level).toBe(DIM);
  });

  test('resuming stops the drain, and the climb starts from where it drained to', () => {
    const events = workdayWith(
      createEvent('STOPPED', '13:00', { from: 'RUNNING' }), // Glow, down to Glimmer
      createEvent('RESUMED', '13:20'),                      // Lost one more at 13:15
    );

    expect(scoreMonday(events).level).toBe(GLIMMER); // Dim, plus 3h40m unbroken
  });

  test('stopping from a break screen counts like any stop', () => {
    const events = workdayWith(
      createEvent('OVERDUE_STARTED', '15:00', { cause: 'COUNTDOWN_ENDED' }),
      createEvent('STOPPED', '15:00', { from: 'OVERDUE' }),
      createEvent('RESUMED', '15:00'),
    );

    expect(scoreMonday(events, onMonday('15:01')).level).toBe(GLOW);
  });

  test('a stop carried over from before work hours costs nothing', () => {
    const events = workdayWith(
      createEvent('STOPPED', '08:45', { source: 'WINDOW' }),
      createEvent('RESUMED', '09:00', { source: 'SCHEDULE' }), // The workday's auto start
    );

    expect(scoreMonday(events).level).toBe(RADIANT);
  });

  test('the workday\'s own auto stop at the end costs nothing', () => {
    const events = workdayWith(createEvent('STOPPED', '17:00', { source: 'SCHEDULE' }));

    expect(scoreMonday(events).level).toBe(RADIANT);
  });

  test('leaving early is a stop that keeps draining until the workday ends', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('APP_QUIT', '16:30')]; // Shine

    expect(scoreMonday(events).level).toBe(DIM); // Glow at 16:30, then two drains by 17:00
  });
});

describe('Starting late', () => {
  test('starting within 30 minutes still counts as on time', () => {
    const events = [createEvent('APP_STARTED', '09:30'), createEvent('APP_QUIT', '17:30')];

    expect(scoreMonday(events).level).toBe(RADIANT);
  });

  test('starting later climbs from when you started', () => {
    const events = [createEvent('APP_STARTED', '09:45'), createEvent('APP_QUIT', '17:30')];

    expect(scoreMonday(events).level).toBe(SHINE); // 7h15m unbroken
  });

  test('after a stop, the late start grace no longer applies', () => {
    const events = [
      createEvent('APP_STARTED', '09:00'),
      createEvent('STOPPED', '09:05', { from: 'RUNNING' }),
      createEvent('RESUMED', '09:10'),
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).level).toBe(SHINE); // 7h50m from 9:10, not the whole day from 9:00
  });
});

describe('The app closing', () => {
  test('reopening within 5 minutes is a restart and keeps the run going', () => {
    const events = workdayWith(createEvent('APP_QUIT', '12:00'), createEvent('APP_STARTED', '12:05'));

    expect(scoreMonday(events).level).toBe(RADIANT);
  });

  test('closed longer counts as a stop from when it closed', () => {
    const events = workdayWith(createEvent('APP_QUIT', '13:00'), createEvent('APP_STARTED', '13:40'));

    // Glow, down to Glimmer at 13:00, drained to Dim by 13:15, then 3h20m unbroken
    expect(scoreMonday(events).level).toBe(GLIMMER);
  });

  test('a crash is placed at the last heartbeat, with the same grace as a restart', () => {
    const quickRecovery = workdayWith(createEvent('HEARTBEAT', '12:00'), createEvent('APP_STARTED', '12:04'));
    const slowRecovery = workdayWith(createEvent('HEARTBEAT', '12:00'), createEvent('APP_STARTED', '12:06'));

    expect(scoreMonday(quickRecovery).level).toBe(RADIANT);
    expect(scoreMonday(slowRecovery).level).toBe(GLOW); // Glimmer, down to Dim at the crash, then 4h54m unbroken
  });

  test('closed overnight before a late start is not a stop', () => {
    const events = [
      { ...createEvent('APP_QUIT', '17:30'), at: at('2026-10-25 17:30') },
      createEvent('APP_STARTED', '09:20'),
      createEvent('APP_QUIT', '17:30'),
    ];

    expect(scoreMonday(events).level).toBe(RADIANT);
  });
});

describe('Today, while the workday is still going', () => {
  test('shows when the run reaches the next checkpoint', () => {
    const score = scoreMonday([createEvent('APP_STARTED', '08:30')], onMonday('10:30'));

    expect(score.inProgress).toBe(true);
    expect(score.climbing).toBe(true);
    expect(score.nextCheckpointAt).toBe(onMonday('11:00'));
    expect(score.bestPossible).toBe(RADIANT);
  });

  test('has no next checkpoint when the workday ends first', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('STOPPED', '16:00'), createEvent('RESUMED', '16:00')];
    const score = scoreMonday(events, onMonday('16:30'));

    expect(score.nextCheckpointAt).toBeNull();
    expect(score.bestPossible).toBe(GLOW);
  });

  test('while stopped, shows it is losing checkpoints and when the next one goes', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('STOPPED', '15:00')];
    const score = scoreMonday(events, onMonday('15:20'));

    expect(score.losing).toBe(true);
    expect(score.climbing).toBe(false);
    expect(score.level).toBe(GLIMMER);
    expect(score.nextLossAt).toBe(onMonday('15:30'));
  });

  test('once at Dim there is nothing left to lose, but it still shows as losing', () => {
    const events = [createEvent('APP_STARTED', '08:30'), createEvent('STOPPED', '10:00')];
    const score = scoreMonday(events, onMonday('10:30'));

    expect(score.level).toBe(DIM);
    expect(score.nextLossAt).toBeNull();
    expect(score.losing).toBe(true);
  });

  test('before work hours nothing is scored yet', () => {
    const score = scoreMonday([createEvent('APP_STARTED', '08:00')], onMonday('08:30'));

    expect(score.level).toBe(DIM);
    expect(score.pieces).toEqual([]);
    expect(score.bestPossible).toBe(RADIANT);
  });

  test('getTodayScore returns the score for the current local date', () => {
    const events = [createEvent('APP_STARTED', '08:30')];

    expect(getTodayScore(events, onMonday('12:00'))?.localDate).toBe(monday);
    expect(getTodayScore([], onMonday('12:00'))).toBeNull();
  });
});

describe('Day details', () => {
  test('the day bar is the workday split by what the app was doing', () => {
    const events = workdayWith(
      createEvent('LUNCH_STARTED', '12:00'),
      createEvent('LUNCH_ENDED', '12:45'),
      createEvent('STOPPED', '15:00'),
      createEvent('APP_QUIT', '15:30'),
    );

    expect(scoreMonday(events).pieces).toEqual([
      { start: onMonday('09:00'), end: onMonday('12:00'), activity: 'WORKING' },
      { start: onMonday('12:00'), end: onMonday('12:45'), activity: 'LUNCH' },
      { start: onMonday('12:45'), end: onMonday('15:00'), activity: 'WORKING' },
      { start: onMonday('15:00'), end: onMonday('15:30'), activity: 'STOPPED' },
      { start: onMonday('15:30'), end: onMonday('17:00'), activity: 'CLOSED' },
    ]);
  });

  test('counts the power-ups used and whether lunch was taken', () => {
    const events = workdayWith(
      createEvent('SNOOZED', '10:00'),
      createEvent('BREAK_SKIPPED', '11:00'),
      createEvent('LUNCH_STARTED', '12:00'),
    );

    expect(scoreMonday(events).powerupsUsed).toBe(2);
    expect(scoreMonday(events).lunchTaken).toBe(true);
  });

  test('days off are left out', () => {
    const saturday = [{ ...createEvent('APP_STARTED', '10:00'), at: at('2026-10-31 10:00') }];

    expect(getDayScores(saturday, at('2026-10-31 18:00'))).toEqual({});
  });
});

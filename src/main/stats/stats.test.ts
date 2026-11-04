import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULTS, FILENAMES } from '../../shared/constants';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined })),
  writeToUserDataFile: vi.fn(),
  appendToUserDataFile: vi.fn(),
  readUserDataTextFile: vi.fn(() => ''),
}));

vi.mock('../limit/limitState', () => ({
  calculateRemainingPowerups: vi.fn(() => 2),
  increasePowerupsUsed: vi.fn(),
  calculateRemainingLunches: vi.fn(() => 1),
  increaseLunchesUsed: vi.fn(),
}));

vi.mock('../difficulty/difficulty', () => ({
  getAllottedPowerups: vi.fn(() => 3),
  getBreakDurationMs: vi.fn(() => DEFAULTS.DEFAULT_BREAK_DURATION_MS),
  getSnoozeDurationMs: vi.fn(() => DEFAULTS.DEFAULT_SNOOZE_DURATION_MS),
  getLunchDurationMs: vi.fn(() => DEFAULTS.DEFAULT_LUNCH_DURATION_MS),
  getCheckpointDecayMs: vi.fn(() => DEFAULTS.DEFAULT_CHECKPOINT_DECAY_MS),
}));

vi.mock('../difficulty/difficultyConfigs', () => ({
  getAppliedDifficultyConfigs: vi.fn(() => ({ level: 'NORMAL' })),
}));

vi.mock('../workday/workdayConfigs', () => ({
  getAppliedWorkdayConfigs: vi.fn(() => ({ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false })),
  applyWorkdayConfigsOnNewDay: vi.fn(),
}));

vi.mock('../overdue/overdueConfigs', () => ({
  getAppliedOverdueConfigs: vi.fn(() => ({ levelThresholdMs: 180000, windowLevelCap: 5, windowRatioCap: 0.9 })),
}));

vi.mock('../timer/timerConfigs', () => ({
  getAppliedTimerConfigs: vi.fn(() => ({
    timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
    warningThresholdMs: 5000,
  })),
}));

import { destroyStats, getCurrentDayScore, getEvents, initStats, parseEvents, recordAppQuit, StatsEvent, takeUnseenSummaryDate } from './stats';
import { initTimer, destroyTimers, stopTimer, startTimer, forwardToBreak, startBreak, skipBreak, snoozeTimer, startLunch, timerEmitter, StoredTimerState } from '../timer/timerState';
import { appendToUserDataFile, getUserDataFromFile, readUserDataTextFile, writeToUserDataFile } from '../../shared/utils/files';
import { applyWorkdayConfigsOnNewDay, getAppliedWorkdayConfigs } from '../workday/workdayConfigs';

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(appendToUserDataFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: undefined, filePath: '' });
});

afterEach(() => {
  destroyStats();
  destroyTimers();
  timerEmitter.removeAllListeners();
  vi.useRealTimers();
});

// Helper: seed timer state before initTimer
const seedTimerState = (state: Partial<StoredTimerState>) => {
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: state, filePath: '' });
};

// Helper: parse every line appended to the events file
const getRecordedEvents = (): StatsEvent[] => {
  return vi.mocked(appendToUserDataFile).mock.calls.map(([, line]) => JSON.parse(line));
};

describe('Event format', () => {
  test('each event is one JSON line in the events file', () => {
    initStats();
    initTimer();

    const [fileName, line] = vi.mocked(appendToUserDataFile).mock.lastCall!;
    expect(fileName).toBe(FILENAMES.STATS.EVENTS);
    expect(line.endsWith('\n')).toBe(true);
    expect(line.trim()).not.toContain('\n');
  });

  test('in UTC the offset is 0, not -0, so the event in memory matches the one read back from the file', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      initStats();
      initTimer();

      expect(Object.is(getEvents()[0].tzOffsetMin, 0)).toBe(true);
    } finally {
      process.env.TZ = originalTz;
    }
  });

  test('each event carries its own time, timezone and applied configs', () => {
    vi.setSystemTime(new Date('2026-10-24T13:00:00Z'));

    initStats();
    initTimer();

    const [event] = getRecordedEvents();
    expect(event).toEqual({
      v: 1,
      id: expect.any(String),
      at: Date.parse('2026-10-24T13:00:00Z'),
      tzOffsetMin: 0 - new Date().getTimezoneOffset(),
      config: {
        timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
        breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
        warningThresholdMs: 5000,
        snoozeDurationMs: DEFAULTS.DEFAULT_SNOOZE_DURATION_MS,
        allottedPowerups: 3,
        lunchDurationMs: DEFAULTS.DEFAULT_LUNCH_DURATION_MS,
        checkpointDecayMs: DEFAULTS.DEFAULT_CHECKPOINT_DECAY_MS,
        difficulty: 'NORMAL',
        levelThresholdMs: 180000,
        workday: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false },
      },
      type: 'APP_STARTED',
      previousStatus: null,
    });
  });

  test('each event gets a unique id', () => {
    initStats();
    initTimer();
    stopTimer("WINDOW");

    const [first, second] = getRecordedEvents();
    expect(first.id).not.toBe(second.id);
  });
});

describe('Crashes', () => {
  // Helper: a line in the events file from an earlier run
  const logLine = (type: string, at: number) => JSON.stringify({ type, at, tzOffsetMin: 0 }) + '\n';

  test('a log that does not end with a quit gets a crash at the last moment the app was alive, before the new start', () => {
    vi.mocked(readUserDataTextFile).mockReturnValueOnce(logLine('APP_STARTED', 1000));
    vi.mocked(getUserDataFromFile).mockImplementation((fileName) => ({
      fileContent: fileName === FILENAMES.STATS.STATE ? { lastAliveAt: 61000 } : undefined,
      filePath: '',
    }));

    initStats();
    initTimer();

    expect(getRecordedEvents().map((e) => [e.type, e.at])).toEqual([['APP_CRASHED', 61000], ['APP_STARTED', Date.now()]]);
  });

  test('a clean quit is not a crash', () => {
    vi.mocked(readUserDataTextFile).mockReturnValueOnce(logLine('APP_STARTED', 1000) + logLine('APP_QUIT', 2000));
    vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: { lastAliveAt: 1500 }, filePath: '' });

    initStats();

    expect(getRecordedEvents()).toEqual([]);
  });

  test('an empty log is not a crash', () => {
    initStats();

    expect(getRecordedEvents()).toEqual([]);
  });
});

describe('Staying alive', () => {
  test('saves when the app was last alive every minute, keeping the end-of-day card date', () => {
    vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: { lastSummaryDate: '2026-10-26' }, filePath: '' });
    vi.mocked(writeToUserDataFile).mockClear();
    const start = Date.now();

    initStats();
    vi.advanceTimersByTime(2 * 60 * 1000);

    expect(vi.mocked(writeToUserDataFile).mock.calls).toEqual([
      [FILENAMES.STATS.STATE, { lastSummaryDate: '2026-10-26', lastAliveAt: start + 60 * 1000 }],
      [FILENAMES.STATS.STATE, { lastSummaryDate: '2026-10-26', lastAliveAt: start + 2 * 60 * 1000 }],
    ]);
  });
});

describe('A new day', () => {
  test('starts with one event when the date changes', () => {
    vi.setSystemTime(new Date(2026, 9, 26, 23, 58, 30)); // Local time

    initStats();
    vi.advanceTimersByTime(3 * 60 * 1000);

    expect(getRecordedEvents().map((e) => [e.type, e.at])).toEqual([['DAY_STARTED', new Date(2026, 9, 27, 0, 0, 30).getTime()]]);
  });

  test('applies the saved workday before the event snapshots it', () => {
    const newHours = { days: [1], start: '10:00', end: '18:00', autoStopAtEnd: false };
    vi.setSystemTime(new Date(2026, 9, 26, 23, 59, 30)); // Local time
    initStats();
    initTimer();

    vi.mocked(applyWorkdayConfigsOnNewDay).mockImplementationOnce(() => {
      vi.mocked(getAppliedWorkdayConfigs).mockReturnValueOnce(newHours);
    });
    vi.advanceTimersByTime(60 * 1000);

    expect(getRecordedEvents().find((e) => e.type === 'DAY_STARTED')?.config.workday).toEqual(newHours);
  });
});

describe("Today's score", () => {
  // Monday, October 26, 2026 is a workday, local time
  const monday = (hours: number, minutes: number, seconds = 0) => new Date(2026, 9, 26, hours, minutes, seconds);

  test('is scored once while nothing changes, with the last piece of the day bar still growing', () => {
    vi.setSystemTime(monday(10, 0));
    initStats();
    initTimer();
    vi.advanceTimersByTime(1000);

    const first = getCurrentDayScore();
    vi.advanceTimersByTime(1000);
    const second = getCurrentDayScore();

    expect(second).toBe(first);
    expect(second!.pieces.at(-1)!.end).toBe(Date.now());
  });

  test('is scored again after a new event', () => {
    vi.setSystemTime(monday(10, 0));
    initStats();
    initTimer();
    vi.advanceTimersByTime(1000);

    const climbing = getCurrentDayScore();
    stopTimer("WINDOW");

    expect(getCurrentDayScore()).not.toBe(climbing);
  });

  test('is scored again the second after an event, once its piece of the day bar shows', () => {
    vi.setSystemTime(monday(10, 0));
    initStats();
    initTimer();

    expect(getCurrentDayScore()!.pieces).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(getCurrentDayScore()!.pieces).toHaveLength(1);
  });

  test('is scored again when it changes on its own, like the workday starting', () => {
    vi.setSystemTime(monday(8, 59, 58));
    initStats();
    initTimer();
    vi.advanceTimersByTime(1000);

    const beforeWork = getCurrentDayScore();
    vi.advanceTimersByTime(1000);

    expect(getCurrentDayScore()).not.toBe(beforeWork);
  });

  test('is scored again at midnight, even before the new day has an event', () => {
    vi.setSystemTime(monday(23, 59, 58));
    initStats();
    initTimer();
    vi.advanceTimersByTime(1000);

    expect(getCurrentDayScore()?.localDate).toBe('2026-10-26');
    vi.advanceTimersByTime(1000);
    expect(getCurrentDayScore()).toBeNull();
  });
});

describe('Events in memory', () => {
  test('ends a line cut off by a crash, so the next event starts on its own line', () => {
    vi.mocked(readUserDataTextFile).mockReturnValueOnce('{"type":"APP_QUIT"}\n{"type":"HEART');

    initStats();

    expect(appendToUserDataFile).toHaveBeenCalledExactlyOnceWith(FILENAMES.STATS.EVENTS, '\n');
    expect(getEvents().map((e) => e.type)).toEqual(['APP_QUIT']);
  });

  test('leaves a complete log as it is', () => {
    vi.mocked(readUserDataTextFile).mockReturnValueOnce('{"type":"APP_QUIT"}\n');

    initStats();

    expect(appendToUserDataFile).not.toHaveBeenCalled();
  });

  test('starts with the events already in the file and adds new ones', () => {
    vi.mocked(readUserDataTextFile).mockReturnValueOnce('{"type":"APP_QUIT"}\n');

    initStats();
    initTimer();

    expect(getEvents().map((e) => e.type)).toEqual(['APP_QUIT', 'APP_STARTED']);
  });
});

describe('App start and quit', () => {
  test('APP_STARTED records the status the app was last in', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'BREAK', _bypassThreshold: true });

    initStats();
    initTimer();

    expect(getRecordedEvents()[0]).toMatchObject({ type: 'APP_STARTED', previousStatus: 'BREAK' });
  });

  test('APP_STARTED is the only event on launch, even when resuming from STOPPED', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'STOPPED', _bypassThreshold: true });

    initStats();
    initTimer();

    expect(getRecordedEvents().map((e) => e.type)).toEqual(['APP_STARTED']);
  });

  test('APP_QUIT records where the timer was', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    vi.advanceTimersByTime(3000);
    recordAppQuit();

    expect(getRecordedEvents().at(-1)).toMatchObject({ type: 'APP_QUIT', status: 'OVERDUE', countdownMs: 0, overdueMs: 3000 });
  });
});

describe('Timer transitions', () => {
  test('stop and resume record the source and remaining countdown', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    vi.advanceTimersByTime(5000);
    stopTimer("TRAY");
    startTimer("WINDOW");

    const [, stopped, resumed] = getRecordedEvents();
    expect(stopped).toMatchObject({ type: 'STOPPED', source: 'TRAY', from: 'RUNNING', countdownMs: 95000 });
    expect(resumed).toMatchObject({ type: 'RESUMED', source: 'WINDOW', countdownMs: 95000 });
  });

  test('countdown ending and break finishing are recorded without a source', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    startBreak("WINDOW");
    vi.advanceTimersByTime(DEFAULTS.DEFAULT_BREAK_DURATION_MS);

    const [, overdue, , completed] = getRecordedEvents();
    expect(overdue).toEqual(expect.objectContaining({ type: 'OVERDUE_STARTED', cause: 'COUNTDOWN_ENDED' }));
    expect(overdue).not.toHaveProperty('source');
    expect(completed).toMatchObject({ type: 'BREAK_COMPLETED' });
  });

  test('forwarding to the break records how much countdown was left', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    forwardToBreak("WINDOW");

    expect(getRecordedEvents()[1]).toMatchObject({ type: 'OVERDUE_STARTED', cause: 'FORWARDED', source: 'WINDOW', countdownMs: 100000 });
  });

  test('starting a break records how long it was overdue', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    vi.advanceTimersByTime(4000);
    startBreak("TRAY");

    expect(getRecordedEvents().at(-1)).toMatchObject({ type: 'BREAK_STARTED', source: 'TRAY', overdueMs: 4000 });
  });

  test('skipping a break midway records how much of it was taken', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    startBreak("WINDOW");
    vi.advanceTimersByTime(5000);
    skipBreak("WINDOW");

    expect(getRecordedEvents().at(-1)).toMatchObject({
      type: 'BREAK_SKIPPED', source: 'WINDOW', from: 'BREAK', overdueMs: 0, breakElapsedMs: 5000, powerupsLeft: 2,
    });
  });

  test('skipping a break from overdue records the overdue time and no break taken', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    vi.advanceTimersByTime(3000);
    skipBreak("TRAY");

    expect(getRecordedEvents().at(-1)).toMatchObject({
      type: 'BREAK_SKIPPED', source: 'TRAY', from: 'OVERDUE', overdueMs: 3000, breakElapsedMs: 0, powerupsLeft: 2,
    });
  });

  test('snoozing records how long and how much countdown was left', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    snoozeTimer("TRAY");

    expect(getRecordedEvents().at(-1)).toMatchObject({
      type: 'SNOOZED', source: 'TRAY', snoozeMs: DEFAULTS.DEFAULT_SNOOZE_DURATION_MS, countdownMs: 100000, powerupsLeft: 2,
    });
  });

  test('actions the current status blocks record nothing', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    startBreak("WINDOW"); // Not overdue yet
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    forwardToBreak("TRAY");
    snoozeTimer("TRAY");
    startTimer("TRAY");

    expect(getRecordedEvents().map((e) => e.type)).toEqual(['APP_STARTED', 'OVERDUE_STARTED']);
  });

  test('lunch records where it was taken from and how long, then how it ended', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    vi.setSystemTime(new Date(2026, 9, 26, 12, 0)); // Local noon, so lunch doesn't run into a new day

    initStats();
    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    startLunch("TRAY");
    vi.advanceTimersByTime(DEFAULTS.DEFAULT_LUNCH_DURATION_MS);

    const [, , lunchStarted, lunchEnded] = getRecordedEvents();
    expect(lunchStarted).toMatchObject({ type: 'LUNCH_STARTED', source: 'TRAY', from: 'OVERDUE', lunchMs: DEFAULTS.DEFAULT_LUNCH_DURATION_MS });
    expect(lunchEnded).toMatchObject({ type: 'LUNCH_ENDED', cause: 'TIME_UP' });
  });
});

describe('Reading events', () => {
  test('each line becomes one event', () => {
    const text = '{"type":"APP_STARTED"}\n{"type":"APP_QUIT"}\n';

    expect(parseEvents(text).map((e) => e.type)).toEqual(['APP_STARTED', 'APP_QUIT']);
  });

  test('a damaged line is skipped and the rest are kept', () => {
    const text = '{"type":"APP_STARTED"}\n{"type":"STOPP\n{"type":"APP_QUIT"}\n';

    expect(parseEvents(text).map((e) => e.type)).toEqual(['APP_STARTED', 'APP_QUIT']);
  });

  test('an empty or missing file has no events', () => {
    expect(parseEvents('')).toEqual([]);
  });
});

describe('End-of-day card', () => {
  // A finished clean Monday, as lines in the events file
  const cleanMondayLog = [
    { type: 'APP_STARTED', at: Date.parse('2026-10-26T08:30:00-04:00') },
    { type: 'APP_QUIT', at: Date.parse('2026-10-26T17:30:00-04:00') },
  ].map((event) => JSON.stringify({
    ...event,
    tzOffsetMin: -240,
    config: { workday: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } },
  })).join('\n');

  test('a workday the app was never open for has no card', () => {
    const eveningOnlyLog = JSON.stringify({
      type: 'APP_STARTED',
      at: Date.parse('2026-10-26T19:00:00-04:00'),
      tzOffsetMin: -240,
      config: { workday: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } },
    });
    vi.setSystemTime(new Date('2026-10-27T08:00:00-04:00'));
    vi.mocked(readUserDataTextFile).mockReturnValueOnce(eveningOnlyLog);
    initStats();

    expect(takeUnseenSummaryDate()).toBeNull();
  });

  test('returns the latest finished workday once, then nothing', () => {
    vi.setSystemTime(new Date('2026-10-27T08:00:00-04:00'));
    vi.mocked(readUserDataTextFile).mockReturnValueOnce(cleanMondayLog);
    vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: { lastAliveAt: 1000 }, filePath: '' });
    initStats();

    expect(takeUnseenSummaryDate()).toBe('2026-10-26');
    expect(writeToUserDataFile).toHaveBeenLastCalledWith(FILENAMES.STATS.STATE, { lastAliveAt: 1000, lastSummaryDate: '2026-10-26' });
    expect(takeUnseenSummaryDate()).toBeNull();
  });
});

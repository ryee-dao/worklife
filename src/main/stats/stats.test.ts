import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULTS, FILENAMES } from '../../shared/constants';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined })),
  writeToUserDataFile: vi.fn(),
  appendToUserDataFile: vi.fn(),
}));

vi.mock('../limit/limitState', () => ({
  calculateRemainingBreakSkips: vi.fn(() => 2),
  increaseSkippedBreakCount: vi.fn(),
}));

vi.mock('../difficulty/difficulty', () => ({
  getAllottedBreaks: vi.fn(() => 3),
  getBreakDurationMs: vi.fn(() => DEFAULTS.DEFAULT_BREAK_DURATION_MS),
}));

vi.mock('../difficulty/difficultyConfigs', () => ({
  getAppliedDifficultyConfigs: vi.fn(() => ({ level: 'NORMAL' })),
}));

vi.mock('../workday/workdayConfigs', () => ({
  getAppliedWorkdayConfigs: vi.fn(() => ({ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoPauseAtEnd: false })),
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

import { initStats, recordAppQuit, StatsEvent } from './stats';
import { initTimer, destroyTimers, pauseTimer, startTimer, skipTimer, startBreak, skipBreak, timerEmitter, StoredTimerState } from '../timer/timerState';
import { appendToUserDataFile, getUserDataFromFile } from '../../shared/utils/files';

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(appendToUserDataFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: undefined, filePath: '' });
});

afterEach(() => {
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

  test('each event carries its own time, timezone and applied configs', () => {
    vi.setSystemTime(new Date('2026-10-24T13:00:00Z'));

    initStats();
    initTimer();

    const [event] = getRecordedEvents();
    expect(event).toEqual({
      v: 1,
      id: expect.any(String),
      at: Date.parse('2026-10-24T13:00:00Z'),
      tzOffsetMin: -new Date().getTimezoneOffset(),
      config: {
        timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
        breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
        warningThresholdMs: 5000,
        allottedBreaks: 3,
        difficulty: 'NORMAL',
        levelThresholdMs: 180000,
        workday: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoPauseAtEnd: false },
      },
      type: 'APP_STARTED',
      previousStatus: null,
    });
  });

  test('each event gets a unique id', () => {
    initStats();
    initTimer();
    pauseTimer("WINDOW");

    const [first, second] = getRecordedEvents();
    expect(first.id).not.toBe(second.id);
  });
});

describe('App start and quit', () => {
  test('APP_STARTED records the status the app was last in', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'BREAK', _bypassThreshold: true });

    initStats();
    initTimer();

    expect(getRecordedEvents()[0]).toMatchObject({ type: 'APP_STARTED', previousStatus: 'BREAK' });
  });

  test('APP_STARTED is the only event on launch, even when resuming from PAUSED', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'PAUSED', _bypassThreshold: true });

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
  test('pause and resume record the source and remaining countdown', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    vi.advanceTimersByTime(5000);
    pauseTimer("TRAY");
    startTimer("WINDOW");

    const [, paused, resumed] = getRecordedEvents();
    expect(paused).toMatchObject({ type: 'PAUSED', source: 'TRAY', countdownMs: 95000 });
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

  test('skipping the timer records how much countdown was left', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    skipTimer("WINDOW");

    expect(getRecordedEvents()[1]).toMatchObject({ type: 'OVERDUE_STARTED', cause: 'TIMER_SKIPPED', source: 'WINDOW', countdownMs: 100000 });
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
      type: 'BREAK_SKIPPED', source: 'WINDOW', from: 'BREAK', overdueMs: 0, breakElapsedMs: 5000, skipsLeft: 2,
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
      type: 'BREAK_SKIPPED', source: 'TRAY', from: 'OVERDUE', overdueMs: 3000, breakElapsedMs: 0, skipsLeft: 2,
    });
  });

  test('actions the current status blocks record nothing', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    initStats();
    initTimer();
    startBreak("WINDOW"); // Not overdue yet
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    pauseTimer("TRAY");
    skipTimer("TRAY");

    expect(getRecordedEvents().map((e) => e.type)).toEqual(['APP_STARTED', 'OVERDUE_STARTED']);
  });
});

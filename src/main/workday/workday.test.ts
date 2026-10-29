import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { FILENAMES } from '../../shared/constants';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined, filePath: '' })),
  writeToUserDataFile: vi.fn(),
}));

vi.mock('../timer/timerState', () => ({
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
}));

import { destroyWorkday, initWorkday, isInWorkday } from './workday';
import { applyWorkdayConfigs, getAppliedWorkdayConfigs, loadWorkdayConfigs, setWorkdayConfigs, WorkdayConfigs } from './workdayConfigs';
import { stopTimer, startTimer } from '../timer/timerState';
import { getUserDataFromFile } from '../../shared/utils/files';

const defaultWorkday: WorkdayConfigs = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false };
const oneMinuteMs = 60 * 1000;

// Helper: a local time on Monday, October 26, 2026
const monday = (hours: number, minutes: number) => new Date(2026, 9, 26, hours, minutes);

// Helper: run with these workday configs from the start of the day
const useWorkday = (configs: WorkdayConfigs) => {
  setWorkdayConfigs(configs);
  applyWorkdayConfigs();
};

// Helper: seed the files loadWorkdayConfigs reads
const seedWorkdayFiles = (files: Record<string, object>) => {
  vi.mocked(getUserDataFromFile).mockImplementation((fileName: string) => ({ fileContent: files[fileName], filePath: '' }));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getUserDataFromFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: undefined, filePath: '' });
  vi.mocked(startTimer).mockReset();
  vi.mocked(stopTimer).mockReset();
  vi.setSystemTime(monday(0, 0)); // Load on the same day the tests run, so the configs aren't from another day
  loadWorkdayConfigs();
});

afterEach(() => {
  destroyWorkday();
  vi.useRealTimers();
});

describe('Is it work time', () => {
  test('inside the hours on a workday', () => {
    expect(isInWorkday(monday(9, 0), defaultWorkday)).toBe(true);
    expect(isInWorkday(monday(16, 59), defaultWorkday)).toBe(true);
  });

  test('outside the hours on a workday', () => {
    expect(isInWorkday(monday(8, 59), defaultWorkday)).toBe(false);
    expect(isInWorkday(monday(17, 0), defaultWorkday)).toBe(false); // The end time is not work time
  });

  test('on a day off', () => {
    const sunday = new Date(2026, 9, 25, 12, 0);

    expect(isInWorkday(sunday, defaultWorkday)).toBe(false);
  });
});

describe('Auto start', () => {
  test('starts the timer when the workday begins', () => {
    vi.setSystemTime(monday(8, 59));

    initWorkday();
    vi.advanceTimersByTime(oneMinuteMs); // 9:00

    expect(startTimer).toHaveBeenCalledExactlyOnceWith('SCHEDULE');
  });

  test('does not undo a stop in the middle of the workday', () => {
    vi.setSystemTime(monday(10, 0));

    initWorkday();
    vi.advanceTimersByTime(5 * oneMinuteMs);

    expect(startTimer).not.toHaveBeenCalled();
  });
});

describe('Auto stop', () => {
  test('stops when the workday ends if turned on', () => {
    useWorkday({ ...defaultWorkday, autoStopAtEnd: true });
    vi.setSystemTime(monday(16, 59));

    initWorkday();
    vi.advanceTimersByTime(oneMinuteMs); // 17:00

    expect(stopTimer).toHaveBeenCalledExactlyOnceWith('SCHEDULE');
  });

  test('keeps running when the workday ends if turned off', () => {
    vi.setSystemTime(monday(16, 59));

    initWorkday();
    vi.advanceTimersByTime(oneMinuteMs);

    expect(stopTimer).not.toHaveBeenCalled();
  });
});

describe('End of the workday', () => {
  test('lets the app know when the workday ends', () => {
    const onWorkdayEnd = vi.fn();
    vi.setSystemTime(monday(16, 58));

    initWorkday(onWorkdayEnd);
    vi.advanceTimersByTime(oneMinuteMs); // 16:59
    expect(onWorkdayEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(oneMinuteMs); // 17:00
    expect(onWorkdayEnd).toHaveBeenCalledOnce();
  });
});

describe('Changing the workday', () => {
  test('saved changes only apply from the next day', () => {
    const newWorkday = { ...defaultWorkday, start: '08:00' };
    vi.setSystemTime(monday(23, 58));

    initWorkday();
    setWorkdayConfigs(newWorkday);
    vi.advanceTimersByTime(oneMinuteMs); // 23:59, still Monday
    expect(getAppliedWorkdayConfigs()).toEqual(defaultWorkday);

    vi.advanceTimersByTime(oneMinuteMs); // 00:00 Tuesday
    expect(getAppliedWorkdayConfigs()).toEqual(newWorkday);
  });

  test('restarting the app keeps today\'s hours', () => {
    const newWorkday = { ...defaultWorkday, start: '08:00' };
    vi.setSystemTime(monday(10, 0));
    seedWorkdayFiles({
      [FILENAMES.WORKDAY.CONFIGS]: newWorkday,
      [FILENAMES.WORKDAY.STATE]: { appliedDate: '2026-10-26', appliedConfigs: defaultWorkday },
    });

    loadWorkdayConfigs();

    expect(getAppliedWorkdayConfigs()).toEqual(defaultWorkday);
  });

  test('restarting the app on a new day applies the saved hours', () => {
    const newWorkday = { ...defaultWorkday, start: '08:00' };
    vi.setSystemTime(monday(10, 0));
    seedWorkdayFiles({
      [FILENAMES.WORKDAY.CONFIGS]: newWorkday,
      [FILENAMES.WORKDAY.STATE]: { appliedDate: '2026-10-25', appliedConfigs: defaultWorkday },
    });

    loadWorkdayConfigs();

    expect(getAppliedWorkdayConfigs()).toEqual(newWorkday);
  });
});

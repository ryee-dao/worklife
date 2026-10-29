import { describe, test, expect, vi, beforeEach } from 'vitest';
import { DEFAULTS } from '../../shared/constants';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined, filePath: '' })),
  writeToUserDataFile: vi.fn(),
}));

vi.mock('../timer/timerConfigs', () => ({
  getAppliedTimerConfigs: vi.fn(),
}));

vi.mock('../workday/workdayConfigs', () => ({
  getAppliedWorkdayConfigs: vi.fn(() => ({ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false })),
}));

import { getAllottedPowerups, getBreakDurationMs, getCheckpointDecayMs, getLunchDurationMs, getSnoozeDurationMs } from './difficulty';
import { getAppliedWorkdayConfigs } from '../workday/workdayConfigs';
import { applyDifficultyConfigs, DifficultyConfigs, loadDifficultyConfigs, setDifficultyConfigs } from './difficultyConfigs';
import { getAppliedTimerConfigs } from '../timer/timerConfigs';
import { getUserDataFromFile } from '../../shared/utils/files';

const customConfigs: DifficultyConfigs['custom'] = {
  breakDurationMs: 40 * 1000,
  snoozeDurationMs: 8 * 60 * 1000,
  allottedPowerups: 4,
  lunchDurationMs: 20 * 60 * 1000,
  checkpointDecayMs: 12 * 60 * 1000,
};

// Helper: run with a difficulty level and timer length
const useDifficulty = (level: DifficultyConfigs['level'], timerDurationMinutes = 45) => {
  vi.mocked(getAppliedTimerConfigs).mockReturnValue({
    timerDurationMs: timerDurationMinutes * 60 * 1000,
    warningThresholdMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS,
  });
  setDifficultyConfigs({ level, custom: customConfigs });
  applyDifficultyConfigs();
};

beforeEach(() => {
  loadDifficultyConfigs();
});

describe('Preset difficulties', () => {
  test('defaults to normal', () => {
    vi.mocked(getAppliedTimerConfigs).mockReturnValue({
      timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
      warningThresholdMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS,
    });

    expect(getBreakDurationMs()).toBe(135 * 1000); // 5% of 45 minutes
    expect(getAllottedPowerups()).toBe(3);
  });

  test.each([
    { level: 'EASY', breakSeconds: 60, allottedPowerups: 5, lunchMinutes: 60 },   // 2% of 45 min = 54s, rounded to 60s
    { level: 'NORMAL', breakSeconds: 135, allottedPowerups: 3, lunchMinutes: 45 }, // 5% of 45 min = 135s
    { level: 'HARD', breakSeconds: 270, allottedPowerups: 1, lunchMinutes: 30 },   // 10% of 45 min = 270s
  ] as const)('$level with a 45 minute timer', ({ level, breakSeconds, allottedPowerups, lunchMinutes }) => {
    useDifficulty(level);

    expect(getBreakDurationMs()).toBe(breakSeconds * 1000);
    expect(getAllottedPowerups()).toBe(allottedPowerups);
    expect(getLunchDurationMs()).toBe(lunchMinutes * 60 * 1000);
  });

  test('lunch length ignores the timer', () => {
    useDifficulty('NORMAL', 90);

    expect(getLunchDurationMs()).toBe(45 * 60 * 1000);
  });

  test('break length scales with the timer', () => {
    useDifficulty('NORMAL', 60);

    expect(getBreakDurationMs()).toBe(180 * 1000); // 5% of 60 minutes
  });

  test('break length rounds to the nearest 15 seconds', () => {
    useDifficulty('NORMAL', 47); // 141s
    expect(getBreakDurationMs()).toBe(135 * 1000);

    useDifficulty('NORMAL', 49); // 147s
    expect(getBreakDurationMs()).toBe(150 * 1000);
  });

  test('break length never goes below 30 seconds', () => {
    useDifficulty('EASY', 10); // 12s

    expect(getBreakDurationMs()).toBe(30 * 1000);
  });
});

describe('Snooze', () => {
  test.each([
    { level: 'EASY', snoozeMinutes: 9 },   // 20% of 45 min = 9 min
    { level: 'NORMAL', snoozeMinutes: 7 }, // 15% of 45 min = 6.75 min, rounded to 7
    { level: 'HARD', snoozeMinutes: 5 },   // 10% of 45 min = 4.5 min, rounded to 5
  ] as const)('$level with a 45 minute timer', ({ level, snoozeMinutes }) => {
    useDifficulty(level);

    expect(getSnoozeDurationMs()).toBe(snoozeMinutes * 60 * 1000);
  });

  test('snooze length rounds to the nearest minute', () => {
    useDifficulty('NORMAL', 42); // 6.3 min
    expect(getSnoozeDurationMs()).toBe(6 * 60 * 1000);

    useDifficulty('NORMAL', 50); // 7.5 min
    expect(getSnoozeDurationMs()).toBe(8 * 60 * 1000);
  });

  test('snooze length never goes below 1 minute', () => {
    useDifficulty('HARD', 4); // 0.4 min

    expect(getSnoozeDurationMs()).toBe(60 * 1000);
  });
});

describe('Checkpoint drain', () => {
  test.each([
    { level: 'EASY', decayMinutes: 30 },   // 1/16 of an 8 hour workday
    { level: 'NORMAL', decayMinutes: 15 }, // 1/32
    { level: 'HARD', decayMinutes: 8 },    // 1/64 = 7.5 min, rounded to 8
  ] as const)('$level on a 9 to 5 workday', ({ level, decayMinutes }) => {
    useDifficulty(level);

    expect(getCheckpointDecayMs()).toBe(decayMinutes * 60 * 1000);
  });

  test('scales with the workday, not the timer', () => {
    vi.mocked(getAppliedWorkdayConfigs).mockReturnValueOnce({ days: [1], start: '09:00', end: '13:00', autoStopAtEnd: false });
    useDifficulty('NORMAL', 90);

    expect(getCheckpointDecayMs()).toBe(8 * 60 * 1000); // 1/32 of 4 hours = 7.5 min, rounded to 8
  });
});

describe('Custom difficulty', () => {
  test('uses the chosen lengths and power-ups as they are', () => {
    useDifficulty('CUSTOM');

    expect(getBreakDurationMs()).toBe(customConfigs.breakDurationMs);
    expect(getSnoozeDurationMs()).toBe(customConfigs.snoozeDurationMs);
    expect(getAllottedPowerups()).toBe(customConfigs.allottedPowerups);
    expect(getLunchDurationMs()).toBe(customConfigs.lunchDurationMs);
    expect(getCheckpointDecayMs()).toBe(customConfigs.checkpointDecayMs);
  });

  test('a custom difficulty saved before lunch existed gets the default lunch', () => {
    vi.mocked(getUserDataFromFile).mockReturnValueOnce({
      fileContent: { level: 'CUSTOM', custom: { breakDurationMs: 40 * 1000, allottedBreaks: 2 } },
      filePath: '',
    });
    loadDifficultyConfigs();

    expect(getBreakDurationMs()).toBe(40 * 1000);
    expect(getLunchDurationMs()).toBe(DEFAULTS.DEFAULT_LUNCH_DURATION_MS);
    expect(getAllottedPowerups()).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);
    expect(getCheckpointDecayMs()).toBe(DEFAULTS.DEFAULT_CHECKPOINT_DECAY_MS);
  });

  test('ignores the timer length', () => {
    useDifficulty('CUSTOM', 120);

    expect(getBreakDurationMs()).toBe(customConfigs.breakDurationMs);
  });
});

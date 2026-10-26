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

import { getAllottedBreaks, getBreakDurationMs } from './difficulty';
import { applyDifficultyConfigs, DifficultyConfigs, loadDifficultyConfigs, setDifficultyConfigs } from './difficultyConfigs';
import { getAppliedTimerConfigs } from '../timer/timerConfigs';

const customConfigs: DifficultyConfigs['custom'] = { breakDurationMs: 40 * 1000, allottedBreaks: 2 };

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
    expect(getAllottedBreaks()).toBe(3);
  });

  test.each([
    { level: 'EASY', breakSeconds: 60, allottedBreaks: 5 },   // 2% of 45 min = 54s, rounded to 60s
    { level: 'NORMAL', breakSeconds: 135, allottedBreaks: 3 }, // 5% of 45 min = 135s
    { level: 'HARD', breakSeconds: 270, allottedBreaks: 1 },   // 10% of 45 min = 270s
  ] as const)('$level with a 45 minute timer', ({ level, breakSeconds, allottedBreaks }) => {
    useDifficulty(level);

    expect(getBreakDurationMs()).toBe(breakSeconds * 1000);
    expect(getAllottedBreaks()).toBe(allottedBreaks);
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

describe('Custom difficulty', () => {
  test('uses the chosen break length and skips as they are', () => {
    useDifficulty('CUSTOM');

    expect(getBreakDurationMs()).toBe(customConfigs.breakDurationMs);
    expect(getAllottedBreaks()).toBe(customConfigs.allottedBreaks);
  });

  test('ignores the timer length', () => {
    useDifficulty('CUSTOM', 120);

    expect(getBreakDurationMs()).toBe(customConfigs.breakDurationMs);
  });
});

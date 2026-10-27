import { describe, test, expect, vi } from 'vitest';
import { applyTimerConfigs, getAppliedTimerConfigs, loadTimerConfigs, setTimerConfigs } from './timer/timerConfigs';
import { applyDifficultyConfigs, getAppliedDifficultyConfigs, loadDifficultyConfigs, setDifficultyConfigs, DifficultyConfigs } from './difficulty/difficultyConfigs';
import { applyWorkdayConfigs, getAppliedWorkdayConfigs, loadWorkdayConfigs, setWorkdayConfigs } from './workday/workdayConfigs';
import { applyOverdueConfigs, getAppliedOverdueConfigs, loadOverdueConfigs, setOverdueConfigs } from './overdue/overdueConfigs';

vi.mock('../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined, filePath: '' })),
  writeToUserDataFile: vi.fn(),
}));

describe('Saved configs only take effect once applied', () => {
  test('timer configs', () => {
    loadTimerConfigs();
    const configsBefore = getAppliedTimerConfigs();
    const newConfigs = { timerDurationMs: 10 * 60 * 1000, warningThresholdMs: 30 * 1000 };

    setTimerConfigs(newConfigs);
    expect(getAppliedTimerConfigs()).toEqual(configsBefore);

    applyTimerConfigs();
    expect(getAppliedTimerConfigs()).toEqual(newConfigs);
  });

  test('difficulty configs', () => {
    loadDifficultyConfigs();
    const configsBefore = getAppliedDifficultyConfigs();
    const newConfigs: DifficultyConfigs = { level: 'HARD', custom: { breakDurationMs: 60 * 1000, allottedBreaks: 1, snoozeDurationMs: 2 * 60 * 1000, allottedSnoozes: 1, partialThreshold: 0.6 } };

    setDifficultyConfigs(newConfigs);
    expect(getAppliedDifficultyConfigs()).toEqual(configsBefore);

    applyDifficultyConfigs();
    expect(getAppliedDifficultyConfigs()).toEqual(newConfigs);
  });

  test('overdue configs', () => {
    loadOverdueConfigs();
    const configsBefore = getAppliedOverdueConfigs();
    const newConfigs = { levelThresholdMs: 60 * 1000, windowLevelCap: 3, windowRatioCap: 0.5 };

    setOverdueConfigs(newConfigs);
    expect(getAppliedOverdueConfigs()).toEqual(configsBefore);

    applyOverdueConfigs();
    expect(getAppliedOverdueConfigs()).toEqual(newConfigs);
  });

  test('workday configs', () => {
    loadWorkdayConfigs();
    const configsBefore = getAppliedWorkdayConfigs();
    const newConfigs = { days: [0, 6], start: '10:00', end: '14:00', autoStopAtEnd: true };

    setWorkdayConfigs(newConfigs);
    expect(getAppliedWorkdayConfigs()).toEqual(configsBefore);

    applyWorkdayConfigs();
    expect(getAppliedWorkdayConfigs()).toEqual(newConfigs);
  });
});

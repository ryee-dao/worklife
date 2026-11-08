import { describe, test, expect, vi } from 'vitest';
import { getUserDataFromFile } from '@shared/utils/files';
import { getSoundConfigs, loadSoundConfigs } from './sound/soundConfigs';
import { applyTimerConfigs, getAppliedTimerConfigs, loadTimerConfigs, setTimerConfigs } from './timer/timerConfigs';
import { applyDifficultyConfigs, getAppliedDifficultyConfigs, loadDifficultyConfigs, setDifficultyConfigs, DifficultyConfigs } from './difficulty/difficultyConfigs';
import { applyWorkdayConfigs, getAppliedWorkdayConfigs, loadWorkdayConfigs, setWorkdayConfigs } from './workday/workdayConfigs';
import { applyOverdueConfigs, getAppliedOverdueConfigs, loadOverdueConfigs, setOverdueConfigs } from './overdue/overdueConfigs';

vi.mock('@shared/utils/files', () => ({
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
    const newConfigs: DifficultyConfigs = { level: 'HARD', custom: { breakDurationMs: 60 * 1000, snoozeDurationMs: 2 * 60 * 1000, allottedPowerups: 1, lunchDurationMs: 30 * 60 * 1000, checkpointDecayMs: 8 * 60 * 1000 } };

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

describe('A hand-edited config file', () => {
  const seed = (fileContent: object) => vi.mocked(getUserDataFromFile).mockReturnValueOnce({ fileContent, filePath: '' });

  test('falls back to the default for each field that is the wrong shape, and keeps the rest', () => {
    seed({ timerDurationMs: '45', warningThresholdMs: 60000 });
    loadTimerConfigs();
    expect(getAppliedTimerConfigs()).toEqual({ timerDurationMs: 45 * 60 * 1000, warningThresholdMs: 60000 });

    seed({ levelThresholdMs: 5000, windowLevelCap: 0, windowRatioCap: 0.5 }); // Zero levels would stall the overdue window
    loadOverdueConfigs();
    expect(getAppliedOverdueConfigs()).toEqual({ levelThresholdMs: 5000, windowLevelCap: 5, windowRatioCap: 0.5 });

    seed({ level: 'IMPOSSIBLE', custom: { breakDurationMs: 1000, allottedPowerups: 1.5 } });
    loadDifficultyConfigs();
    expect(getAppliedDifficultyConfigs()).toMatchObject({ level: 'NORMAL', custom: { breakDurationMs: 1000, allottedPowerups: 3 } });

    seed({ days: [], start: '17:00', end: '09:00', autoStopAtEnd: 'yes' });
    loadWorkdayConfigs();
    expect(getAppliedWorkdayConfigs()).toEqual({ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false });

    seed({ volume: 5 });
    loadSoundConfigs();
    expect(getSoundConfigs()).toEqual({ volume: 0.5 });
  });
});

import { describe, test, expect, vi } from 'vitest';
import { getUserDataFromFile, writeToUserDataFile } from '@shared/utils/files';
import { getSoundConfigs, loadSoundConfigs } from './sound/soundConfigs';
import { applyTimerConfigs, getAppliedTimerConfigs, loadTimerConfigs, setTimerConfigs } from './timer/timerConfigs';
import { applyDifficultyConfigs, getAppliedDifficultyConfigs, loadDifficultyConfigs, setDifficultyConfigs, DifficultyConfigs } from './difficulty/difficultyConfigs';
import { applyWorkdayConfigs, getAppliedWorkdayConfigs, loadWorkdayConfigs, setWorkdayConfigs } from './workday/workdayConfigs';
import { applyOverdueConfigs, getAppliedOverdueConfigs, loadOverdueConfigs, setOverdueConfigs } from './overdue/overdueConfigs';

vi.mock('@shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined, filePath: '' })),
  writeToUserDataFile: vi.fn(() => true),
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

describe('Saving', () => {
  test('says when the file could not be written, so the page can show it', () => {
    vi.mocked(writeToUserDataFile).mockReturnValueOnce(false);
    expect(setTimerConfigs({ timerDurationMs: 60000, warningThresholdMs: 1000 })).toBe(false);
    expect(setTimerConfigs({ timerDurationMs: 60000, warningThresholdMs: 1000 })).toBe(true);
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
    seed({ level: 'constructor' }); // A name every object answers to, but not a preset
    loadDifficultyConfigs();
    expect(getAppliedDifficultyConfigs().level).toBe('NORMAL');

    seed({ days: [], start: '17:00', end: '09:00', autoStopAtEnd: 'yes' });
    loadWorkdayConfigs();
    expect(getAppliedWorkdayConfigs()).toEqual({ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', autoStopAtEnd: false });
    seed({ start: '09:00', end: '17:60' }); // Two digits, but not a time
    loadWorkdayConfigs();
    expect(getAppliedWorkdayConfigs()).toMatchObject({ start: '09:00', end: '17:00' });

    seed({ volume: 5 });
    loadSoundConfigs();
    expect(getSoundConfigs()).toEqual({ volume: 0.5 });
  });
});

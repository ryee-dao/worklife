import { describe, test, expect, vi } from 'vitest';
import { applyTimerConfigs, getAppliedTimerConfigs, loadTimerConfigs, setTimerConfigs } from './timer/timerConfigs';
import { applyLimitConfigs, getAppliedLimitConfigs, loadLimitConfigs, setLimitConfigs } from './limit/limitConfigs';
import { applyOverdueConfigs, getAppliedOverdueConfigs, loadOverdueConfigs, setOverdueConfigs } from './overdue/overdueConfigs';

vi.mock('../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined, filePath: '' })),
  writeToUserDataFile: vi.fn(),
}));

describe('Saved configs only take effect once applied', () => {
  test('timer configs', () => {
    loadTimerConfigs();
    const configsBefore = getAppliedTimerConfigs();
    const newConfigs = { timerDurationMs: 10 * 60 * 1000, breakDurationMs: 60 * 1000, warningThresholdMs: 30 * 1000 };

    setTimerConfigs(newConfigs);
    expect(getAppliedTimerConfigs()).toEqual(configsBefore);

    applyTimerConfigs();
    expect(getAppliedTimerConfigs()).toEqual(newConfigs);
  });

  test('limit configs', () => {
    loadLimitConfigs();
    const configsBefore = getAppliedLimitConfigs();
    const newConfigs = { allottedBreaks: 1 };

    setLimitConfigs(newConfigs);
    expect(getAppliedLimitConfigs()).toEqual(configsBefore);

    applyLimitConfigs();
    expect(getAppliedLimitConfigs()).toEqual(newConfigs);
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
});

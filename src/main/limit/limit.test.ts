import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUserDataFromFile, writeToUserDataFile } from '../../shared/utils/files';
import { destroyTimers, timerEmitter } from '../timer/timerState';
import { calculateRemainingBreakSkips, getLimitState, increaseSkippedBreakCount, initLimits, LimitState, loadLimitStateFromFile, resetDailyLimits } from './limitState';
import { DEFAULTS } from "../../shared/constants"
import { getLimitConfigsFileData } from './limitConfigs';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined })),
  writeToUserDataFile: vi.fn(),
}));

vi.mock('../../shared/utils/date', () => ({
  getTodayDateAsString: vi.fn(() => "2026-01-23"),
}));

vi.mock('./limitConfigs', () => ({
  getLimitConfigsFileData: vi.fn(() => ({ allotedBreaks: DEFAULTS.DEFAULT_ALLOTTED_BREAKS }))
}))


beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(writeToUserDataFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: undefined, filePath: '' });
});

afterEach(() => {
  destroyTimers();
  timerEmitter.removeAllListeners();
  vi.useRealTimers();
});

// Helper: seed timer state before initTimer
const seedLimitState = (state: LimitState) => {
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: state, filePath: '' });
};

describe('Limits initialization and teardown', () => {
  test('starts with default limits when no saved state exists', () => {
    initLimits();

    // Should write default state to file
    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        lastResetDate: "2026-01-23",
        skippedBreakCount: 0,
      })
    );
  })

  test('loadLimitStateFromFile() does not overwrite with defaults if file data is already present', () => {
    // Set initial data for file
    const initialLimitData = { lastResetDate: "2000-01-01", skippedBreakCount: 5 }
    seedLimitState(initialLimitData)

    loadLimitStateFromFile();

    // Should write state to file
    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining(initialLimitData)
    );
  })

})

describe('Limit configs effects', () => {
  test('Calculated remaining break count is affected by limit configs', () => {
    initLimits();
    let breaksRemaining = calculateRemainingBreakSkips();
    expect(breaksRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_BREAKS);

    // Modify the limit file to reflect a new state
    seedLimitState({ lastResetDate: "2020-02-20", skippedBreakCount: 3 })
    loadLimitStateFromFile();

    // Expect that the remaining break count reflects based on limit file data
    breaksRemaining = calculateRemainingBreakSkips();
    expect(breaksRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_BREAKS - 3);
  })

  test('Remaining count decreases when increaseSkippedBreakCount() is called', () => {
    initLimits();

    let breaksRemaining = calculateRemainingBreakSkips();
    expect(breaksRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_BREAKS);

    // Expect that the remaining break count decreased
    increaseSkippedBreakCount()
    breaksRemaining = calculateRemainingBreakSkips();
    expect(breaksRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_BREAKS - 1);

    // Expect that the remaining break count decreased
    increaseSkippedBreakCount()
    breaksRemaining = calculateRemainingBreakSkips();
    expect(breaksRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_BREAKS - 2);
  })

})

describe('Daily reset logic', () => {
  test('resets skip count when date has changed', () => {
    // Seed state from "yesterday" with used skips
    seedLimitState({ lastResetDate: "2026-01-22", skippedBreakCount: 3 });

    // initLimits calls resetDailyLimits which sees date mismatch
    initLimits();

    const state = getLimitState();
    expect(state.skippedBreakCount).toBe(0);
    expect(state.lastResetDate).toBe("2026-01-23");
  });

  test('does NOT reset skip count when date is the same', () => {
    // Seed state from "today" with used skips
    seedLimitState({ lastResetDate: "2026-01-23", skippedBreakCount: 2 });

    initLimits();

    const state = getLimitState();
    expect(state.skippedBreakCount).toBe(2);
  });

  test('resetDailyLimits works when called independently (simulating the 5-min interval)', () => {
    // Start with yesterday's state
    seedLimitState({ lastResetDate: "2026-01-22", skippedBreakCount: 1 });
    loadLimitStateFromFile();

    // Simulate the periodic check firing
    resetDailyLimits();

    const state = getLimitState();
    expect(state.skippedBreakCount).toBe(0);
    expect(state.lastResetDate).toBe("2026-01-23");
  });

  test('remaining skips returns full count after daily reset', () => {
    // Yesterday's state with used skips
    seedLimitState({ lastResetDate: "2026-01-22", skippedBreakCount: 3 });

    initLimits(); // triggers reset since date changed

    const remaining = calculateRemainingBreakSkips();
    expect(remaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_BREAKS);
  });
});

describe('Skip count edge cases', () => {
  test('remaining skips can go negative (no clamping in calculation)', () => {
    // Seed with more skips used than allotted
    seedLimitState({ lastResetDate: "2026-01-23", skippedBreakCount: DEFAULTS.DEFAULT_ALLOTTED_BREAKS + 2 });
    loadLimitStateFromFile();

    const remaining = calculateRemainingBreakSkips();
    expect(remaining).toBe(-2);
  });

  test('increaseSkippedBreakCount persists to file each time', () => {
    initLimits();

    increaseSkippedBreakCount();

    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ skippedBreakCount: 1 })
    );
  });

  test('increaseSkippedBreakCount preserves lastResetDate', () => {
    seedLimitState({ lastResetDate: "2026-01-23", skippedBreakCount: 0 });
    loadLimitStateFromFile();

    increaseSkippedBreakCount();
    increaseSkippedBreakCount();

    const state = getLimitState();
    expect(state.lastResetDate).toBe("2026-01-23");
    expect(state.skippedBreakCount).toBe(2);
  });
});

describe('Limit configs', () => {
  test('remaining skips reflects custom allotted breaks config', () => {
    // Override the config mock for this test
    vi.mocked(getLimitConfigsFileData).mockReturnValue({ allotedBreaks: 5 });

    initLimits();

    expect(calculateRemainingBreakSkips()).toBe(5);

    increaseSkippedBreakCount();
    expect(calculateRemainingBreakSkips()).toBe(4);
  });
});
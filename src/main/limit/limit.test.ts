import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUserDataFromFile, writeToUserDataFile } from '../../shared/utils/files';
import { destroyTimers, timerEmitter } from '../timer/timerState';
import { calculateRemainingLunches, calculateRemainingPowerups, getLimitState, increaseLunchesUsed, increasePowerupsUsed, initLimits, LimitState, loadLimitStateFromFile, resetDailyLimits } from './limitState';
import { DEFAULTS, LUNCHES_PER_DAY } from "../../shared/constants"
import { getAllottedPowerups } from '../difficulty/difficulty';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined })),
  writeToUserDataFile: vi.fn(),
}));

vi.mock('../../shared/utils/date', () => ({
  getTodayDateAsString: vi.fn(() => "2026-01-23"),
}));

vi.mock('../difficulty/difficulty', () => ({
  getAllottedPowerups: vi.fn(() => DEFAULTS.DEFAULT_ALLOTTED_POWERUPS),
}))


beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(writeToUserDataFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: undefined, filePath: '' });
  vi.mocked(getAllottedPowerups).mockReset();
  vi.mocked(getAllottedPowerups).mockReturnValue(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);
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
        powerupsUsed: 0,
      })
    );
  })

  test('loadLimitStateFromFile() does not overwrite with defaults if file data is already present', () => {
    // Set initial data for file
    const initialLimitData = { lastResetDate: "2000-01-01", powerupsUsed: 5, lunchesUsed: 0 }
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
  test('Calculated remaining power-up count is affected by limit configs', () => {
    initLimits();
    let powerupsRemaining = calculateRemainingPowerups();
    expect(powerupsRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);

    // Modify the limit file to reflect a new state
    seedLimitState({ lastResetDate: "2020-02-20", powerupsUsed: 3, lunchesUsed: 0 })
    loadLimitStateFromFile();

    // Expect that the remaining power-up count reflects based on limit file data
    powerupsRemaining = calculateRemainingPowerups();
    expect(powerupsRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS - 3);
  })

  test('Remaining count decreases when increasePowerupsUsed() is called', () => {
    initLimits();

    let powerupsRemaining = calculateRemainingPowerups();
    expect(powerupsRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);

    // Expect that the remaining power-up count decreased
    increasePowerupsUsed()
    powerupsRemaining = calculateRemainingPowerups();
    expect(powerupsRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS - 1);

    // Expect that the remaining power-up count decreased
    increasePowerupsUsed()
    powerupsRemaining = calculateRemainingPowerups();
    expect(powerupsRemaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS - 2);
  })

  test('remaining power-ups reflects the allotted power-ups from the difficulty', () => {
    // Override the difficulty mock for this test
    vi.mocked(getAllottedPowerups).mockReturnValue(5);

    initLimits();

    expect(calculateRemainingPowerups()).toBe(5);

    increasePowerupsUsed();
    expect(calculateRemainingPowerups()).toBe(4);
  });
})

describe('Daily reset logic', () => {
  test('resets power-up count when date has changed', () => {
    // Seed state from "yesterday" with used power-ups
    seedLimitState({ lastResetDate: "2026-01-22", powerupsUsed: 3, lunchesUsed: 0 });

    // initLimits calls resetDailyLimits which sees date mismatch
    initLimits();

    const state = getLimitState();
    expect(state.powerupsUsed).toBe(0);
    expect(state.lastResetDate).toBe("2026-01-23");
  });

  test('does NOT reset power-up count when date is the same', () => {
    // Seed state from "today" with used power-ups
    seedLimitState({ lastResetDate: "2026-01-23", powerupsUsed: 2, lunchesUsed: 0 });

    initLimits();

    const state = getLimitState();
    expect(state.powerupsUsed).toBe(2);
  });

  test('resetDailyLimits works when called independently (simulating the 5-min interval)', () => {
    // Start with yesterday's state
    seedLimitState({ lastResetDate: "2026-01-22", powerupsUsed: 1, lunchesUsed: 0 });
    loadLimitStateFromFile();

    // Simulate the periodic check firing
    resetDailyLimits();

    const state = getLimitState();
    expect(state.powerupsUsed).toBe(0);
    expect(state.lastResetDate).toBe("2026-01-23");
  });

  test('remaining power-ups returns full count after daily reset', () => {
    // Yesterday's state with used power-ups
    seedLimitState({ lastResetDate: "2026-01-22", powerupsUsed: 3, lunchesUsed: 0 });

    initLimits(); // triggers reset since date changed

    const remaining = calculateRemainingPowerups();
    expect(remaining).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);
  });
});

describe('Power-up count edge cases', () => {
  test('remaining power-ups can go negative (no clamping in calculation)', () => {
    // Seed with more skips used than allotted
    seedLimitState({ lastResetDate: "2026-01-23", powerupsUsed: DEFAULTS.DEFAULT_ALLOTTED_POWERUPS + 2, lunchesUsed: 0 });
    loadLimitStateFromFile();

    const remaining = calculateRemainingPowerups();
    expect(remaining).toBe(-2);
  });

  test('increasePowerupsUsed persists to file each time', () => {
    initLimits();

    increasePowerupsUsed();

    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ powerupsUsed: 1, lunchesUsed: 0 })
    );
  });

  test('increasePowerupsUsed preserves lastResetDate', () => {
    seedLimitState({ lastResetDate: "2026-01-23", powerupsUsed: 0, lunchesUsed: 0 });
    loadLimitStateFromFile();

    increasePowerupsUsed();
    increasePowerupsUsed();

    const state = getLimitState();
    expect(state.lastResetDate).toBe("2026-01-23");
    expect(state.powerupsUsed).toBe(2);
  });
});

describe('Lunch count', () => {
  test('one lunch a day', () => {
    initLimits();

    expect(calculateRemainingLunches()).toBe(LUNCHES_PER_DAY);
    increaseLunchesUsed();
    expect(calculateRemainingLunches()).toBe(LUNCHES_PER_DAY - 1);
    expect(writeToUserDataFile).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ lunchesUsed: 1 }));
  });

  test('lunch comes back when the date has changed', () => {
    seedLimitState({ lastResetDate: "2026-01-22", powerupsUsed: 0, lunchesUsed: 1 });

    initLimits();

    expect(calculateRemainingLunches()).toBe(LUNCHES_PER_DAY);
  });

  test('lunch and power-ups are counted separately', () => {
    initLimits();

    increaseLunchesUsed();

    expect(calculateRemainingPowerups()).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);
  });
});

describe('Files saved before power-ups', () => {
  test('a file with the old skip and snooze counts starts power-ups and lunch at 0', () => {
    vi.mocked(getUserDataFromFile).mockReturnValue({
      fileContent: { lastResetDate: "2026-01-23", skippedBreakCount: 2, snoozedCount: 1 },
      filePath: '',
    });

    initLimits();

    expect(calculateRemainingPowerups()).toBe(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);
    expect(calculateRemainingLunches()).toBe(LUNCHES_PER_DAY);
  });
});

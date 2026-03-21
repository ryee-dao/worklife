import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULTS, EVENTS } from '../../shared/constants';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined })),
  writeToUserDataFile: vi.fn(),
}));

vi.mock('../limit/limitState', () => ({
  calculateRemainingBreakSkips: vi.fn(() => 3),
}));

vi.mock('../limit/limitConfigs', () => ({
  getLimitConfig: vi.fn(() => ({ allotedBreaks: 3 })),
}));

vi.mock('./timerConfigs', () => ({
  getTimerSettingsData: vi.fn(() => ({
    timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
    breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
  })),
}));

import { initTimer, destroyTimers, pauseTimer, startTimer, skipTimer, skipBreak, timerEmitter, TimerState, StoredTimerState } from './timerState';
import { getUserDataFromFile, writeToUserDataFile } from '../../shared/utils/files';
import { calculateRemainingBreakSkips } from '../limit/limitState';

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(writeToUserDataFile).mockClear();
  vi.mocked(getUserDataFromFile).mockClear();
});

afterEach(() => {
  destroyTimers();
  timerEmitter.removeAllListeners();
  vi.useRealTimers();
});

// Helper: seed timer state before initTimer
const seedTimerState = (state: StoredTimerState) => {
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: state, filePath: '' });
};

describe('Timer initialization and teardown', () => {
  test('starts with defaults when no saved state exists', () => {
    vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: undefined, filePath: '' });

    initTimer();

    // Should write default state to file
    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        currentCountdownMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
        status: 'RUNNING',
      })
    );
  });

  test('restores saved state from file', () => {
    seedTimerState({ currentCountdownMs: 500000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    // The emitted state should reflect the seeded countdown (minus ticks)
    expect(runningHandler).toHaveBeenCalled();
    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBeLessThan(500000);
  });

  test('applies threshold fallback when countdown is too low on startup', () => {
    // Seed with very low countdown (below 1 min threshold) WITHOUT bypass flag
    seedTimerState({ currentCountdownMs: 5000, status: 'RUNNING' });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    // Should have been bumped up to threshold (60000ms), not the seeded 5000ms
    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBeGreaterThan(5000);
  });

  test('bypasses threshold when _bypassThreshold flag is set', () => {
    seedTimerState({ currentCountdownMs: 3000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    // Should count down from seeded value, not bumped to threshold
    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(2000);
  });

  test('handles empty user data file gracefully', () => {
    // Simulate corrupted file data with missing fields
    vi.mocked(getUserDataFromFile).mockReturnValue({
      fileContent: undefined,
      filePath: '',
    });

    initTimer();

    // Should not throw - defaults should fill in missing currentCountdownMs
    // The spread operator pattern should prevent NaN
    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        currentCountdownMs: expect.any(Number),
        status: 'RUNNING',
      })
    );

    // Verify the countdown is a real number
    const writtenState = vi.mocked(writeToUserDataFile).mock.calls[0][1] as TimerState;
    expect(typeof (writtenState.currentCountdownMs)).toBe("number");
    expect(Number.isNaN(writtenState.currentCountdownMs)).toBe(false);
  });

});

describe('Timer countdown and transitions', () => {
  test('counts down each second when running', () => {
    seedTimerState({ currentCountdownMs: 5000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(3000);

    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(2000);
  });

  test('transitions to BREAK when countdown reaches 0', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_BREAK, breakHandler);

    initTimer();
    vi.advanceTimersByTime(2000);

    expect(breakHandler).toHaveBeenCalled();
  });

  test('transitions back to RUNNING after break ends', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    const stopBreakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);

    initTimer();

    // Run through work countdown
    vi.advanceTimersByTime(2000);

    // Run through break countdown
    vi.advanceTimersByTime(DEFAULTS.DEFAULT_BREAK_DURATION_MS);

    expect(stopBreakHandler).toHaveBeenCalled();
  });

  test('writes state to file on transition', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    initTimer();
    vi.mocked(writeToUserDataFile).mockClear(); // Clear init writes

    vi.advanceTimersByTime(2000); // Trigger transition

    expect(writeToUserDataFile).toHaveBeenCalled();
  });
});

describe('Pause and resume', () => {
  test('pausing stops countdown', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(2000); // Count down to 8000

    let emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(8000);

    pauseTimer();
    vi.advanceTimersByTime(5000); // Time passes but shouldn't count down

    const pausedHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.PAUSED, pausedHandler);

    // Advance to trigger an emit
    vi.advanceTimersByTime(1000);

    emittedState = pausedHandler.mock.calls[pausedHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(8000);
    expect(emittedState.status).toBe('PAUSED');
  });

  test('timer still saves on intervals when paused', () => {
    initTimer();
    vi.mocked(writeToUserDataFile).mockClear(); // Clear init writes

    // Expect pause triggers a save state
    pauseTimer();
    expect(writeToUserDataFile).toHaveBeenCalledTimes(1);

    // Advance time by an amount not long enough to trigger a save
    vi.advanceTimersByTime(5000);
    expect(writeToUserDataFile).toHaveBeenCalledTimes(1);

    // Advance time to trigger a save
    vi.advanceTimersByTime(30000);

    // Assert that data is saved again after time has sufficiently passed
    expect(writeToUserDataFile).toHaveBeenCalledTimes(2);
  })

  test('resuming continues countdown from paused value', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    // Init the timer and let it run down
    initTimer();
    vi.advanceTimersByTime(2000); // 8000 remaining
    let emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(8000);

    // Pause the timer and make sure the value did not decrement
    pauseTimer();
    vi.advanceTimersByTime(5000); // Time passes, no countdown
    expect(emittedState.currentCountdownMs).toBe(8000);

    startTimer();
    vi.advanceTimersByTime(1000); // Should tick from 8000 to 7000

    emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(7000);
  });

  test('pause writes state to file', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    initTimer();
    vi.mocked(writeToUserDataFile).mockClear();

    pauseTimer();

    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'PAUSED' })
    );
  });
});

describe('Skip functionality', () => {
  test('skipTimer forces immediate transition to break', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_BREAK, breakHandler);

    initTimer();
    skipTimer();

    // Next tick should trigger transition since countdown was set to 0
    vi.advanceTimersByTime(1000);

    expect(breakHandler).toHaveBeenCalled();
  });

  test('skipBreak forces immediate transition back to running', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    const stopBreakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);

    initTimer();
    vi.advanceTimersByTime(2000); // Transition to break

    skipBreak();
    vi.advanceTimersByTime(1000); // Next tick processes the skip

    expect(stopBreakHandler).toHaveBeenCalled();
  });
});

describe('Available actions', () => {
  test('RUNNING state offers pause and skip actions', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).toContain('pause');
    expect(emittedState.availableActions).toContain('skip');
    expect(emittedState.availableActions).not.toContain('start');
  });

  test('PAUSED state offers only start action', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    initTimer();
    pauseTimer();

    const pausedHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.PAUSED, pausedHandler);

    vi.advanceTimersByTime(1000);

    const emittedState = pausedHandler.mock.calls[pausedHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).toContain('start');
    expect(emittedState.availableActions).not.toContain('pause');
  });

  test('BREAK state offers skip when skips remain', () => {
    vi.mocked(calculateRemainingBreakSkips).mockReturnValue(2);
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to break
    vi.advanceTimersByTime(1000); // Emit break state

    const emittedState = breakHandler.mock.calls[breakHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).toContain('skip');
  });

  test('BREAK state has no skip when skips exhausted', () => {
    vi.mocked(calculateRemainingBreakSkips).mockReturnValue(0);
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);

    initTimer();
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(1000);

    const emittedState = breakHandler.mock.calls[breakHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).not.toContain('skip');
  });
});

describe('State emission', () => {
  test('emits remaining skips and allotted breaks with state', () => {
    vi.mocked(calculateRemainingBreakSkips).mockReturnValue(2);
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.remainingSkips).toBe(2);
    expect(emittedState.allotedBreaks).toBe(3);
  });

  test('remainingSkips never goes below 0', () => {
    vi.mocked(calculateRemainingBreakSkips).mockReturnValue(-1);
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.remainingSkips).toBe(0);
  });
});
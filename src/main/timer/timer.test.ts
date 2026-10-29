import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULTS, EVENTS } from '../../shared/constants';

// Add mocks
vi.mock('../../shared/utils/files', () => ({
  getUserDataFromFile: vi.fn(() => ({ fileContent: undefined })),
  writeToUserDataFile: vi.fn(),
}));

vi.mock('../limit/limitState', () => ({
  calculateRemainingPowerups: vi.fn(() => 3),
  increasePowerupsUsed: vi.fn(),
  calculateRemainingLunches: vi.fn(() => 1),
  increaseLunchesUsed: vi.fn(),
}));

vi.mock('../difficulty/difficulty', () => ({
  getAllottedPowerups: vi.fn(() => 3),
  getBreakDurationMs: vi.fn(() => DEFAULTS.DEFAULT_BREAK_DURATION_MS),
  getSnoozeDurationMs: vi.fn(() => DEFAULTS.DEFAULT_SNOOZE_DURATION_MS),
  getLunchDurationMs: vi.fn(() => DEFAULTS.DEFAULT_LUNCH_DURATION_MS),
}));

vi.mock('./timerConfigs', () => ({
  getAppliedTimerConfigs: vi.fn(() => ({
    timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
    warningThresholdMs: 5000,
  })),
}));

import { initTimer, destroyTimers, stopTimer, startTimer, forwardToBreak, skipBreak, snoozeTimer, startLunch, timerEmitter, TimerState, TimerTransition, StoredTimerState, startBreak } from './timerState';
import { getUserDataFromFile, writeToUserDataFile } from '../../shared/utils/files';
import { calculateRemainingLunches, calculateRemainingPowerups, increaseLunchesUsed, increasePowerupsUsed } from '../limit/limitState';

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getUserDataFromFile).mockReset();
  vi.mocked(getUserDataFromFile).mockReturnValue({ fileContent: undefined, filePath: '' });
  vi.mocked(calculateRemainingPowerups).mockReset();
  vi.mocked(calculateRemainingPowerups).mockReturnValue(DEFAULTS.DEFAULT_ALLOTTED_POWERUPS);
  vi.mocked(increasePowerupsUsed).mockReset();
  vi.mocked(calculateRemainingLunches).mockReset();
  vi.mocked(calculateRemainingLunches).mockReturnValue(1);
  vi.mocked(increaseLunchesUsed).mockReset();
});

afterEach(() => {
  destroyTimers();
  timerEmitter.removeAllListeners();
  vi.useRealTimers();
});

// Helper: seed timer state before initTimer
const seedTimerState = (state: Partial<StoredTimerState>) => {
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

  test('relaunching during OVERDUE resets to RUNNING', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });
    initTimer();

    // Make the state naturally change to OVERDUE
    vi.advanceTimersByTime(3000);

    // Capture what the app actually persisted, then "close"
    const captured = vi.mocked(writeToUserDataFile).mock.lastCall![1] as StoredTimerState;

    // Ensure that it is actually OVERDUE
    expect(captured.status).toBe('OVERDUE');

    // Destroy the timer and "close the app"  
    destroyTimers();

    // "Reopen" against the app's own file contents
    // but remove the _bypassThreshold flag to trigger the reset logic
    seedTimerState({ ...captured, _bypassThreshold: false });
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    initTimer();
    vi.advanceTimersByTime(1000);

    // Assert the state was correctly reset
    const state = runningHandler.mock.lastCall![0];
    expect(state.status).toBe('RUNNING');
    expect(state.overdueTimeMs).toBe(0);
    expect(state.currentCountdownMs).toBeGreaterThan(0);
  });

  test('defaults overdueTimeMs to 0 when missing from stored state', () => {
    seedTimerState({ currentCountdownMs: 500000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    // Assert that {overdueTimeMs} defaults to 0 if not in file/seeded in
    const state = runningHandler.mock.lastCall![0];
    expect(typeof (state.overdueTimeMs)).toBe("number");
    expect(state.overdueTimeMs).toBe(0);
    expect(Number.isNaN(state.overdueTimeMs)).toBe(false);
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

  test('relaunching during BREAK resets to RUNNING', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });
    initTimer();
    vi.advanceTimersByTime(1000); // → OVERDUE
    startBreak("WINDOW");                 // → BREAK

    const captured = vi.mocked(writeToUserDataFile).mock.lastCall![1] as StoredTimerState;
    expect(captured.status).toBe('BREAK');
    destroyTimers();

    seedTimerState({ ...captured, _bypassThreshold: false });
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    initTimer();
    vi.advanceTimersByTime(1000);

    expect(runningHandler.mock.lastCall![0].status).toBe('RUNNING');
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

  test('transitions to OVERDUE when countdown reaches 0', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);
    timerEmitter.on(EVENTS.TIMER.START_OVERDUE, overdueHandler);

    initTimer();
    vi.advanceTimersByTime(2000);

    expect(breakHandler).not.toHaveBeenCalled();
    expect(overdueHandler).toHaveBeenCalled();
  });

  test('OVERDUE never transitions automatically', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);
    timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, overdueHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE state

    // Advance the timer by a long amount
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);

    expect(breakHandler).not.toHaveBeenCalled();
    expect(overdueHandler).toHaveBeenCalled();
    expect(overdueHandler.mock.lastCall![0].status).toBe('OVERDUE');
  });

  test('startBreak from OVERDUE emits START_BREAK once', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const startBreakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_BREAK, startBreakHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // → OVERDUE
    startBreak("WINDOW");

    expect(startBreakHandler).toHaveBeenCalledOnce();
  });

  test('transitions back to RUNNING after break ends', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    const stopBreakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);

    initTimer();

    // Run through work countdown
    vi.advanceTimersByTime(2000);

    // Run through break countdown
    startBreak("WINDOW");
    vi.advanceTimersByTime(DEFAULTS.DEFAULT_BREAK_DURATION_MS);

    expect(stopBreakHandler).toHaveBeenCalled();
  });

  test('OVERDUE counts up while countdown stays frozen at 0', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, overdueHandler);

    // Change the state to OVERDUE
    initTimer();
    vi.advanceTimersByTime(1000);

    // Have it 5 seconds OVERDUE
    vi.advanceTimersByTime(5000);

    const state = overdueHandler.mock.lastCall![0];
    expect(state.overdueTimeMs).toBe(5000);
    expect(state.currentCountdownMs).toBe(0);
  });

  test('overdueTimeMs resets after break', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);  // → OVERDUE
    vi.advanceTimersByTime(30000); // accrue 30s
    startBreak("WINDOW");                  // → BREAK
    skipBreak("WINDOW");                   // → RUNNING
    vi.advanceTimersByTime(1000);  // emit RUNNING state

    const state = runningHandler.mock.lastCall![0];
    expect(state.status).toBe('RUNNING');
    expect(state.overdueTimeMs).toBe(0); // stale-counter tripwire
  });

  test('writes state to file on transition', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    initTimer();
    vi.mocked(writeToUserDataFile).mockClear(); // Clear init writes

    vi.advanceTimersByTime(2000); // Trigger transition

    expect(writeToUserDataFile).toHaveBeenCalled();
  });
});

describe('Stop and resume', () => {
  test('pausing stops countdown', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(2000); // Count down to 8000

    let emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(8000);

    stopTimer("WINDOW");
    vi.advanceTimersByTime(5000); // Time passes but shouldn't count down

    const stoppedHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOPPED, stoppedHandler);

    // Advance to trigger an emit
    vi.advanceTimersByTime(1000);

    emittedState = stoppedHandler.mock.calls[stoppedHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(8000);
    expect(emittedState.status).toBe('STOPPED');
  });

  test('timer still saves on intervals when stopped', () => {
    initTimer();
    vi.mocked(writeToUserDataFile).mockClear(); // Clear init writes

    // Expect stop triggers a save state
    stopTimer("WINDOW");
    expect(writeToUserDataFile).toHaveBeenCalledTimes(1);

    // Advance time by an amount not long enough to trigger a save
    vi.advanceTimersByTime(5000);
    expect(writeToUserDataFile).toHaveBeenCalledTimes(1);

    // Advance time to trigger a save
    vi.advanceTimersByTime(30000);

    // Assert that data is saved again after time has sufficiently passed
    expect(writeToUserDataFile).toHaveBeenCalledTimes(2);
  })

  test('resuming continues countdown from stopped value', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    // Init the timer and let it run down
    initTimer();
    vi.advanceTimersByTime(2000); // 8000 (8 seconds) remaining
    let emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(8000);

    // Stop the timer and make sure the value did not decrement
    stopTimer("WINDOW");
    vi.advanceTimersByTime(5000); // Time passes, no countdown

    // Resume timer
    startTimer("WINDOW");
    vi.advanceTimersByTime(1000); // Should tick from 8000 to 7000

    emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.currentCountdownMs).toBe(7000);
  });

  test('stop writes state to file', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    initTimer();
    vi.mocked(writeToUserDataFile).mockClear();

    stopTimer("WINDOW");

    expect(writeToUserDataFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'STOPPED' })
    );
  });
});

describe('Skip functionality', () => {
  test('forwardToBreak forces immediate transition to overdue', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const overdueHandler = vi.fn();
    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_OVERDUE, overdueHandler);
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);

    initTimer();
    forwardToBreak("WINDOW");

    // Next tick should trigger transition since countdown was set to 0
    vi.advanceTimersByTime(1000);

    expect(breakHandler).not.toHaveBeenCalled();
    expect(overdueHandler).toHaveBeenCalledOnce();
  });

  test('skipBreak forces immediate transition back to running', () => {
    seedTimerState({ currentCountdownMs: 2000, status: 'RUNNING', _bypassThreshold: true });

    const stopBreakHandler = vi.fn();
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    // Transition to break
    initTimer();
    vi.advanceTimersByTime(2000);
    startBreak("WINDOW");

    // Skip the break
    runningHandler.mockClear(); // Ignore RUNNING emissions from before the break
    skipBreak("WINDOW");
    vi.advanceTimersByTime(1000); // Next tick processes the skip

    expect(stopBreakHandler).toHaveBeenCalled();
    expect(runningHandler).toHaveBeenCalled();

    const emittedState = runningHandler.mock.lastCall![0];
    expect(emittedState.status).toBe('RUNNING');
    expect(emittedState.currentCountdownMs).toBeGreaterThan(0);
  });
});

describe('Snooze', () => {
  test('snoozing adds the snooze length to the countdown', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    snoozeTimer("WINDOW");

    expect(runningHandler.mock.lastCall![0].currentCountdownMs).toBe(100000 + DEFAULTS.DEFAULT_SNOOZE_DURATION_MS);
    expect(increasePowerupsUsed).toHaveBeenCalledOnce();
  });

  test('snoozing during the warning pushes the overdue window back', () => {
    seedTimerState({ currentCountdownMs: 3000, status: 'RUNNING', _bypassThreshold: true });

    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_OVERDUE, overdueHandler);

    initTimer();
    snoozeTimer("TRAY");
    vi.advanceTimersByTime(3000); // When overdue would have started

    expect(overdueHandler).not.toHaveBeenCalled();
  });

  test('snooze is a no-op during OVERDUE', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    runningHandler.mockClear();
    snoozeTimer("WINDOW");

    expect(runningHandler).not.toHaveBeenCalled();
    expect(increasePowerupsUsed).not.toHaveBeenCalled();
  });

  test('snooze is a no-op when no snoozes remain', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });
    vi.mocked(calculateRemainingPowerups).mockReturnValue(0);

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    runningHandler.mockClear();
    snoozeTimer("WINDOW");

    expect(runningHandler).not.toHaveBeenCalled();
    expect(increasePowerupsUsed).not.toHaveBeenCalled();
  });
});

describe('Available actions', () => {
  test('RUNNING state offers stop, forward, snooze and lunch', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).toContain('stop');
    expect(emittedState.availableActions).toContain('forward');
    expect(emittedState.availableActions).toContain('snooze');
    expect(emittedState.availableActions).toContain('lunch');
    expect(emittedState.availableActions).not.toContain('skip'); // Skipping is only for breaks
    expect(emittedState.availableActions).not.toContain('start');
  });

  test('STOPPED state offers only start action', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    initTimer();
    stopTimer("WINDOW");

    const stoppedHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOPPED, stoppedHandler);

    vi.advanceTimersByTime(1000);

    const emittedState = stoppedHandler.mock.calls[stoppedHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).toContain('start');
    expect(emittedState.availableActions).not.toContain('stop');
  });

  test('BREAK state offers skip when skips remain', () => {
    vi.mocked(calculateRemainingPowerups).mockReturnValue(2);
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to overdue
    startBreak("WINDOW")
    vi.advanceTimersByTime(1000); // Emit break state

    const emittedState = breakHandler.mock.calls[breakHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).toContain('skip');
  });

  test('BREAK state has no skip when skips exhausted', () => {
    vi.mocked(calculateRemainingPowerups).mockReturnValue(0);
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);

    initTimer();
    vi.advanceTimersByTime(1000);
    startBreak("WINDOW");

    const emittedState = breakHandler.mock.calls[breakHandler.mock.calls.length - 1][0];
    expect(emittedState.availableActions).not.toContain('skip');
  });

  test('OVERDUE state has correct avilable actions', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, overdueHandler);

    initTimer();
    vi.advanceTimersByTime(2000);

    const state = overdueHandler.mock.lastCall![0];
    expect(state.availableActions).toContain('breaktime');
    expect(state.availableActions).toContain('skip');
    expect(state.availableActions).toContain('lunch');
    expect(state.availableActions).toContain('stop'); // The escape hatch
  });
});

describe('State emission', () => {
  test('emits remaining and allotted power-ups with state', () => {
    vi.mocked(calculateRemainingPowerups).mockReturnValue(2);
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.remainingPowerups).toBe(2);
    expect(emittedState.allottedPowerups).toBe(3);
  });

  test('remainingPowerups never goes below 0', () => {
    vi.mocked(calculateRemainingPowerups).mockReturnValue(-1);
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);

    const emittedState = runningHandler.mock.calls[runningHandler.mock.calls.length - 1][0];
    expect(emittedState.remainingPowerups).toBe(0);
  });
});

describe('Action enforcement', () => {
  test('startBreak is a no-op during RUNNING', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_BREAK, breakHandler);
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000);
    runningHandler.mockClear(); // Clear existing runningHandler so it doesn't contain stale calls
    startBreak("WINDOW"); // late/hostile IPC message: state doesn't permit this
    vi.advanceTimersByTime(1000);


    expect(breakHandler).not.toHaveBeenCalled();
    expect(runningHandler).toHaveBeenCalled();              // still emitting AFTER the action
    expect(runningHandler.mock.lastCall![0].status).toBe('RUNNING');
  });

  test('startBreak is a no-op during STOPPED', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const breakHandler = vi.fn();
    const stoppedHandler = vi.fn();

    timerEmitter.on(EVENTS.TIMER.STOPPED, stoppedHandler);
    timerEmitter.on(EVENTS.TIMER.START_BREAK, breakHandler);

    initTimer();
    stopTimer("WINDOW");
    stoppedHandler.mockClear(); // Clear existing stoppedHandler so it doesn't contain stale calls
    startBreak("WINDOW");
    vi.advanceTimersByTime(1000);

    expect(breakHandler).not.toHaveBeenCalled();
    expect(stoppedHandler).toHaveBeenCalled();
    expect(stoppedHandler.mock.lastCall![0].status).toBe('STOPPED');
  });

  test('skipBreak during OVERDUE transitions to RUNNING', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const startBreakHandler = vi.fn();
    const stopBreakHandler = vi.fn();
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_BREAK, startBreakHandler);
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE

    // Skip the break directly from OVERDUE
    runningHandler.mockClear();
    skipBreak("WINDOW");
    vi.advanceTimersByTime(1000); // Tick to process BREAK → RUNNING

    // Assert the transition completed
    expect(stopBreakHandler).toHaveBeenCalled();
    expect(runningHandler).toHaveBeenCalled();
    const state = runningHandler.mock.lastCall![0];
    expect(state.status).toBe('RUNNING');
    expect(state.overdueTimeMs).toBe(0);
    expect(state.currentCountdownMs).toBeGreaterThan(0);

    // Assert that start break was not triggered when a skip occursS
    expect(startBreakHandler).not.toHaveBeenCalled();
  });

  test('stopTimer is a no-op during STOPPED', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const transitionHandler = vi.fn();
    initTimer();
    stopTimer("WINDOW");
    timerEmitter.on(EVENTS.TIMER.TRANSITION, transitionHandler);
    stopTimer("TRAY"); // Stale tray menu still showing Stop

    expect(transitionHandler).not.toHaveBeenCalled();
  });

  test('forwardToBreak is a no-op during OVERDUE', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const startBreakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_BREAK, startBreakHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    forwardToBreak("TRAY");

    expect(startBreakHandler).not.toHaveBeenCalled();
  });

  test('startTimer is a no-op during OVERDUE', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    timerEmitter.on(EVENTS.TIMER.START_OVERDUE, overdueHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    runningHandler.mockClear();
    startTimer("TRAY"); // Stale tray menu still showing Resume
    vi.advanceTimersByTime(1000);

    expect(runningHandler).not.toHaveBeenCalled();
    expect(overdueHandler).toHaveBeenCalledOnce(); // No second overdue window
  });

  test('startTimer is a no-op during BREAK', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    const breakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    timerEmitter.on(EVENTS.TIMER.ON_BREAK, breakHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    startBreak("WINDOW");
    runningHandler.mockClear();
    startTimer("TRAY"); // Would end the break without using a skip
    vi.advanceTimersByTime(1000);

    expect(runningHandler).not.toHaveBeenCalled();
    expect(breakHandler.mock.lastCall![0].status).toBe('BREAK');
  });

  test('forwardToBreak is a no-op during BREAK', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const stopBreakHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    startBreak("WINDOW");
    forwardToBreak("TRAY"); // Would end the break without using a skip

    expect(stopBreakHandler).not.toHaveBeenCalled();
  });
});

describe('Stop from the break screens', () => {
  // The escape hatch: it closes the break window and the next resume starts a full work session
  test.each([
    { from: 'OVERDUE', reachIt: () => vi.advanceTimersByTime(1000) },
    { from: 'BREAK', reachIt: () => { vi.advanceTimersByTime(1000); startBreak("WINDOW"); } },
  ])('stopping from $from closes the window and resets the timer', ({ from, reachIt }) => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const stopBreakHandler = vi.fn();
    const stoppedHandler = vi.fn();
    const transitionHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);
    timerEmitter.on(EVENTS.TIMER.STOPPED, stoppedHandler);
    timerEmitter.on(EVENTS.TIMER.TRANSITION, transitionHandler);

    initTimer();
    reachIt();
    stopTimer("WINDOW");

    expect(stopBreakHandler).toHaveBeenCalledOnce();
    const state = stoppedHandler.mock.lastCall![0];
    expect(state.status).toBe('STOPPED');
    expect(state.currentCountdownMs).toBe(DEFAULTS.DEFAULT_TIMER_DURATION_MS);
    expect(state.overdueTimeMs).toBe(0);
    expect(transitionHandler).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'STOPPED', from }));
  });

  test('resuming after a stop from overdue runs a full session instead of going straight back to overdue', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.START_OVERDUE, overdueHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    stopTimer("WINDOW");
    startTimer("WINDOW");
    vi.advanceTimersByTime(5000);

    expect(overdueHandler).toHaveBeenCalledOnce();
  });
});

describe('Lunch', () => {
  const getLastState = (handler: ReturnType<typeof vi.fn>): TimerState => handler.mock.lastCall![0];

  test('lunch counts down its own length, then goes back to work with a full timer', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const lunchHandler = vi.fn();
    const runningHandler = vi.fn();
    const transitionHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_LUNCH, lunchHandler);
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    timerEmitter.on(EVENTS.TIMER.TRANSITION, transitionHandler);

    initTimer();
    startLunch("WINDOW");

    expect(increaseLunchesUsed).toHaveBeenCalledOnce();
    expect(getLastState(lunchHandler).status).toBe('LUNCH');
    expect(getLastState(lunchHandler).currentCountdownMs).toBe(DEFAULTS.DEFAULT_LUNCH_DURATION_MS);
    expect(transitionHandler).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'LUNCH_STARTED', from: 'RUNNING' }));

    vi.advanceTimersByTime(DEFAULTS.DEFAULT_LUNCH_DURATION_MS);

    expect(getLastState(runningHandler).status).toBe('RUNNING');
    expect(getLastState(runningHandler).currentCountdownMs).toBe(DEFAULTS.DEFAULT_TIMER_DURATION_MS);
    expect(transitionHandler).toHaveBeenLastCalledWith({ type: 'LUNCH_ENDED', cause: 'TIME_UP' });
  });

  test('resuming during lunch ends it early with a full timer', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    const transitionHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    timerEmitter.on(EVENTS.TIMER.TRANSITION, transitionHandler);

    initTimer();
    startLunch("WINDOW");
    vi.advanceTimersByTime(10000);
    startTimer("TRAY");

    expect(getLastState(runningHandler).currentCountdownMs).toBe(DEFAULTS.DEFAULT_TIMER_DURATION_MS);
    expect(transitionHandler).toHaveBeenLastCalledWith({
      type: 'LUNCH_ENDED', cause: 'ENDED_EARLY', source: 'TRAY', lunchLeftMs: DEFAULTS.DEFAULT_LUNCH_DURATION_MS - 10000,
    });
  });

  test('lunch from overdue closes the overdue window', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const stopBreakHandler = vi.fn();
    const lunchHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOP_BREAK, stopBreakHandler);
    timerEmitter.on(EVENTS.TIMER.ON_LUNCH, lunchHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // Transition to OVERDUE
    startLunch("WINDOW");

    expect(stopBreakHandler).toHaveBeenCalledOnce();
    expect(getLastState(lunchHandler).overdueTimeMs).toBe(0);
  });

  test('lunch offers only ending it early', () => {
    seedTimerState({ currentCountdownMs: 100000, status: 'RUNNING', _bypassThreshold: true });

    const lunchHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_LUNCH, lunchHandler);

    initTimer();
    startLunch("WINDOW");

    expect(getLastState(lunchHandler).availableActions).toEqual(['start']);
  });

  test.each([
    { name: 'no lunch is left', setUp: () => vi.mocked(calculateRemainingLunches).mockReturnValue(0) },
    { name: 'stopped', setUp: () => stopTimer("WINDOW") },
    { name: 'on a break', setUp: () => { vi.advanceTimersByTime(1000); startBreak("WINDOW"); } },
  ])('lunch is a no-op when $name', ({ setUp }) => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const transitionHandler = vi.fn();
    initTimer();
    setUp();
    timerEmitter.on(EVENTS.TIMER.TRANSITION, transitionHandler);
    startLunch("WINDOW");

    expect(transitionHandler).not.toHaveBeenCalled();
    expect(increaseLunchesUsed).not.toHaveBeenCalled();
  });

  test('no lunch in the available actions once it is used', () => {
    vi.mocked(calculateRemainingLunches).mockReturnValue(0);
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    initTimer();

    expect(getLastState(runningHandler).availableActions).not.toContain('lunch');
  });

  test('relaunching during lunch goes back to work with a full timer', () => {
    seedTimerState({ currentCountdownMs: 600000, status: 'LUNCH' });

    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);
    initTimer();

    expect(getLastState(runningHandler).status).toBe('RUNNING');
    expect(getLastState(runningHandler).currentCountdownMs).toBe(DEFAULTS.DEFAULT_TIMER_DURATION_MS);
  });
});

describe('Power-ups', () => {
  test('snoozes and break skips draw from the same pool', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const transitionHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.TRANSITION, transitionHandler);

    initTimer();
    snoozeTimer("WINDOW");
    forwardToBreak("WINDOW");
    skipBreak("WINDOW");

    expect(increasePowerupsUsed).toHaveBeenCalledTimes(2);
    const types = transitionHandler.mock.calls.map((call) => (call[0] as TimerTransition).type);
    expect(types).toEqual(['APP_STARTED', 'SNOOZED', 'OVERDUE_STARTED', 'BREAK_SKIPPED']);
  });

  test('with no power-ups left, neither a snooze nor a break skip works', () => {
    vi.mocked(calculateRemainingPowerups).mockReturnValue(0);
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });

    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, overdueHandler);

    initTimer();
    snoozeTimer("WINDOW");
    forwardToBreak("WINDOW");
    skipBreak("WINDOW");

    expect(increasePowerupsUsed).not.toHaveBeenCalled();
    expect(overdueHandler.mock.lastCall![0].status).toBe('OVERDUE'); // The skip didn't end it
  });
});

describe('Warning state', () => {
  test('isWarning is false above the threshold', () => {
    seedTimerState({ currentCountdownMs: 10000, status: 'RUNNING', _bypassThreshold: true });
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // 9000 left

    expect(runningHandler.mock.lastCall![0].isWarning).toBe(false);
  });

  test('isWarning is true exactly at the threshold', () => {
    // Catches < vs <= off-by-one
    seedTimerState({ currentCountdownMs: 6000, status: 'RUNNING', _bypassThreshold: true });
    const runningHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.RUNNING, runningHandler);

    initTimer();
    vi.advanceTimersByTime(1000); // 5000 left

    expect(runningHandler.mock.lastCall![0].isWarning).toBe(true);
  });

  test('isWarning is false while stopped inside the window', () => {
    seedTimerState({ currentCountdownMs: 4000, status: 'RUNNING', _bypassThreshold: true });
    const stoppedHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.STOPPED, stoppedHandler);

    initTimer();
    stopTimer("WINDOW");
    vi.advanceTimersByTime(1000);

    expect(stoppedHandler.mock.lastCall![0].isWarning).toBe(false);
  });

  test('isWarning is false once overdue', () => {
    seedTimerState({ currentCountdownMs: 1000, status: 'RUNNING', _bypassThreshold: true });
    const overdueHandler = vi.fn();
    timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, overdueHandler);

    initTimer();
    vi.advanceTimersByTime(2000);

    expect(overdueHandler.mock.lastCall![0].isWarning).toBe(false);
  });
});
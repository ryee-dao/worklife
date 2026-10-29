import { describe, test, expect, vi, beforeEach, it } from 'vitest';
import { DEFAULTS } from '../../shared/constants';
import { updateTray, buildStatusIcons, ICON_DIR } from './tray';
import { TimerState } from '../timer/timerState';
import { DayScore } from '../stats/checkpoints';
import { existsSync } from 'fs';
import path from 'path';

vi.mock('../main', () => ({
  settingsWindow: null,
}));

vi.mock('electron', () => ({
  app: { dock: { setIcon: vi.fn() }, quit: vi.fn() },
  Menu: { buildFromTemplate: vi.fn((template) => template) },
  nativeImage: { createFromPath: vi.fn((p: string) => p) },
}));

function createMockTray() {
  return {
    isDestroyed: vi.fn(() => false),
    setImage: vi.fn(),
    setTitle: vi.fn(),
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
  };
}

function createTimerState(overrides: Partial<TimerState> = {}): TimerState {
  return {
    currentCountdownMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
    status: 'RUNNING',
    overdueTimeMs: 0,
    availableActions: ['stop', 'forward'],
    remainingPowerups: 3,
    allottedPowerups: 3,
    remainingLunches: 1,
    snoozeDurationMs: 7 * 60 * 1000,
    lunchDurationMs: 45 * 60 * 1000,
    isWarning: false,
    ...overrides,
  };
}

beforeEach(() => {
  buildStatusIcons();
});

describe('Tray status detection', () => {
  test('RUNNING state shows green icon', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', currentCountdownMs: 600000 });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-green'));
  });

  test('RUNNING state below warning threshold shows yellow icon', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'RUNNING',
      isWarning: true
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-yellow'));
  });

  test('OVERDUE state shows orange icon', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'OVERDUE',
      currentCountdownMs: 0,
      overdueTimeMs: 5000,
      availableActions: ['breaktime', 'skip'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-orange'));
  });

  test('BREAK state shows blue icon', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'BREAK',
      currentCountdownMs: 30000,
      availableActions: ['skip'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-blue'));
  });

  test('STOPPED state shows gray icon', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'STOPPED',
      availableActions: ['start'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-gray'));
  });

  test('RUNNING state in warning window shows yellow icon', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', isWarning: true });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-yellow'));
  });

  test('tray follows isWarning, not the countdown', () => {
    // The timer decides the warning window; the tray must not recompute it.
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', currentCountdownMs: 1000, isWarning: false });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-green'));
  });
});

describe('Tray context/dropdown menu actions', () => {
  test('RUNNING state offers Stop and Forward to Break', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING' });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Stop');
    expect(labels).toContain('Forward to Break');
    expect(labels).not.toContain('Skip Break'); // Skipping is only for breaks
    expect(labels).not.toContain('Resume');
  });

  test('RUNNING state offers Snooze with its length when power-ups remain', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', availableActions: ['stop', 'forward', 'snooze'] });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Snooze +7 min');
  });

  test('RUNNING state hides Snooze when no power-ups remain', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', availableActions: ['stop', 'forward'] });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).not.toContain('Snooze +7 min');
  });

  test('STOPPED state offers Resume', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'STOPPED', availableActions: ['start'] });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Resume');
    expect(labels).not.toContain('Stop');
  });

  test('OVERDUE state offers Start Break, Lunch, Skip Break and Stop', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'OVERDUE',
      availableActions: ['breaktime', 'skip', 'lunch', 'stop'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Start Break');
    expect(labels).toContain('Lunch (45 min)');
    expect(labels).toContain('Skip Break');
    expect(labels).toContain('Stop');
  });

  test('BREAK state hides Skip Break when no power-ups remain, but Stop is always there', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'BREAK',
      currentCountdownMs: 30000,
      availableActions: ['stop'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).not.toContain('Skip Break');
    expect(labels).toContain('Stop');
  });

  test('RUNNING state offers Lunch with its length until it is used', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ availableActions: ['stop', 'forward', 'lunch'] }));
    const withLunch = (mockTray.setContextMenu.mock.calls.at(-1)![0] as Electron.MenuItemConstructorOptions[]).map((item) => item.label);
    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ availableActions: ['stop', 'forward'] }));
    const withoutLunch = (mockTray.setContextMenu.mock.calls.at(-1)![0] as Electron.MenuItemConstructorOptions[]).map((item) => item.label);

    expect(withLunch).toContain('Lunch (45 min)');
    expect(withoutLunch).not.toContain('Lunch (45 min)');
  });

  test('LUNCH state offers coming back early', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'LUNCH', availableActions: ['start'] });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Back from Lunch');
    expect(labels).not.toContain('Stop');
  });

  test('all states include Show Settings and Quit', () => {
    const mockTray = createMockTray();
    const state = createTimerState();

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Show Settings');
    expect(labels).toContain('Quit');
  });
});

describe('Tray edge cases', () => {
  test('no-op when tray is destroyed', () => {
    const mockTray = createMockTray();
    mockTray.isDestroyed.mockReturnValue(true);
    const state = createTimerState();

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).not.toHaveBeenCalled();
    expect(mockTray.setToolTip).not.toHaveBeenCalled();
  });

  test('no-op when tray is null', () => {
    const state = createTimerState();
    expect(() => updateTray(null as unknown as Electron.Tray, state)).not.toThrow();
  });

  test('OVERDUE displays overdue time, not countdown', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'OVERDUE',
      currentCountdownMs: 0,
      overdueTimeMs: 65000,
      availableActions: ['breaktime'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setToolTip).toHaveBeenCalledWith(expect.stringContaining('01:05'));
  });
});

describe('Tray tooltip', () => {
  test('tooltip shows formatted countdown time', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', currentCountdownMs: 600000 });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setToolTip).toHaveBeenCalledWith('WorkLife — 10:00');
  });

  test('tooltip shows overdue time when in OVERDUE state', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'OVERDUE',
      currentCountdownMs: 0,
      overdueTimeMs: 65000,
      availableActions: ['breaktime'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setToolTip).toHaveBeenCalledWith('WorkLife — 01:05');
  });
});

describe('Tray only replaces what changed', () => {
  // Regression: replacing the menu every tick closed it while open on Linux
  test('menu is not replaced when only the countdown changes', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ currentCountdownMs: 600000 }));
    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ currentCountdownMs: 599000 }));

    expect(mockTray.setContextMenu).toHaveBeenCalledOnce();
  });

  test('menu is replaced when its items change', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ status: 'RUNNING' }));
    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ status: 'STOPPED', availableActions: ['start'] }));

    expect(mockTray.setContextMenu).toHaveBeenCalledTimes(2);
  });

  test('icon is only replaced when the status changes', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ currentCountdownMs: 600000 }));
    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ currentCountdownMs: 599000 }));
    updateTray(mockTray as unknown as Electron.Tray, createTimerState({ isWarning: true }));

    expect(mockTray.setImage).toHaveBeenCalledTimes(2);
    expect(mockTray.setImage).toHaveBeenLastCalledWith(expect.stringContaining('tray-yellow'));
  });
});

describe("Asset paths", () => {

  const expectedIcons = [
    "tray-green.png",
    "tray-yellow.png",
    "tray-orange.png",
    "tray-blue.png",
    "tray-gray.png",
  ];

  it.each(expectedIcons)("%s exists", (filename) => {
    expect(existsSync(path.join(ICON_DIR, filename))).toBe(true);
  });
});
describe('Tray shows today\'s score', () => {
  const getLabels = (mockTray: ReturnType<typeof createMockTray>) => {
    const menuTemplate = mockTray.setContextMenu.mock.calls.at(-1)![0] as Electron.MenuItemConstructorOptions[];
    return menuTemplate.map((item) => item.label).filter(Boolean);
  };
  const createScore = (overrides: Partial<DayScore>) => ({ level: 2, nextCheckpointAt: null, losing: false, ...overrides }) as DayScore;

  test('the menu starts with today\'s checkpoint and when the next one comes', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState(), createScore({ nextCheckpointAt: Date.now() + 60 * 60 * 1000 }));

    expect(getLabels(mockTray)[0]).toMatch(/^Today: Glow · Shine at \d/);
    expect(mockTray.setToolTip).toHaveBeenLastCalledWith(expect.stringContaining('Today: Glow · Shine at'));
  });

  test('says when checkpoints are draining', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState(), createScore({ losing: true }));

    expect(getLabels(mockTray)[0]).toBe('Today: Glow · stopped, losing checkpoints');
  });

  test('shows just the checkpoint when there is no next one today', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState(), createScore({ level: 4 }));

    expect(getLabels(mockTray)[0]).toBe('Today: Radiant');
  });

  test('has no score on a day off', () => {
    const mockTray = createMockTray();

    updateTray(mockTray as unknown as Electron.Tray, createTimerState(), null);

    expect(getLabels(mockTray)[0]).toBe('Show Settings');
  });
});

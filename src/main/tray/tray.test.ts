import { describe, test, expect, vi, beforeEach, it } from 'vitest';
import { DEFAULTS } from '../../shared/constants';
import { updateTray, buildStatusIcons, ICON_DIR } from './tray';
import { TimerState } from '../timer/timerState';
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
    availableActions: ['stop', 'skip'],
    remainingSkips: 3,
    allottedBreaks: 3,
    remainingSnoozes: 3,
    allottedSnoozes: 3,
    snoozeDurationMs: 7 * 60 * 1000,
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
  test('RUNNING state offers Stop and Skip to Break', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING' });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Stop');
    expect(labels).toContain('Skip to Break');
    expect(labels).not.toContain('Resume');
  });

  test('RUNNING state offers Snooze with its length when snoozes remain', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', availableActions: ['stop', 'skip', 'snooze'] });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Snooze +7 min');
  });

  test('RUNNING state hides Snooze when no snoozes remain', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', availableActions: ['stop', 'skip'] });

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

  test('OVERDUE state offers Start Break and Skip Break when skips remain', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'OVERDUE',
      availableActions: ['breaktime', 'skip'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Start Break');
    expect(labels).toContain('Skip Break');
  });

  test('BREAK state hides Skip Break when no skips remain', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'BREAK',
      currentCountdownMs: 30000,
      availableActions: [],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).not.toContain('Skip Break');
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
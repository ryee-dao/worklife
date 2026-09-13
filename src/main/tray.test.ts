import { describe, test, expect, vi, beforeEach } from 'vitest';
import { DEFAULTS } from '../shared/constants';
import { updateTray, buildStatusIcons } from './tray';
import { TimerState } from './timer/timerState';
import { getTimerConfigs } from './timer/timerConfigs';

vi.mock('./timer/timerConfigs', () => ({
  getTimerConfigs: vi.fn(() => ({
    timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
    breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
    warningThresholdMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS,
  })),
}));

vi.mock('./main', () => ({
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
    availableActions: ['pause', 'skip'],
    remainingSkips: 3,
    allotedBreaks: 3,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getTimerConfigs).mockReset();
  vi.mocked(getTimerConfigs).mockReturnValue({
    timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
    breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
    warningThresholdMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS,
  });
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
      currentCountdownMs: DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS - 1000,
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-yellow'));
  });

  test('RUNNING state at exactly zero does not trigger warning', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING', currentCountdownMs: 0 });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-green'));
  });

  test('OVERDUE state shows red icon', () => {
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

  test('PAUSED state shows gray icon', () => {
    const mockTray = createMockTray();
    const state = createTimerState({
      status: 'PAUSED',
      availableActions: ['start'],
    });

    updateTray(mockTray as unknown as Electron.Tray, state);

    expect(mockTray.setImage).toHaveBeenCalledWith(expect.stringContaining('tray-gray'));
  });
});

describe('Tray context/dropdown menu actions', () => {
  test('RUNNING state offers Pause and Skip to Break', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'RUNNING' });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Pause');
    expect(labels).toContain('Skip to Break');
    expect(labels).not.toContain('Resume');
  });

  test('PAUSED state offers Resume', () => {
    const mockTray = createMockTray();
    const state = createTimerState({ status: 'PAUSED', availableActions: ['start'] });

    updateTray(mockTray as unknown as Electron.Tray, state);

    const menuTemplate = mockTray.setContextMenu.mock.calls[0][0] as Electron.MenuItemConstructorOptions[];
    const labels = menuTemplate.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Resume');
    expect(labels).not.toContain('Pause');
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
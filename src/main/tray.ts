import { app, Menu, nativeImage } from 'electron';
import path from 'path';
import { TimerState, TimerStatus, pauseTimer, startTimer, startBreak, skipBreak, skipTimer } from './timer/timerState';
import { getTimerConfigs } from './timer/timerConfigs';
import { formatMsToMMSS } from '../shared/utils/time';
import { settingsWindow } from './main';

type StatusKey = TimerStatus | 'WARNING';

const ICON_DIR = path.join(__dirname, '../assets/icons');
const STATUS_ICON_PATHS = {
  RUNNING: path.join(ICON_DIR, 'tray-green.png'),
  WARNING: path.join(ICON_DIR, 'tray-yellow.png'),
  OVERDUE: path.join(ICON_DIR, 'tray-red.png'),
  BREAK: path.join(ICON_DIR, 'tray-blue.png'),
  PAUSED: path.join(ICON_DIR, 'tray-gray.png'),
} as const;

let statusIcons: Record<StatusKey, Electron.NativeImage>;

export function buildStatusIcons() {
  if (!process.env.PLAYWRIGHT_TEST) {
    statusIcons = {} as Record<StatusKey, Electron.NativeImage>;
    for (const [key, iconPath] of Object.entries(STATUS_ICON_PATHS)) {
      statusIcons[key as StatusKey] = nativeImage.createFromPath(iconPath);
    }
  }
}

function getStatusKey(state: TimerState): StatusKey {
  if (state.status === 'RUNNING') {
    const warningMs = getTimerConfigs().warningThresholdMs;
    if (warningMs && state.currentCountdownMs > 0 && state.currentCountdownMs <= warningMs) {
      return 'WARNING';
    }
  }
  return state.status;
}

export function updateTray(tray: Electron.Tray, state: TimerState) {
  if (!tray || tray.isDestroyed()) return;

  const statusKey = getStatusKey(state);
  const displayTime = formatMsToMMSS(
    state.status === 'OVERDUE' ? state.overdueTimeMs : state.currentCountdownMs
  );

  tray.setImage(statusIcons[statusKey]);

  if (process.platform === 'darwin') {
    tray.setTitle(` ${displayTime}`);
  }

  tray.setToolTip(`WorkLife — ${displayTime}`);

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    { label: 'Show Settings', click: () => settingsWindow?.show() },
    { type: 'separator' },
  ];

  switch (state.status) {
    case 'RUNNING':
      menuTemplate.push({ label: 'Pause', click: pauseTimer });
      menuTemplate.push({ label: 'Skip to Break', click: skipTimer });
      break;
    case 'PAUSED':
      menuTemplate.push({ label: 'Resume', click: startTimer });
      break;
    case 'OVERDUE':
      menuTemplate.push({ label: 'Start Break', click: startBreak });
      if (state.availableActions.includes('skip')) {
        menuTemplate.push({ label: 'Skip Break', click: skipBreak });
      }
      break;
    case 'BREAK':
      if (state.availableActions.includes('skip')) {
        menuTemplate.push({ label: 'Skip Break', click: skipBreak });
      }
      break;
  }

  menuTemplate.push({ type: 'separator' });
  menuTemplate.push({ label: 'Quit', click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));

  // if (process.platform === 'darwin') {
  //   app.dock!.setIcon(statusIcons[statusKey]);
  // }

  if (process.platform === 'win32' && settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setOverlayIcon(statusIcons[statusKey], statusKey);
  }
}
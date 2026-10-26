import { app, Menu, nativeImage, Tray } from 'electron';
import path from 'path';
import { TimerState, TimerStatus, pauseTimer, startTimer, startBreak, skipBreak, skipTimer } from '../timer/timerState';
import { formatMsToMMSS } from '../../shared/utils/time';
import { settingsWindow } from '../windows/settingsWindow';

type StatusKey = TimerStatus | 'WARNING';

export const ICON_DIR = path.join(__dirname, '../../assets/icons');
const STATUS_ICON_PATHS = {
  RUNNING: path.join(ICON_DIR, 'tray-green.png'),
  WARNING: path.join(ICON_DIR, 'tray-yellow.png'),
  OVERDUE: path.join(ICON_DIR, 'tray-orange.png'),
  BREAK: path.join(ICON_DIR, 'tray-blue.png'),
  PAUSED: path.join(ICON_DIR, 'tray-gray.png'),
} as const;

let statusIcons: Record<StatusKey, Electron.NativeImage>;
export let tray: Tray | null = null;

// updateTray runs every tick, but on Linux setting the menu closes it if it's open.
// So remember what was last shown and only replace the icon or menu when it changes.
let lastUpdatedTray: Tray | null = null;
let lastStatusKey: StatusKey | null = null;
let lastMenuLabels = "";
let trayMenu: Electron.Menu | null = null;

export function buildStatusIcons() {
  statusIcons = {} as Record<StatusKey, Electron.NativeImage>;
  for (const [key, iconPath] of Object.entries(STATUS_ICON_PATHS)) {
    statusIcons[key as StatusKey] = nativeImage.createFromPath(iconPath);
  }
}

function getStatusKey(state: TimerState): StatusKey {
  return state.isWarning ? 'WARNING' : state.status;
}

export function updateTray(tray: Electron.Tray, state: TimerState) {
  if (!tray || tray.isDestroyed()) return;

  const statusKey = getStatusKey(state);
  const displayTime = formatMsToMMSS(
    state.status === 'OVERDUE' ? state.overdueTimeMs : state.currentCountdownMs
  );

  const isNewTray = tray !== lastUpdatedTray;
  lastUpdatedTray = tray;

  if (isNewTray || statusKey !== lastStatusKey) {
    tray.setImage(statusIcons[statusKey]);
    lastStatusKey = statusKey;
  }

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
      menuTemplate.push({ label: 'Pause', click: () => pauseTimer('TRAY') });
      menuTemplate.push({ label: 'Skip to Break', click: () => skipTimer('TRAY') });
      break;
    case 'PAUSED':
      menuTemplate.push({ label: 'Resume', click: () => startTimer('TRAY') });
      break;
    case 'OVERDUE':
      menuTemplate.push({ label: 'Start Break', click: () => startBreak('TRAY') });
      if (state.availableActions.includes('skip')) {
        menuTemplate.push({ label: 'Skip Break', click: () => skipBreak('TRAY') });
      }
      break;
    case 'BREAK':
      if (state.availableActions.includes('skip')) {
        menuTemplate.push({ label: 'Skip Break', click: () => skipBreak('TRAY') });
      }
      break;
  }

  menuTemplate.push({ type: 'separator' });
  menuTemplate.push({ label: 'Quit', click: () => app.quit() });

  const menuLabels = menuTemplate.map((item) => item.label).join(",");
  if (isNewTray || menuLabels !== lastMenuLabels) {
    trayMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(trayMenu);
    lastMenuLabels = menuLabels;
  }

  // if (process.platform === 'darwin') {
  //   app.dock!.setIcon(statusIcons[statusKey]);
  // }

  if (process.platform === 'win32' && settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setOverlayIcon(statusIcons[statusKey], statusKey);
  }
}

export function createTray(width: number = 16, height: number = 16) {
  // Each test run would add another icon to the taskbar, so only tray tests turn it on
  if (process.env.PLAYWRIGHT_TEST && !process.env.PLAYWRIGHT_TRAY) {
    return;
  }

  // Set icon for app
  const trayImage = nativeImage.createFromPath(
    path.join(__dirname, "../../assets/dog.png")
  );
  tray = new Tray(trayImage.resize({ width, height }));
  tray.setToolTip("Work Life");
}

// Tests can't right-click the real tray, so they click the menu items directly
if (process.env.PLAYWRIGHT_TEST) {
  global.__test_getTrayMenu = () => trayMenu;
}
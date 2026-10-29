import { app, Menu, nativeImage, Tray } from 'electron';
import path from 'path';
import { TimerState, TimerStatus, stopTimer, startTimer, startBreak, skipBreak, forwardToBreak, snoozeTimer, startLunch } from '../timer/timerState';
import { convertMsToMinutes } from '../../shared/utils/time';
import { DayScore } from '../stats/checkpoints';
import { CHECKPOINTS } from '../../shared/constants';
import { formatMsToMMSS } from '../../shared/utils/time';
import { settingsWindow } from '../windows/settingsWindow';

type StatusKey = TimerStatus | 'WARNING';

export const ICON_DIR = path.join(__dirname, '../../assets/icons');
const STATUS_ICON_PATHS = {
  RUNNING: path.join(ICON_DIR, 'tray-green.png'),
  WARNING: path.join(ICON_DIR, 'tray-yellow.png'),
  OVERDUE: path.join(ICON_DIR, 'tray-orange.png'),
  BREAK: path.join(ICON_DIR, 'tray-blue.png'),
  STOPPED: path.join(ICON_DIR, 'tray-gray.png'),
  LUNCH: path.join(ICON_DIR, 'tray-blue.png'),
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

const formatClockTime = (epochMs: number) => new Date(epochMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// e.g. "Today: Glow · Shine at 3:00 PM". A clock time instead of a countdown, so the menu isn't rebuilt every second
function describeTodayScore(score: DayScore) {
  const today = `Today: ${CHECKPOINTS.NAMES[score.level]}`;
  if (score.losing) return `${today} · stopped, losing checkpoints`;
  if (score.nextCheckpointAt) return `${today} · ${CHECKPOINTS.NAMES[score.level + 1]} at ${formatClockTime(score.nextCheckpointAt)}`;
  return today;
}

function getStatusKey(state: TimerState): StatusKey {
  return state.isWarning ? 'WARNING' : state.status;
}

export function updateTray(tray: Electron.Tray, state: TimerState, todayScore: DayScore | null = null) {
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

  const todayText = todayScore ? describeTodayScore(todayScore) : null;
  tray.setToolTip(todayText ? `WorkLife — ${displayTime} · ${todayText}` : `WorkLife — ${displayTime}`);

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
  if (todayText) {
    menuTemplate.push({ label: todayText, enabled: false });
    menuTemplate.push({ type: 'separator' });
  }
  menuTemplate.push({ label: 'Show Settings', click: () => settingsWindow?.show() });
  menuTemplate.push({ type: 'separator' });

  switch (state.status) {
    case 'RUNNING':
      menuTemplate.push({ label: 'Stop', click: () => stopTimer('TRAY') });
      menuTemplate.push({ label: 'Forward to Break', click: () => forwardToBreak('TRAY') });
      if (state.availableActions.includes('snooze')) {
        menuTemplate.push({ label: `Snooze +${convertMsToMinutes(state.snoozeDurationMs)} min`, click: () => snoozeTimer('TRAY') });
      }
      if (state.availableActions.includes('lunch')) {
        menuTemplate.push({ label: `Lunch (${convertMsToMinutes(state.lunchDurationMs)} min)`, click: () => startLunch('TRAY') });
      }
      break;
    case 'STOPPED':
      menuTemplate.push({ label: 'Resume', click: () => startTimer('TRAY') });
      break;
    case 'OVERDUE':
      menuTemplate.push({ label: 'Start Break', click: () => startBreak('TRAY') });
      if (state.availableActions.includes('lunch')) {
        menuTemplate.push({ label: `Lunch (${convertMsToMinutes(state.lunchDurationMs)} min)`, click: () => startLunch('TRAY') });
      }
      if (state.availableActions.includes('skip')) {
        menuTemplate.push({ label: 'Skip Break', click: () => skipBreak('TRAY') });
      }
      menuTemplate.push({ label: 'Stop', click: () => stopTimer('TRAY') });
      break;
    case 'BREAK':
      if (state.availableActions.includes('skip')) {
        menuTemplate.push({ label: 'Skip Break', click: () => skipBreak('TRAY') });
      }
      menuTemplate.push({ label: 'Stop', click: () => stopTimer('TRAY') });
      break;
    case 'LUNCH':
      menuTemplate.push({ label: 'Back from Lunch', click: () => startTimer('TRAY') });
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
import { BrowserWindow } from "electron";
import path from "path";
import { PRELOAD_PATH, IS_DEV, RENDERER_PATH } from "@main/env";
import { emitTimerStatus } from "@main/timer/timerState";
import { EVENTS } from "@shared/constants";

export let settingsWindow: BrowserWindow | null = null;

export function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: PRELOAD_PATH, // Compiled preload file
    },
    show: false,
  });

  settingsWindow.once('ready-to-show', () => settingsWindow!.show());

  // So the window doesn't wait a tick for its first state
  settingsWindow.webContents.once('did-finish-load', () => {
    emitTimerStatus();
  });

  if (IS_DEV) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/dashboard/`);
  } else {
    settingsWindow.loadFile(path.join(RENDERER_PATH, "dashboard/index.html"));
  }

  return settingsWindow;
}

const ON_TOP_MS = 1000; // Long enough to be seen, then the window goes back to being ordinary

export function showTimerOnTop() {
  settingsWindow!.setAlwaysOnTop(true);
  settingsWindow!.show();
  settingsWindow!.focus();
  setTimeout(() => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.setAlwaysOnTop(false);
    }
  }, ON_TOP_MS);
}

export function showDaySummary(localDate: string) {
  settingsWindow!.show();
  settingsWindow!.focus();
  settingsWindow!.webContents.send(EVENTS.IPC_CHANNELS.STATS_SHOW_DAY, localDate);
}

export function registerSettingsWindowListeners(isForceQuitting: () => boolean) {
  // A getter, since the flag flips after this is registered
  settingsWindow!.on("close", (event) => {
    if (!isForceQuitting()) {
      event.preventDefault(); // Closing hides the window; the app lives in the tray
      settingsWindow!.hide();
    }
  });
}
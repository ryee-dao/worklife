import { BrowserWindow } from "electron";
import path from "path";
import { PRELOAD_PATH, IS_DEV, RENDERER_PATH } from "../env";
import { emitTimerStatus } from "../timer/timerState";

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

  // Only show window when everything is loaded
  settingsWindow.once('ready-to-show', () => settingsWindow!.show());

  // Emit the timer status initially when the setting window first loads 
  // so it doesn't have to wait for first interval
  settingsWindow.webContents.once('did-finish-load', () => {
    emitTimerStatus();
  });

  if (!IS_DEV) {
    settingsWindow.loadFile(path.join(RENDERER_PATH, "dashboard/index.html"));
  } else if (IS_DEV) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/dashboard/`);
  }

  return settingsWindow;
}

export function showTimerOnTop() {
  settingsWindow!.setAlwaysOnTop(true);
  settingsWindow!.show();
  settingsWindow!.focus();
  setTimeout(() => {
    // Set a second grace period so the window issue automatically clicked off
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.setAlwaysOnTop(false);
    }
  }, 1000);
}

export function registerSettingsWindowListeners(isForceQuitting: () => boolean) {
  // Use a getter callback for isForceQuitting as passing the boolean alone won't get updated values
  settingsWindow!.on("close", (event) => {
    if (!isForceQuitting()) {
      // On close, don't actually close, just hide
      event.preventDefault();
      settingsWindow!.hide();
    }
  });
}
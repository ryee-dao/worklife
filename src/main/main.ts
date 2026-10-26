import { app, BrowserWindow } from "electron";
import path from "path";
import { destroyTimers, initTimer } from "./timer/timerState";
import { initLimits } from "./limit/limitState";
import { initEventListeners } from "./events";
import { IS_DEV } from "./env";
import { setWorkArea } from "./display";
import { loadOverdueConfigs } from "./overdue/overdueConfigs";
import { loadDifficultyConfigs } from "./difficulty/difficultyConfigs";
import { loadWorkdayConfigs } from "./workday/workdayConfigs";
import { destroyWorkday, initWorkday } from "./workday/workday";
import { loadTimerConfigs } from "./timer/timerConfigs";
import { buildStatusIcons, createTray, tray } from "./tray/tray";
import { registerDisplayListenersForBreakWindow, setOverdueLevelsArray } from "./windows/breakWindow";
import { createSettingsWindow, registerSettingsWindowListeners, settingsWindow } from "./windows/settingsWindow";
import { initStats, recordAppQuit } from "./stats/stats";

export let forceQuit = false; // Allows app.quit() to bypass logic to minimize on close

// If in dev, set a different app name so if there's a prod version running, it doesn't clash
if (IS_DEV) {
  app.setName('WorkLife-Dev');
  // Set the folder directly, since whether setName also renames it differs by platform
  app.setPath('userData', path.join(app.getPath('appData'), 'WorkLife-Dev'));
}

function initConfigs() {
  loadTimerConfigs();
  loadDifficultyConfigs();
  loadOverdueConfigs();
  loadWorkdayConfigs();
}

function initApp() {
  setWorkArea();
  registerDisplayListenersForBreakWindow()
  initConfigs();
  initLimits();
  initStats();
  initTimer();
  initWorkday();
  initEventListeners();
  buildStatusIcons();
  createSettingsWindow();
  registerSettingsWindowListeners(() => forceQuit)
  createTray()
  setOverdueLevelsArray();
}

// When the app.close() signal is emitted, set a flag {forceQuit}, that tells the app: 
// bypass the hide-to-tray logic 
app.on('before-quit', () => {
  if (!forceQuit) {
    recordAppQuit(); // app.quit() can be called more than once, so only record the first
  }
  forceQuit = true;
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  // Close all windows and timers manually before close in case any can't be closed (ex: closable = false)
  destroyTimers();
  destroyWorkday();
  BrowserWindow.getAllWindows().forEach(win => win.destroy());
});

// Right before quitting, destroy timers so that they won't persist
app.on('will-quit', () => {
  destroyTimers();
});


// Only allow one instance of the app in the same environment at the same time
const firstAppInstance = app.requestSingleInstanceLock();

if (!firstAppInstance) {
  // Another instance exists, quit this one
  app.quit();
} else {
  // This is the first instance, continue normally

  // When a second instance is opened
  app.on("second-instance", () => {
    // Focus the existing window instead
    if (settingsWindow) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.show();
      settingsWindow.focus();
    }
  });

  // Start app
  app.whenReady().then(() => {
    initApp()
  });
}

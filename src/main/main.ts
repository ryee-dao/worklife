import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from "electron";
import path from "path";
import { getHostsFileContent, setHostsFileContent } from "./hostsFile";
import {
  initTimer,
  loadTimerConfigsIntoState,
  pauseTimer,
  skipBreak,
  startTimer,
  timerEmitter,
  TimerState,
} from "./timerState";
import { EVENTS } from "../shared/constants";
import { formatMsToMMSS } from "../shared/utils/time";
import { getTimerSettingsData, updateTimerSettings } from "./settingConfigs";

let settingsWindow: BrowserWindow | null = null;
let breakWindow: BrowserWindow | null = null;

const PRELOAD_PATH = path.join(__dirname, "../preload.js");
export const appEnvironment: "PROD" | "DEV" = determineEnvironment();

function determineEnvironment() {
  if (!process.env.VITE_DEV_SERVER_URL) {
    return "PROD";
  } else {
    return "DEV";
  }
}

function initApp() {
  initTimer();
  createSettingsWindow();
}

// Check if another instance is running
const firstAppInstance = app.requestSingleInstanceLock();
if (!firstAppInstance) {
  // Another instance exists, quit this one
  app.quit();
} else {
  // This is the first instance, continue normally
  
  // When a second instance is opened
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus the existing window instead
    if (settingsWindow) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.show();
      settingsWindow.focus();
    }
  });
  
  // Start app
  app.whenReady().then(initApp);
}

// Sends timer state to the ipc renderer
const broadcastTimerStateToRenderer = (timerState: TimerState) => {
  // Send to settings window
  if (!settingsWindow?.isDestroyed()) {
    settingsWindow?.webContents.send(
      EVENTS.IPC_CHANNELS.TIMER_UPDATE,
      timerState
    );
  }

  if (!breakWindow?.isDestroyed()) {
    breakWindow?.webContents.send(EVENTS.IPC_CHANNELS.TIMER_UPDATE, timerState);
  }
  // Send to break window
};
timerEmitter.on(EVENTS.TIMER.RUNNING, broadcastTimerStateToRenderer);
timerEmitter.on(EVENTS.TIMER.ON_BREAK, broadcastTimerStateToRenderer);
timerEmitter.on(EVENTS.TIMER.PAUSED, broadcastTimerStateToRenderer);
timerEmitter.on(EVENTS.TIMER.START_BREAK, createBreakWindow);
timerEmitter.on(EVENTS.TIMER.STOP_BREAK, closeBreakWindow);

ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_PAUSE, pauseTimer);
ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_BEGIN, startTimer);
ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, skipBreak);

ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIG.LOAD.TIMER, getTimerSettingsData)
ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIG.SAVE.TIMER, (event, config) => {
  // throw new Error("test error")
  updateTimerSettings(config);
})
function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: PRELOAD_PATH, // Compiled preload file
    },
  });
  if (appEnvironment === "PROD") {
    settingsWindow.loadFile(
      path.join(__dirname, "../renderer/dashboard/index.html")
    );
  } else if (appEnvironment === "DEV") {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/dashboard/`);
  }

  settingsWindow.on("close", (event) => {
    event.preventDefault();
    settingsWindow!.hide();
  });

  const trayImage = nativeImage.createFromPath(path.join(__dirname, "../assets/dog.png"))
  let tray = new Tray(trayImage.resize({width: 16, height: 16}));
  tray.setToolTip("Work Life");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Settings",
      click: () => {
        settingsWindow!.show();
      },
    },
    {
      label: "Quit",
      click: () => {
        settingsWindow!.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  return settingsWindow;
}

function createBreakWindow() {
  // breakWindow = new BrowserWindow({
  //   kiosk: true,
  //   webPreferences: {
  //     preload: PRELOAD_PATH, // Compiled preload file
  //   },
  // });
  // breakWindow.setAlwaysOnTop(true, "pop-up-menu");

  breakWindow = new BrowserWindow({
    webPreferences: {
      preload: PRELOAD_PATH, // Compiled preload file
    },
  });
  if (appEnvironment === "PROD") {
    breakWindow.loadFile(path.join(__dirname, "../renderer/break/index.html"));
  } else if (appEnvironment === "DEV") {
    breakWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/break/`);
  }
}

function closeBreakWindow() {
  if (breakWindow && !breakWindow.isDestroyed()) {
    breakWindow.close();
  }
}



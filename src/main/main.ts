import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import path from "path";
import { initTimer } from "./timerState";
import { initLimits, resetDailyLimits } from "./limitState";
import { initEventListeners } from "./events";

export let settingsWindow: BrowserWindow | null = null;
export let breakWindow: BrowserWindow | null = null;

const PRELOAD_PATH = path.join(__dirname, "../preload.js");
export const isDev = !app.isPackaged; // Returns false if packaged into an executible

function initApp() {
  initLimits();
  initTimer();
  initEventListeners();
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
  app.on("second-instance", (event, commandLine, workingDirectory) => {
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

export function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: PRELOAD_PATH, // Compiled preload file
    },
  });
  if (!isDev) {
    settingsWindow.loadFile(
      path.join(__dirname, "../renderer/dashboard/index.html")
    );
  } else if (isDev) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/dashboard/`);
  }

  // On close, don't actually close, just hide the app
  settingsWindow.on("close", (event) => {
    event.preventDefault();
    settingsWindow!.hide();
  });

  // Set icon for app
  const trayImage = nativeImage.createFromPath(
    path.join(__dirname, "../assets/dog.png")
  );
  let tray = new Tray(trayImage.resize({ width: 16, height: 16 }));
  tray.setToolTip("Work Life");

  // Build tray menu
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

export function createBreakWindow() {
  // Init break window
  breakWindow = new BrowserWindow({
    webPreferences: {
      preload: PRELOAD_PATH, // Compiled preload file
    },
  });

  // Make this into "if !!isDev" if you are developing and want the break window to be full screen
  if (!isDev) {
    setTimeout(() => {
      breakWindow!.setKiosk(true); // Add a delay as it sometimes shows blank screen with Mac if not
    }, 500);
    breakWindow.setAlwaysOnTop(true, "pop-up-menu");
  }

  // Render the break window html
  if (!isDev) {
    breakWindow.loadFile(path.join(__dirname, "../renderer/break/index.html"));
  } else if (isDev) {
    breakWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/break/`);
  }
}

export function closeBreakWindow() {
  if (breakWindow && !breakWindow.isDestroyed()) {
    breakWindow.close();
  }
}

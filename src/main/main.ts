import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import path from "path";
import { destroyTimers, initTimer } from "./timerState";
import { initLimits } from "./limitState";
import { initEventListeners } from "./events";
export let settingsWindow: BrowserWindow | null = null;
export let breakWindow: BrowserWindow | null = null;

const PRELOAD_PATH = path.join(__dirname, "../preload.js");
export const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL; // Returns false if packaged into an executible
let forceQuit = false; // Allows app.quit() to bypass tray logic
const isTest = !!process.env.PLAYWRIGHT_TEST;

process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});
process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});

function initApp() {
  initLimits();
  initTimer();
  initEventListeners();
  createSettingsWindow();
}

// When the app.close() signal is emitted, set a flag that tells the app: 
// bypass the hide to tray logic 
app.on('before-quit', () => {
  forceQuit = true;
});

// Right before quitting, destroy timers so that they won't persist
app.on('will-quit', () => {
  destroyTimers();
});

// Check if another instance is running
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
    if (!forceQuit) {
      event.preventDefault();
      settingsWindow!.hide();
    }
  });

  // Set icon for app
  const trayImage = nativeImage.createFromPath(
    path.join(__dirname, "../assets/dog.png")
  );
  const tray = new Tray(trayImage.resize({ width: 16, height: 16 }));
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
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: PRELOAD_PATH, // Compiled preload file
    },
  });

  // Render the break window html
  if (!isDev) {
    breakWindow.loadFile(path.join(__dirname, "../renderer/break/index.html"));
  } else if (isDev) {
    breakWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/break/`);
  }

  // Render the break window once it's ready
  breakWindow.once('ready-to-show', () => {
    breakWindow!.show();
    // Make this into "if !!isDev" if you are developing and want the break window to be full screen
    if (!isDev && !isTest) {
      breakWindow!.setAlwaysOnTop(true, "pop-up-menu");
      setTimeout(() => breakWindow!.setKiosk(true), 0);
    }
  });


}

export function closeBreakWindow() {
  if (breakWindow && !breakWindow.isDestroyed()) {
    breakWindow.close();
  }
}

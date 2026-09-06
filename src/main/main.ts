import { app, BrowserWindow, Menu, Tray, nativeImage, screen, Size } from "electron";
import path from "path";
import { destroyTimers, emitTimerStatus, initTimer, TimerState } from "./timer/timerState";
import { initLimits } from "./limit/limitState";
import { initEventListeners } from "./events";
import {
  clampRectToWorkArea,
  convertOverdueLevelObjectToScreenSize,
  convertOverdueTimeToOverdueLevelObject,
  createOverdueLevelsArray,
  OverdueLevelObject
} from "./overdue/overdueGeometry";
import { getOverdueConfigs, loadOverdueConfigs } from "./overdue/overdueConfigs";
import { loadLimitConfigs } from "./limit/limitConfigs";
import { loadTimerConfigs } from "./timer/timerConfigs";
export let settingsWindow: BrowserWindow | null = null;
export let breakWindow: BrowserWindow | null = null;

const PRELOAD_PATH = path.join(__dirname, "../preload.js");
export const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL; // Returns false if packaged into an executible
let forceQuit = false; // Allows app.quit() to bypass tray logic
const isTest = !!process.env.PLAYWRIGHT_TEST;

// Constants related to overdue resizing logic
let lastAppliedOverdueLevelIdx: number = -1;
let currentOverdueSize: Size | undefined;

function initConfigs() {
  loadTimerConfigs();
  loadLimitConfigs();
  loadOverdueConfigs();
}

function initApp() {
  setWorkArea();
  listenForDisplayChanges();
  initConfigs();
  initLimits();
  initTimer();
  initEventListeners();
  createSettingsWindow();
  setOverdueLevelsArray();
}

// Handle whenever the screen size changes like for external monitors
function listenForDisplayChanges() {
  const handleDisplayChange = () => {
    setWorkArea();
    if (breakWindow && !breakWindow.isDestroyed() && currentOverdueSize && workArea) {
      const bounds = breakWindow.getBounds();
      const clamped = clampRectToWorkArea({ ...bounds, ...currentOverdueSize }, workArea);
      breakWindow.setBounds(clamped);
    }
  };

  screen.on('display-metrics-changed', handleDisplayChange);
  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
}

// Set the user's work area size
let workArea: Electron.Rectangle | undefined = undefined;
const setWorkArea = () => {
  workArea = screen.getPrimaryDisplay().workArea; // { x, y, width, height }
};


let overdueLevelsArray: OverdueLevelObject[];
export const setOverdueLevelsArray = () => {
  const overdueConfigs = getOverdueConfigs()
  overdueLevelsArray = createOverdueLevelsArray(overdueConfigs);
}

// When the app.close() signal is emitted, set a flag {forceQuit}, that tells the app: 
// bypass the hide-to-tray logic 
app.on('before-quit', () => {
  forceQuit = true;
  // Close all windows manually before close in case any can't be closed (ex: closable = false)
  BrowserWindow.getAllWindows().forEach(win => win.destroy());
});

// Right before quitting, destroy timers so that they won't persist
app.on('will-quit', () => {
  destroyTimers();
});

// If in dev, set a different app name so if there's a prod version running, it doesn't clash
if (isDev) {
  app.setName('WorkLife-Dev');
  app.setPath('userData', app.getPath('userData').replace('WorkLife', 'WorkLife-Dev'));
}

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

export function showTimerOnTop() {
  settingsWindow!.setAlwaysOnTop(true);
  settingsWindow!.show();
  settingsWindow!.focus();
  setInterval(() => {
    // Add a delay of a second before allowing window to close 
    settingsWindow!.setAlwaysOnTop(false);
  }, 1 * 1000)
}

export function createBreakWindow() {
  // Init break/overdue window
  breakWindow = new BrowserWindow({
    show: false,
    backgroundColor: '#000000',
    minimizable: false,
    maximizable: false,
    resizable: false, // Comment this back out if window ever needs to be resizable again
    closable: false,
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
    // Make this into "if !!isDev" if you are developing and want the overdue window to always be on top
    if (!isDev && !isTest) {
      breakWindow!.setAlwaysOnTop(true, "pop-up-menu");
    }
  });

  // Emit the timer status when the break window loads
  breakWindow.webContents.once('did-finish-load', () => {
    emitTimerStatus();
  });

  // Keep the overdue window inside the screen when dragged toward an edge (a "wall")
  breakWindow.on("will-move", (event, newBounds) => {
    if (!breakWindow || breakWindow.isDestroyed() || !workArea || !currentOverdueSize) return;

    // Clamp using our stored TRUE size, not newBounds' size. On Windows/DPI scaling,
    // setBounds rounds sub-pixel sizes, and reading that back each move would let the
    // window grow a pixel at a time. Using the authoritative size breaks that feedback loop.
    const trueBounds = {
      x: newBounds.x,
      y: newBounds.y,
      width: currentOverdueSize.width,
      height: currentOverdueSize.height,
    };
    const clamped = clampRectToWorkArea(trueBounds, workArea);

    // Only intervene if the move actually went out of bounds — otherwise let the
    // native drag proceed so it feels smooth
    if (clamped.x !== newBounds.x || clamped.y !== newBounds.y) {
      event.preventDefault();          // cancel the OS's out-of-bounds move
      breakWindow.setBounds(clamped);  // re-assert position AND known-good size
    }
  });

  // For Mac
  breakWindow.on("move", () => {
    if (!breakWindow || breakWindow.isDestroyed() || !workArea || !currentOverdueSize) return;

    const bounds = breakWindow.getBounds();
    const trueBounds = {
      x: bounds.x,
      y: bounds.y,
      width: currentOverdueSize.width,
      height: currentOverdueSize.height,
    };
    const clamped = clampRectToWorkArea(trueBounds, workArea);

    if (clamped.x !== bounds.x || clamped.y !== bounds.y) {
      breakWindow.setBounds(clamped);
    }
  });

  // If minimized, bring it back to screen
  breakWindow.on('minimize', () => {
    setTimeout(() => {
      if (breakWindow && !breakWindow.isDestroyed()) {
        breakWindow.restore();
        breakWindow.focus();
      }
    }, 250);
  });
}

export function activateKioskModeForBreakWindow() {
  // Make this into "if !!isDev" if you are developing and want the break window to be full screen
  if (!isDev && !isTest) {
    setTimeout(() => breakWindow!.setKiosk(true), 0);
  }
}

export function closeBreakWindow() {
  if (breakWindow && !breakWindow.isDestroyed()) {
    breakWindow.destroy();
    breakWindow = null;
    // Reset overdue-session state so the next overdue period starts clean
    // (and the will-move handler no-ops until the first level applies)
    currentOverdueSize = undefined;
    lastAppliedOverdueLevelIdx = -1;
  }
}

export const resizeBreakWindow = (timerState: TimerState) => {
  const overdueLevelObject = convertOverdueTimeToOverdueLevelObject(
    timerState.overdueTimeMs,
    overdueLevelsArray
  )
  console.log(overdueLevelObject)

  // Only resize when crossing into a new level — not every tick
  if (lastAppliedOverdueLevelIdx < overdueLevelObject.levelIdx) {
    const resizedScreenSize = convertOverdueLevelObjectToScreenSize(
      { height: workArea!.height, width: workArea!.width },
      overdueLevelObject
    )
    const windowCoords = breakWindow!.getBounds()
    const desiredBounds = { x: windowCoords.x, y: windowCoords.y, ...resizedScreenSize };
    const clampedBounds = clampRectToWorkArea(desiredBounds, workArea!);
    breakWindow!.setBounds(clampedBounds);
    // Store the size we intended, so the clamp handler can re-assert it instead of
    // reading back the window's (DPI-rounding-drifted) size — prevents growth on repeated moves
    currentOverdueSize = { width: resizedScreenSize.width, height: resizedScreenSize.height };
    lastAppliedOverdueLevelIdx = overdueLevelObject.levelIdx;
  }
}
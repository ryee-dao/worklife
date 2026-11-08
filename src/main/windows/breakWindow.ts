import { BrowserWindow, Rectangle, Size, screen } from "electron";
import { PRELOAD_PATH, IS_DEV, IS_TEST, RENDERER_PATH } from "@main/env";
import { getWorkArea, refreshWorkAreaForBounds, setWorkArea } from "@main/display";
import { clampRectToWorkArea, convertOverdueLevelObjectToScreenSize, convertOverdueTimeToOverdueLevelObject, createOverdueLevelsArray, OverdueLevelObject } from "@main/overdue/overdueGeometry";
import { emitTimerStatus, TimerState, TimerStatus, getTimerState } from "@main/timer/timerState";
import { getAppliedOverdueConfigs } from "@main/overdue/overdueConfigs";
import path from "path";

// Constants related to overdue resizing logic
// Kiosk and always-on-top get in the way of dev tools and test runners
const PINS_WINDOWS = !IS_DEV && !IS_TEST;
const RESTORE_AFTER_MINIMIZE_MS = 250;

let lastAppliedOverdueLevelIdx: number = -1;
let currentOverdueSize: Size | undefined;

export let breakWindow: BrowserWindow | null = null;
// The status the window opens on: the timer's, or the tour's clock while a tour owns the window
export function createBreakWindow(status: () => TimerStatus = () => getTimerState().status) {
  breakWindow = new BrowserWindow({
    show: false,
    backgroundColor: '#000000',
    minimizable: false,
    maximizable: false,
    resizable: false, // Kiosk mode turns it back on, see activateKioskModeForBreakWindow
    closable: false,
    webPreferences: {
      preload: PRELOAD_PATH, // Compiled preload file
    },
  });

  if (IS_DEV) {
    breakWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/break/`);
  } else {
    breakWindow.loadFile(path.join(RENDERER_PATH, "break/index.html"));
  }

  breakWindow.once('ready-to-show', () => {
    breakWindow!.show();
    if (PINS_WINDOWS) {
      breakWindow!.setAlwaysOnTop(true, "pop-up-menu");
    }

    if (status() === "BREAK") {
      activateKioskModeForBreakWindow();
    }
  });

  // So the window doesn't wait a tick for its first state
  breakWindow.webContents.once('did-finish-load', () => {
    emitTimerStatus();
  });

  // The window can't be dragged off the screen. The move is only touched when it went out of bounds, so dragging stays smooth
  breakWindow.on("will-move", (event, newBounds) => {
    const clamped = clampedMove(newBounds);
    if (clamped) {
      event.preventDefault();
      breakWindow!.setBounds(clamped);
    }
  });

  // Mac doesn't fire will-move, so there the correction comes after the move
  breakWindow.on("move", () => {
    const clamped = clampedMove(breakWindow!.getBounds());
    if (clamped) breakWindow!.setBounds(clamped);
  });

  // Minimizing it is not a way out
  breakWindow.on('minimize', () => {
    setTimeout(() => {
      if (breakWindow && !breakWindow.isDestroyed()) {
        breakWindow.restore();
        breakWindow.focus();
      }
    }, RESTORE_AFTER_MINIMIZE_MS);
  });

}

// Where a move must be put back, or null when it stayed on screen. Clamped with the size this module set rather than the one read
// back: on Windows with DPI scaling setBounds rounds, and re-reading each move would let the window grow a pixel at a time
const clampedMove = ({ x, y }: { x: number; y: number }) => {
  const workArea = getWorkArea();
  if (!breakWindow || breakWindow.isDestroyed() || !workArea || !currentOverdueSize) return null;
  const clamped = clampRectToWorkArea({ x, y, ...currentOverdueSize }, workArea);
  return clamped.x !== x || clamped.y !== y ? clamped : null;
};

export function activateKioskModeForBreakWindow() {
  // shortcut: an earlier build wrapped this in setTimeout(0) against a flash on Mac; restore it with a why if a Mac test shows the flash
  if (PINS_WINDOWS && breakWindow) {
    breakWindow.setResizable(true)
    breakWindow.setKiosk(true)
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

// Grows the window with the overdue time, on the user's levels or the tour's
export const resizeBreakWindow = (timerState: TimerState, levels: OverdueLevelObject[] = overdueLevelsArray) => {
  if (!breakWindow || breakWindow.isDestroyed()) return;
  const overdueLevelObject = convertOverdueTimeToOverdueLevelObject(
    timerState.overdueTimeMs,
    levels
  )

  // Only resize when crossing into a new level — not every tick
  if (lastAppliedOverdueLevelIdx < overdueLevelObject.levelIdx) {
    const workArea = getWorkArea()!;
    const resizedScreenSize = convertOverdueLevelObjectToScreenSize(
      { height: workArea.height, width: workArea.width },
      overdueLevelObject
    )
    const windowCoords = breakWindow!.getBounds()
    const desiredBounds = { x: windowCoords.x, y: windowCoords.y, ...resizedScreenSize };
    const clampedBounds = clampRectToWorkArea(desiredBounds, workArea);
    breakWindow!.setBounds(clampedBounds);
    // Store the size we intended, so the clamp handler can re-assert it instead of
    // reading back the window's (DPI-rounding-drifted) size — prevents growth on repeated moves
    currentOverdueSize = { width: resizedScreenSize.width, height: resizedScreenSize.height };
    lastAppliedOverdueLevelIdx = overdueLevelObject.levelIdx;
  }
}

// Puts the window in the corner of the work area farthest from another window, so what that window shows stays readable as this one grows
export const moveBreakWindowAwayFrom = (other: Rectangle) => {
  const workArea = getWorkArea();
  if (!breakWindow || breakWindow.isDestroyed() || !workArea) return;
  const { width, height } = breakWindow.getBounds();
  const otherOnTheLeft = other.x + other.width / 2 < workArea.x + workArea.width / 2;
  const otherAtTheTop = other.y + other.height / 2 < workArea.y + workArea.height / 2;
  breakWindow.setPosition(
    otherOnTheLeft ? workArea.x + workArea.width - width : workArea.x,
    otherAtTheTop ? workArea.y + workArea.height - height : workArea.y,
  );
};

let overdueLevelsArray: OverdueLevelObject[];
export const setOverdueLevelsArray = () => {
  const overdueConfigs = getAppliedOverdueConfigs()
  overdueLevelsArray = createOverdueLevelsArray(overdueConfigs);
}

export function registerDisplayListenersForBreakWindow() {
  const handleDisplayChange = () => {
    if (breakWindow && !breakWindow.isDestroyed() && currentOverdueSize) {
      refreshWorkAreaForBounds(breakWindow.getBounds());
      const clamped = clampRectToWorkArea(
        { ...breakWindow.getBounds(), ...currentOverdueSize },
        getWorkArea()!
      );
      breakWindow.setBounds(clamped);
    } else {
      setWorkArea(); // no break window — just keep primary fresh
    }
  };
  screen.on('display-metrics-changed', handleDisplayChange);
  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
}
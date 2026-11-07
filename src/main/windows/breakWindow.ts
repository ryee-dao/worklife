import { BrowserWindow, Rectangle, Size, screen } from "electron";
import { setWorkArea, workArea } from "@main/display";
import { PRELOAD_PATH, IS_DEV, IS_TEST, RENDERER_PATH } from "@main/env";
import { getWorkArea, refreshWorkAreaForBounds } from "@main/display";
import { clampRectToWorkArea, convertOverdueLevelObjectToScreenSize, convertOverdueTimeToOverdueLevelObject, createOverdueLevelsArray, OverdueLevelObject } from "@main/overdue/overdueGeometry";
import { emitTimerStatus, TimerState, TimerStatus, getTimerState } from "@main/timer/timerState";
import { getAppliedOverdueConfigs } from "@main/overdue/overdueConfigs";
import path from "path";

// Constants related to overdue resizing logic
let lastAppliedOverdueLevelIdx: number = -1;
export let currentOverdueSize: Size | undefined;

export let breakWindow: BrowserWindow | null = null;
// The status the window opens on: the timer's, or the tour's clock while a tour owns the window
export function createBreakWindow(status: () => TimerStatus = () => getTimerState().status) {
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
  if (!IS_DEV) {
    breakWindow.loadFile(path.join(RENDERER_PATH, "break/index.html"));
  } else if (IS_DEV) {
    breakWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/break/`);
  }

  // Render the break window once it's ready
  breakWindow.once('ready-to-show', () => {
    breakWindow!.show();
    // Make this into "if !!IS_DEV" if you are developing and want the overdue window to always be on top
    if (!IS_DEV && !IS_TEST) {
      breakWindow!.setAlwaysOnTop(true, "pop-up-menu");
    }

    if (status() === "BREAK") {
      activateKioskModeForBreakWindow();
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
  // Make this into "if !!IS_DEV" if you are developing and want the break window to be full screen
  if (!IS_DEV && !IS_TEST) {
    // setTimeout(() => {
    if (breakWindow) {
      breakWindow.setResizable(true)
      breakWindow.setKiosk(true)
    }
    // }, 0);
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

// Puts the window in the corner of the work area farthest from another window, so what that window shows stays readable as this one grows
export const moveBreakWindowAwayFrom = (other: Rectangle) => {
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
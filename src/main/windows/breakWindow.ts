import { BrowserWindow, Size, screen } from "electron";
import { setWorkArea, workArea } from "../display";
import { PRELOAD_PATH, IS_DEV, IS_TEST, RENDERER_PATH } from "../env";
import { getWorkArea, refreshWorkAreaForBounds } from "../display";
import { clampRectToWorkArea, convertOverdueLevelObjectToScreenSize, convertOverdueTimeToOverdueLevelObject, createOverdueLevelsArray, OverdueLevelObject } from "../overdue/overdueGeometry";
import { emitTimerStatus, TimerState } from "../timer/timerState";
import { getOverdueConfigs } from "../overdue/overdueConfigs";
import path from "path";

// Constants related to overdue resizing logic
let lastAppliedOverdueLevelIdx: number = -1;
export let currentOverdueSize: Size | undefined;

export let breakWindow: BrowserWindow | null = null;
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
    setTimeout(() => {
      breakWindow!.setKiosk(true)
      breakWindow!.setResizable(true)
    }, 0);
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

let overdueLevelsArray: OverdueLevelObject[];
export const setOverdueLevelsArray = () => {
  const overdueConfigs = getOverdueConfigs()
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
import { BrowserWindow, ipcMain } from "electron";
import { updateTray } from './tray';
import { tray } from './main';
import { EVENTS } from "../shared/constants";
import { getLimitConfigs, LimitConfigs, setLimitConfigs } from "./limit/limitConfigs";
import { increaseSkippedBreakCount } from "./limit/limitState";
import { getTimerConfigs, setTimerConfigs, TimerConfigs } from "./timer/timerConfigs";
import {
  timerEmitter,
  pauseTimer,
  startTimer,
  skipBreak,
  TimerState,
  skipTimer,
  loadTimerConfigsIntoState,
  startBreak,
} from "./timer/timerState";
import {
  activateKioskModeForBreakWindow,
  breakWindow,
  closeBreakWindow,
  createBreakWindow,
  resizeBreakWindow,
  setOverdueLevelsArray,
  settingsWindow,
  showTimerOnTop,
} from "./main";
import { getOverdueConfigs, loadOverdueConfigs, OverdueConfigs, setOverdueConfigs } from "./overdue/overdueConfigs";

export const broadcastStateToRendererWindows = (
  state: unknown,
  windows: Array<BrowserWindow | null>,
  sendEvent: string
) => {
  for (const window of windows) {
    if (window && !window.isDestroyed()) {
      window.webContents.send(sendEvent, state);
    }
  }
};

export const initEventListeners = () => {
  timerEmitter.on(EVENTS.TIMER.RUNNING, (state: TimerState) => {
    updateTray(tray!, state);
    broadcastStateToRendererWindows(
      state,
      [settingsWindow, breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });

  timerEmitter.on(EVENTS.TIMER.ON_BREAK, (state: TimerState) => {
    updateTray(tray!, state);
    broadcastStateToRendererWindows(
      state,
      [settingsWindow, breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });

  timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, (state: TimerState) => {
    updateTray(tray!, state);
    broadcastStateToRendererWindows(
      state,
      [settingsWindow, breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });

  timerEmitter.on(EVENTS.TIMER.PAUSED, (state: TimerState) => {
    updateTray(tray!, state);
    broadcastStateToRendererWindows(
      state,
      [settingsWindow, breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });

  timerEmitter.on(EVENTS.TIMER.WARNING, () => {
    broadcastStateToRendererWindows(
      null,
      [settingsWindow],
      EVENTS.IPC_CHANNELS.TIMER_WARNING
    );
  });

  timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, (timerState: TimerState) => {
    resizeBreakWindow(timerState);
  });
  timerEmitter.on(EVENTS.TIMER.WARNING, showTimerOnTop);
  timerEmitter.on(EVENTS.TIMER.START_OVERDUE, createBreakWindow);
  timerEmitter.on(EVENTS.TIMER.STOP_BREAK, closeBreakWindow);
  timerEmitter.on(EVENTS.TIMER.STOP_BREAK, () => {  // This ensures configs are loaded only after break
    loadOverdueConfigs();
    setOverdueLevelsArray();
    loadTimerConfigsIntoState();
  });

  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_PAUSE, pauseTimer);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_BEGIN, startTimer);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_STARTBREAK, startBreak);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_STARTBREAK, activateKioskModeForBreakWindow);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, skipBreak);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, increaseSkippedBreakCount);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPTIMER, skipTimer);

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.TIMER, getTimerConfigs);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIGS.SAVE.TIMER,
    (event, configs: TimerConfigs) => {
      // throw new Error("test error")
      setTimerConfigs(configs)
    }
  );

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.LIMIT, getLimitConfigs);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIGS.SAVE.LIMIT,
    (event, configs: LimitConfigs) => {
      // throw new Error("test error")
      setLimitConfigs(configs);
    }
  );

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.OVERDUE, getOverdueConfigs);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIGS.SAVE.OVERDUE,
    (event, configs: OverdueConfigs) => {
      setOverdueConfigs(configs);
    }
  );
};

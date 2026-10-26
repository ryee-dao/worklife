import { BrowserWindow, ipcMain } from "electron";
import { tray, updateTray } from './tray/tray';
import { EVENTS } from "../shared/constants";
import { applyDifficultyConfigs, DifficultyConfigs, getDifficultyConfigs, setDifficultyConfigs } from "./difficulty/difficultyConfigs";
import { applyTimerConfigs, getTimerConfigs, setTimerConfigs, TimerConfigs } from "./timer/timerConfigs";
import {
  timerEmitter,
  pauseTimer,
  startTimer,
  skipBreak,
  TimerState,
  skipTimer,
  startBreak,
  getTimerState,
} from "./timer/timerState";

import { applyOverdueConfigs, getOverdueConfigs, OverdueConfigs, setOverdueConfigs } from "./overdue/overdueConfigs";
import { getWorkdayConfigs, setWorkdayConfigs, WorkdayConfigs } from "./workday/workdayConfigs";
import { breakWindow, resizeBreakWindow, createBreakWindow, closeBreakWindow, setOverdueLevelsArray, activateKioskModeForBreakWindow } from "./windows/breakWindow";
import { settingsWindow, showTimerOnTop } from "./windows/settingsWindow";

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
  timerEmitter.on(EVENTS.TIMER.START_BREAK, activateKioskModeForBreakWindow);
  timerEmitter.on(EVENTS.TIMER.STOP_BREAK, closeBreakWindow);
  timerEmitter.on(EVENTS.TIMER.STOP_BREAK, () => {  // Saved configs only take effect after a break
    applyTimerConfigs();
    applyDifficultyConfigs();
    applyOverdueConfigs();
    setOverdueLevelsArray();
  });

  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_PAUSE, () => pauseTimer("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_BEGIN, () => startTimer("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_STARTBREAK, () => startBreak("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, () => skipBreak("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPTIMER, () => skipTimer("WINDOW"));

  ipcMain.handle(EVENTS.IPC_CHANNELS.TIMER_GETSTATE, getTimerState);
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.TIMER, getTimerConfigs);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIGS.SAVE.TIMER,
    (event, configs: TimerConfigs) => {
      // throw new Error("test error")
      setTimerConfigs(configs)
    }
  );

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.DIFFICULTY, getDifficultyConfigs);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIGS.SAVE.DIFFICULTY,
    (event, configs: DifficultyConfigs) => {
      setDifficultyConfigs(configs);
    }
  );

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.OVERDUE, getOverdueConfigs);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIGS.SAVE.OVERDUE,
    (event, configs: OverdueConfigs) => {
      setOverdueConfigs(configs);
    }
  );

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.WORKDAY, getWorkdayConfigs);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIGS.SAVE.WORKDAY,
    (event, configs: WorkdayConfigs) => {
      setWorkdayConfigs(configs);
    }
  );
};

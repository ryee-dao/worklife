import { BrowserWindow, ipcMain } from "electron";
import { EVENTS, FILENAMES } from "../shared/constants";
import { writeToUserDataFile } from "../shared/utils/files";
import { getLimitSettingsData, LimitConfig } from "./limitConfigs";
import { increaseSkippedBreakCount } from "./limitState";
import { getTimerSettingsData, TimerConfig } from "./timerConfigs";
import {
  timerEmitter,
  pauseTimer,
  startTimer,
  skipBreak,
  TimerState,
  skipTimer,
} from "./timerState";
import {
  breakWindow,
  closeBreakWindow,
  createBreakWindow,
  settingsWindow,
} from "./main";

export const broadcastStateToRendererWindows = (
  state: unknown,
  windows: Array<BrowserWindow | null>,
  sendEvent: string
) => {
  for (let window of windows) {
    if (window && !window.isDestroyed()) {
      window.webContents.send(sendEvent, state);
    }
  }
};

export const initEventListeners = () => {
  timerEmitter.on(EVENTS.TIMER.RUNNING, (state: TimerState) => {
    broadcastStateToRendererWindows(
      state,
      [settingsWindow, breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });

  timerEmitter.on(EVENTS.TIMER.ON_BREAK, (state: TimerState) => {
    broadcastStateToRendererWindows(
      state,
      [settingsWindow, breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });

  timerEmitter.on(EVENTS.TIMER.PAUSED, (state: TimerState) => {
    broadcastStateToRendererWindows(
      state,
      [settingsWindow, breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });

  timerEmitter.on(EVENTS.TIMER.ON_BREAK, (state: TimerState) => {
    broadcastStateToRendererWindows(
      state,
      [breakWindow],
      EVENTS.IPC_CHANNELS.TIMER_UPDATE
    );
  });


  timerEmitter.on(EVENTS.TIMER.START_BREAK, createBreakWindow);
  timerEmitter.on(EVENTS.TIMER.STOP_BREAK, closeBreakWindow);

  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_PAUSE, pauseTimer);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_BEGIN, startTimer);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, skipBreak);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, increaseSkippedBreakCount);
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPTIMER, skipTimer);

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIG.LOAD.TIMER, getTimerSettingsData);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIG.SAVE.TIMER,
    (event, config: TimerConfig) => {
      // throw new Error("test error")
      writeToUserDataFile(FILENAMES.TIMER.SETTINGS, config);
    }
  );

  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIG.LOAD.LIMIT, getLimitSettingsData);
  ipcMain.handle(
    EVENTS.IPC_CHANNELS.CONFIG.SAVE.LIMIT,
    (event, config: LimitConfig) => {
      // throw new Error("test error")
      writeToUserDataFile(FILENAMES.LIMIT.SETTINGS, config);
    }
  );
};

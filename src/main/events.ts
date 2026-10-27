import { BrowserWindow, ipcMain } from "electron";
import { tray, updateTray } from './tray/tray';
import { EVENTS } from "../shared/constants";
import { applyDifficultyConfigs, DifficultyConfigs, getDifficultyConfigs, setDifficultyConfigs } from "./difficulty/difficultyConfigs";
import { applyTimerConfigs, getTimerConfigs, setTimerConfigs, TimerConfigs } from "./timer/timerConfigs";
import {
  timerEmitter,
  stopTimer,
  startTimer,
  skipBreak,
  TimerState,
  skipTimer,
  snoozeTimer,
  startBreak,
  getTimerState,
} from "./timer/timerState";

import { applyOverdueConfigs, getOverdueConfigs, OverdueConfigs, setOverdueConfigs } from "./overdue/overdueConfigs";
import { getWorkdayConfigs, setWorkdayConfigs, WorkdayConfigs } from "./workday/workdayConfigs";
import { breakWindow, resizeBreakWindow, createBreakWindow, closeBreakWindow, setOverdueLevelsArray, activateKioskModeForBreakWindow } from "./windows/breakWindow";
import { settingsWindow, showTimerOnTop } from "./windows/settingsWindow";
import { getAllDayScores, getCurrentDayScore, takeUnseenSummaryDate } from "./stats/stats";

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

// Sends every timer update, along with today's score, to the tray and windows
const onTimerUpdate = (state: TimerState) => {
  const todayScore = getCurrentDayScore();
  updateTray(tray!, state, todayScore);
  broadcastStateToRendererWindows(state, [settingsWindow, breakWindow], EVENTS.IPC_CHANNELS.TIMER_UPDATE);
  broadcastStateToRendererWindows(todayScore, [settingsWindow], EVENTS.IPC_CHANNELS.STATS_TODAY);
};

export const initEventListeners = () => {
  timerEmitter.on(EVENTS.TIMER.RUNNING, onTimerUpdate);
  timerEmitter.on(EVENTS.TIMER.ON_BREAK, onTimerUpdate);
  timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, onTimerUpdate);
  timerEmitter.on(EVENTS.TIMER.STOPPED, onTimerUpdate);

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

  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_STOP, () => stopTimer("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_BEGIN, () => startTimer("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_STARTBREAK, () => startBreak("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, () => skipBreak("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPTIMER, () => skipTimer("WINDOW"));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SNOOZE, () => snoozeTimer("WINDOW"));

  ipcMain.handle(EVENTS.IPC_CHANNELS.TIMER_GETSTATE, getTimerState);
  ipcMain.handle(EVENTS.IPC_CHANNELS.STATS_GET_DAYS, getAllDayScores);
  ipcMain.handle(EVENTS.IPC_CHANNELS.STATS_TAKE_UNSEEN_SUMMARY, takeUnseenSummaryDate);
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

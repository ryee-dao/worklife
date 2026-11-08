import { BrowserWindow, ipcMain } from "electron";
import { tray, updateTray } from './tray/tray';
import { EVENTS } from "@shared/constants";
import { applyDifficultyConfigs, DifficultyConfigs, getDifficultyConfigs, setDifficultyConfigs } from "./difficulty/difficultyConfigs";
import { applyTimerConfigs, getTimerConfigs, setTimerConfigs, TimerConfigs } from "./timer/timerConfigs";
import {
  timerEmitter,
  stopTimer,
  startTimer,
  skipBreak,
  TimerState,
  forwardToBreak,
  snoozeTimer,
  startLunch,
  startBreak,
  emitTimerStatus,
  AvailableActions,
  Source,
} from "./timer/timerState";

import { applyOverdueConfigs, getOverdueConfigs, OverdueConfigs, setOverdueConfigs } from "./overdue/overdueConfigs";
import { applyWorkdayConfigs, getWorkdayConfigs, setWorkdayConfigs, WorkdayConfigs } from "./workday/workdayConfigs";
import { getSoundConfigs, setSoundConfigs, SoundConfigs } from "./sound/soundConfigs";
import { IS_DEV } from "./env";
import { resetTodayLimits } from "./limit/limitState";
import { breakWindow, resizeBreakWindow, createBreakWindow, closeBreakWindow, setOverdueLevelsArray, activateKioskModeForBreakWindow } from "./windows/breakWindow";
import { settingsWindow, showTimerOnTop } from "./windows/settingsWindow";
import { getAllDayScores, getCurrentDayScore, recordCheckpointAdjusted, takeUnseenSummaryDate } from "./stats/stats";
import { getTour, startTour, tourAction, tourEmitter, tourNext, tourPrev, tourSkip, shownTimerState, tourTodayScore } from "./tour/tour";

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
  broadcastStateToRendererWindows(shownTimerState(), [settingsWindow, breakWindow], EVENTS.IPC_CHANNELS.TIMER_UPDATE);
  broadcastStateToRendererWindows(tourTodayScore() ?? todayScore, [settingsWindow], EVENTS.IPC_CHANNELS.STATS_TODAY);
};

// The break window belongs to the tour while one is on. The real timer's window comes back when it ends
const unlessTour = <T,>(handle: (arg: T) => void) => (arg: T) => {
  if (!getTour()) handle(arg);
};

// A window's buttons go to the tour while one is on, where only the button its card names does anything
const fromWindow = (action: AvailableActions, act: (source: Source) => void) => () => {
  if (getTour()) tourAction(action);
  else act("WINDOW");
};

export const initEventListeners = () => {
  timerEmitter.on(EVENTS.TIMER.RUNNING, onTimerUpdate);
  timerEmitter.on(EVENTS.TIMER.ON_BREAK, onTimerUpdate);
  timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, onTimerUpdate);
  timerEmitter.on(EVENTS.TIMER.STOPPED, onTimerUpdate);
  timerEmitter.on(EVENTS.TIMER.ON_LUNCH, onTimerUpdate);

  timerEmitter.on(EVENTS.TIMER.WARNING, () => {
    broadcastStateToRendererWindows(
      null,
      [settingsWindow],
      EVENTS.IPC_CHANNELS.TIMER_WARNING
    );
  });

  timerEmitter.on(EVENTS.TIMER.ON_OVERDUE, unlessTour(resizeBreakWindow));
  timerEmitter.on(EVENTS.TIMER.WARNING, showTimerOnTop);
  timerEmitter.on(EVENTS.TIMER.START_OVERDUE, unlessTour(() => createBreakWindow()));
  timerEmitter.on(EVENTS.TIMER.START_BREAK, unlessTour(activateKioskModeForBreakWindow));
  timerEmitter.on(EVENTS.TIMER.STOP_BREAK, unlessTour(closeBreakWindow));
  timerEmitter.on(EVENTS.TIMER.STOP_BREAK, () => {  // Saved configs only take effect after a break
    applyTimerConfigs();
    applyDifficultyConfigs();
    applyOverdueConfigs();
    setOverdueLevelsArray();
  });

  tourEmitter.on(EVENTS.TOUR.UPDATE, (tour) => {
    broadcastStateToRendererWindows(tour, [settingsWindow, breakWindow], EVENTS.IPC_CHANNELS.TOUR_UPDATE);
  });

  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_STOP, fromWindow("stop", stopTimer));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_BEGIN, fromWindow("start", startTimer));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_STARTBREAK, fromWindow("breaktime", startBreak));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK, fromWindow("skip", skipBreak));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_FORWARD, fromWindow("forward", forwardToBreak));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_SNOOZE, fromWindow("snooze", snoozeTimer));
  ipcMain.on(EVENTS.IPC_CHANNELS.TIMER_LUNCH, fromWindow("lunch", startLunch));

  ipcMain.handle(EVENTS.IPC_CHANNELS.TIMER_GETSTATE, shownTimerState);
  ipcMain.handle(EVENTS.IPC_CHANNELS.STATS_GET_DAYS, getAllDayScores);
  ipcMain.handle(EVENTS.IPC_CHANNELS.STATS_TAKE_UNSEEN_SUMMARY, takeUnseenSummaryDate);
  ipcMain.handle(EVENTS.IPC_CHANNELS.TOUR_GET, getTour);
  ipcMain.on(EVENTS.IPC_CHANNELS.TOUR_START, startTour);
  ipcMain.on(EVENTS.IPC_CHANNELS.TOUR_NEXT, tourNext);
  ipcMain.on(EVENTS.IPC_CHANNELS.TOUR_PREV, tourPrev);
  ipcMain.on(EVENTS.IPC_CHANNELS.TOUR_SKIP, tourSkip);
  // Settings pages read and write the saved configs; most only take effect after a break, see STOP_BREAK above
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.TIMER, getTimerConfigs);
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.TIMER, (event, configs: TimerConfigs) => setTimerConfigs(configs));
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.DIFFICULTY, getDifficultyConfigs);
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.DIFFICULTY, (event, configs: DifficultyConfigs) => setDifficultyConfigs(configs));
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.OVERDUE, getOverdueConfigs);
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.OVERDUE, (event, configs: OverdueConfigs) => setOverdueConfigs(configs));
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.WORKDAY, getWorkdayConfigs);
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.WORKDAY, (event, configs: WorkdayConfigs) => setWorkdayConfigs(configs));
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.SOUND, getSoundConfigs);
  ipcMain.handle(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.SOUND, (event, configs: SoundConfigs) => setSoundConfigs(configs));

  // The admin settings apply the workday right away so it can be tested without waiting a day
  if (IS_DEV) {
    ipcMain.handle(EVENTS.IPC_CHANNELS.DEV_APPLY_WORKDAY, applyWorkdayConfigs);
    ipcMain.handle(EVENTS.IPC_CHANNELS.DEV_RESET_DAY, () => {
      resetTodayLimits();
      emitTimerStatus(); // So the windows and tray show the counts back
    });
    ipcMain.handle(EVENTS.IPC_CHANNELS.DEV_ADJUST_CHECKPOINT, (_event, by: number) => {
      recordCheckpointAdjusted(by);
      emitTimerStatus(); // Sends today's new score along with the timer
    });
  }
};

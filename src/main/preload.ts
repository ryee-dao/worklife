import { contextBridge, ipcRenderer } from "electron";
import { EVENTS } from "../shared/constants";
import { TimerState } from "./timer/timerState";
import { TimerConfigs } from "./timer/timerConfigs";
import { DifficultyConfigs } from "./difficulty/difficultyConfigs";
import { WorkdayConfigs } from "./workday/workdayConfigs";
import { OverdueConfigs } from "./overdue/overdueConfigs";
import { ElectronAPI } from "../shared/types/electron";
import { DayScore } from "./stats/checkpoints";

const electronAPI: ElectronAPI = {
  onTimerUpdate: (callback: (arg0: TimerState) => void) => {
    ipcRenderer.on(EVENTS.IPC_CHANNELS.TIMER_UPDATE, (event, data) => {
      callback(data);
    });
  },
  onWarning: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(EVENTS.IPC_CHANNELS.TIMER_WARNING, listener);
    return () => ipcRenderer.removeListener(EVENTS.IPC_CHANNELS.TIMER_WARNING, listener);
  },
  onTodayScore: (callback: (score: DayScore | null) => void) => {
    const listener = (_event: unknown, score: DayScore | null) => callback(score);
    ipcRenderer.on(EVENTS.IPC_CHANNELS.STATS_TODAY, listener);
    return () => ipcRenderer.removeListener(EVENTS.IPC_CHANNELS.STATS_TODAY, listener);
  },
  onShowDay: (callback: (localDate: string) => void) => {
    const listener = (_event: unknown, localDate: string) => callback(localDate);
    ipcRenderer.on(EVENTS.IPC_CHANNELS.STATS_SHOW_DAY, listener);
    return () => ipcRenderer.removeListener(EVENTS.IPC_CHANNELS.STATS_SHOW_DAY, listener);
  },
  getDayScores: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.STATS_GET_DAYS);
  },
  takeUnseenDaySummary: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.STATS_TAKE_UNSEEN_SUMMARY);
  },
  getTimerState: async (): Promise<TimerState> => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.TIMER_GETSTATE);
  },
  stop: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_STOP);
  },
  start: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_BEGIN);
  },
  startBreak: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_STARTBREAK);
  },
  skipBreak: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_SKIPBREAK);
  },
  forwardToBreak: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_FORWARD);
  },
  snooze: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_SNOOZE);
  },
  startLunch: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_LUNCH);
  },
  loadTimerConfigs: async (): Promise<TimerConfigs> => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.TIMER);
  },
  loadDifficultyConfigs: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.DIFFICULTY);
  },
  loadOverdueConfigs: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.OVERDUE);
  },
  loadWorkdayConfigs: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.WORKDAY);
  },
  saveTimerConfigs: async (configs: TimerConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.TIMER, configs);
  },
  saveDifficultyConfigs: async (configs: DifficultyConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.DIFFICULTY, configs);
  },
  saveOverdueConfigs: async (configs: OverdueConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.OVERDUE, configs);
  },
  saveWorkdayConfigs: async (configs: WorkdayConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.WORKDAY, configs);
  },
  devApplyWorkday: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.DEV_APPLY_WORKDAY);
  },
}

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

import { contextBridge, ipcRenderer } from "electron";
import { EVENTS } from "../shared/constants";
import { TimerState } from "./timer/timerState";
import { TimerConfigs } from "./timer/timerConfigs";
import { DifficultyConfigs } from "./difficulty/difficultyConfigs";
import { WorkdayConfigs } from "./workday/workdayConfigs";
import { OverdueConfigs } from "./overdue/overdueConfigs";
import { ElectronAPI } from "../shared/types/electron";

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
  getTimerState: async (): Promise<TimerState> => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.TIMER_GETSTATE);
  },
  pause: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_PAUSE);
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
  skipTimer: () => {
    ipcRenderer.send(EVENTS.IPC_CHANNELS.TIMER_SKIPTIMER);
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
}

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

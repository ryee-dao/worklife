import { contextBridge, ipcRenderer } from "electron";
import { EVENTS } from "../shared/constants";
import { TimerState } from "./timer/timerState";
import { TimerConfig } from "./timer/timerConfigs";
import { LimitConfigs } from "./limit/limitConfigs";
import { OverdueConfigs } from "./overdue/overdueConfigs";

contextBridge.exposeInMainWorld("electronAPI", {
  onTimerUpdate: (callback: (arg0: TimerState) => void) => {
    ipcRenderer.on(EVENTS.IPC_CHANNELS.TIMER_UPDATE, (event, data) => {
      callback(data);
    });
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
  loadTimerConfig: async (): Promise<TimerConfig> => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.LOAD.TIMER);
  },
  loadLimitConfig: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.LOAD.LIMIT);
  },
  loadOverdueConfigs: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.LOAD.OVERDUE);
  },
  saveTimerConfig: async (config: TimerConfig) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.SAVE.TIMER, config);
  },
  saveLimitConfig: async (config: LimitConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.SAVE.LIMIT, config);
  },
  saveOverdueConfigs: async (config: OverdueConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.SAVE.OVERDUE, config);
  },
});

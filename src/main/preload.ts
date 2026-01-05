import { contextBridge, ipcRenderer } from "electron";
import { EVENTS } from "../shared/constants";
import { skipBreak, TimerState } from "./timerState";
import { TimerConfig } from "./timerConfigs";

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
  saveTimerConfig: async (config: TimerConfig) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.SAVE.TIMER, config);
  },
  saveLimitConfig: async (config: any) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIG.SAVE.LIMIT, config);
  },
});

import { contextBridge, ipcRenderer } from "electron";
import { EVENTS } from "../shared/constants";
import { TimerState } from "./timer/timerState";
import { TimerConfigs } from "./timer/timerConfigs";
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
  loadTimerConfigs: async (): Promise<TimerConfigs> => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.TIMER);
  },
  loadLimitConfigs: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.LIMIT);
  },
  loadOverdueConfigs: async () => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.LOAD.OVERDUE);
  },
  saveTimerConfigs: async (configs: TimerConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.TIMER, configs);
  },
  saveLimitConfigs: async (configs: LimitConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.LIMIT, configs);
  },
  saveOverdueConfigs: async (configs: OverdueConfigs) => {
    return ipcRenderer.invoke(EVENTS.IPC_CHANNELS.CONFIGS.SAVE.OVERDUE, configs);
  },
});

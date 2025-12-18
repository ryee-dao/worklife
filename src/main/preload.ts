import { contextBridge, ipcRenderer } from "electron";
import { EVENTS } from "../shared/constants";
import { TimerState } from "./timerState";

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
});

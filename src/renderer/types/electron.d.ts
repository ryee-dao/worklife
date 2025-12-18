import { TimerState } from "../../main/timerState";

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => void;
  pause: () => void;
  start: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

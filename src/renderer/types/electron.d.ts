import { TimerState } from "../../main/timerState";
import { TimerConfig } from "../../main/settingConfigs"

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => void;
  pause: () => void;
  start: () => void;
  skip: () => void;
  saveTimerConfig: (arg0: TimerConfig) => Promise<void>;
  loadTimerConfig: () => Promise<TimerConfig>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

import { TimerState } from "../../main/timerState";
import { TimerConfig } from "../../main/timerConfigs"
import { LimitConfig } from "../../main/limitConfigs";

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => void;
  pause: () => void;
  start: () => void;
  skip: () => void;
  saveTimerConfig: (arg0: TimerConfig) => Promise<void>;
  saveLimitConfig: (arg0: LimitConfig) => Promise<void>;
  loadTimerConfig: () => Promise<TimerConfig>;
  loadLimitConfig: () => Promise<LimitConfig>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

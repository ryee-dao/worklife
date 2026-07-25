import { TimerState } from "../../../main/timer/timerState";
import { TimerConfig } from "../../../main/timer/timerConfigs"
import { LimitConfig } from "../../../main/limit/limitConfigs";

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => void;
  pause: () => void;
  start: () => void;
  startBreak: () => void;
  skipBreak: () => void;
  skipTimer: () => void;
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

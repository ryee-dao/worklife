import { TimerState } from "../../../main/timer/timerState";
import { TimerConfig } from "../../../main/timer/timerConfigs"
import { LimitConfig } from "../../../main/limit/limitConfigs";
import { OverdueConfigs } from "../../../main/overdue/overdueConfigs";

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => void;
  pause: () => void;
  start: () => void;
  startBreak: () => void;
  skipBreak: () => void;
  skipTimer: () => void;
  saveTimerConfig: (arg0: TimerConfig) => Promise<void>;
  saveLimitConfig: (arg0: LimitConfig) => Promise<void>;
  saveOverdueConfigs: (arg0: OverdueConfigs) => Promise<void>;
  loadTimerConfig: () => Promise<TimerConfig>;
  loadLimitConfig: () => Promise<LimitConfig>
  loadOverdueConfigs: () => Promise<OverdueConfigs>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

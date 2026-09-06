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
  saveTimerConfigs: (arg0: TimerConfig) => Promise<void>;
  saveLimitConfigs: (arg0: LimitConfig) => Promise<void>;
  saveOverdueConfigs: (arg0: OverdueConfigs) => Promise<void>;
  loadTimerConfigs: () => Promise<TimerConfig>;
  loadLimitConfigs: () => Promise<LimitConfig>
  loadOverdueConfigs: () => Promise<OverdueConfigs>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

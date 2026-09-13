import { TimerState } from "../../main/timer/timerState";
import { TimerConfigs } from "../../main/timer/timerConfigs"
import { LimitConfigs } from "../../main/limit/limitConfigs";
import { OverdueConfigs } from "../../main/overdue/overdueConfigs";

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => void;
  onWarning: (callback: () => void) => void;
  pause: () => void;
  start: () => void;
  startBreak: () => void;
  skipBreak: () => void;
  skipTimer: () => void;
  saveTimerConfigs: (arg0: TimerConfigs) => Promise<void>;
  saveLimitConfigs: (arg0: LimitConfigs) => Promise<void>;
  saveOverdueConfigs: (arg0: OverdueConfigs) => Promise<void>;
  loadTimerConfigs: () => Promise<TimerConfigs>;
  loadLimitConfigs: () => Promise<LimitConfigs>
  loadOverdueConfigs: () => Promise<OverdueConfigs>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
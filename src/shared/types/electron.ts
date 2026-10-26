import { TimerState } from "../../main/timer/timerState";
import { TimerConfigs } from "../../main/timer/timerConfigs"
import { DifficultyConfigs } from "../../main/difficulty/difficultyConfigs";
import { WorkdayConfigs } from "../../main/workday/workdayConfigs";
import { OverdueConfigs } from "../../main/overdue/overdueConfigs";

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => void;
  onWarning: (callback: () => void) => void;
  getTimerState: () => Promise<TimerState>;
  pause: () => void;
  start: () => void;
  startBreak: () => void;
  skipBreak: () => void;
  skipTimer: () => void;
  saveTimerConfigs: (arg0: TimerConfigs) => Promise<void>;
  saveDifficultyConfigs: (arg0: DifficultyConfigs) => Promise<void>;
  saveOverdueConfigs: (arg0: OverdueConfigs) => Promise<void>;
  saveWorkdayConfigs: (arg0: WorkdayConfigs) => Promise<void>;
  loadTimerConfigs: () => Promise<TimerConfigs>;
  loadDifficultyConfigs: () => Promise<DifficultyConfigs>
  loadOverdueConfigs: () => Promise<OverdueConfigs>
  loadWorkdayConfigs: () => Promise<WorkdayConfigs>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
import { TimerState } from "../../main/timer/timerState";
import { TimerConfigs } from "../../main/timer/timerConfigs"
import { DifficultyConfigs } from "../../main/difficulty/difficultyConfigs";
import { WorkdayConfigs } from "../../main/workday/workdayConfigs";
import { DayScore } from "../../main/stats/checkpoints";
import { OverdueConfigs } from "../../main/overdue/overdueConfigs";

export interface ElectronAPI {
  onTimerUpdate: (callback: (data: TimerState) => void) => () => void;
  onWarning: (callback: () => void) => void;
  getTimerState: () => Promise<TimerState>;
  onTodayScore: (callback: (score: DayScore | null) => void) => () => void;
  onShowDay: (callback: (localDate: string) => void) => () => void;
  getDayScores: () => Promise<Record<string, DayScore>>;
  takeUnseenDaySummary: () => Promise<string | null>;
  stop: () => void;
  start: () => void;
  startBreak: () => void;
  skipBreak: () => void;
  forwardToBreak: () => void;
  snooze: () => void;
  startLunch: () => void;
  saveTimerConfigs: (arg0: TimerConfigs) => Promise<void>;
  saveDifficultyConfigs: (arg0: DifficultyConfigs) => Promise<void>;
  saveOverdueConfigs: (arg0: OverdueConfigs) => Promise<void>;
  saveWorkdayConfigs: (arg0: WorkdayConfigs) => Promise<void>;
  devApplyWorkday: () => Promise<void>; // Only answered in dev
  devResetDay: () => Promise<void>;     // Only answered in dev
  devAdjustCheckpoint: (by: number) => Promise<void>; // Only answered in dev
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
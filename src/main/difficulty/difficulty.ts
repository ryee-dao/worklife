import { getPresetConfigs } from "@shared/utils/difficulty";
import { getAppliedTimerConfigs } from "@main/timer/timerConfigs";
import { getAppliedWorkdayConfigs } from "@main/workday/workdayConfigs";
import { getAppliedDifficultyConfigs } from "./difficultyConfigs";

const getAppliedValues = () => {
  const { level, custom } = getAppliedDifficultyConfigs();
  if (level === "CUSTOM") return custom;
  return getPresetConfigs(level, getAppliedTimerConfigs().timerDurationMs, getAppliedWorkdayConfigs());
};

export const getBreakDurationMs = () => getAppliedValues().breakDurationMs;

export const getSnoozeDurationMs = () => getAppliedValues().snoozeDurationMs;

export const getAllottedPowerups = () => getAppliedValues().allottedPowerups;

export const getLunchDurationMs = () => getAppliedValues().lunchDurationMs;

export const getCheckpointDecayMs = () => getAppliedValues().checkpointDecayMs;

import { DIFFICULTY_PRESETS } from "../../shared/constants";
import { getAppliedTimerConfigs } from "../timer/timerConfigs";
import { getAppliedDifficultyConfigs } from "./difficultyConfigs";

const breakRoundingMs = 15 * 1000;
const minimumBreakMs = 30 * 1000;
const snoozeRoundingMs = 60 * 1000;
const minimumSnoozeMs = 60 * 1000;

const roundToNearest = (ms: number, stepMs: number) => {
  return Math.round(ms / stepMs) * stepMs;
};

export const getBreakDurationMs = () => {
  const { level, custom } = getAppliedDifficultyConfigs();
  if (level === "CUSTOM") return custom.breakDurationMs;

  const breakMs = getAppliedTimerConfigs().timerDurationMs * DIFFICULTY_PRESETS[level].breakRatio;
  return Math.max(roundToNearest(breakMs, breakRoundingMs), minimumBreakMs);
};

export const getSnoozeDurationMs = () => {
  const { level, custom } = getAppliedDifficultyConfigs();
  if (level === "CUSTOM") return custom.snoozeDurationMs;

  const snoozeMs = getAppliedTimerConfigs().timerDurationMs * DIFFICULTY_PRESETS[level].snoozeRatio;
  return Math.max(roundToNearest(snoozeMs, snoozeRoundingMs), minimumSnoozeMs);
};

export const getAllottedPowerups = () => {
  const { level, custom } = getAppliedDifficultyConfigs();
  if (level === "CUSTOM") return custom.allottedPowerups;

  return DIFFICULTY_PRESETS[level].allottedPowerups;
};

export const getLunchDurationMs = () => {
  const { level, custom } = getAppliedDifficultyConfigs();
  if (level === "CUSTOM") return custom.lunchDurationMs;

  return DIFFICULTY_PRESETS[level].lunchDurationMs;
};

import { DIFFICULTY_PRESETS } from "../../shared/constants";
import { getAppliedTimerConfigs } from "../timer/timerConfigs";
import { getAppliedDifficultyConfigs } from "./difficultyConfigs";

const breakRoundingMs = 15 * 1000;
const minimumBreakMs = 30 * 1000;

export const getBreakDurationMs = () => {
  const { level, custom } = getAppliedDifficultyConfigs();
  if (level === "CUSTOM") return custom.breakDurationMs;

  const breakMs = getAppliedTimerConfigs().timerDurationMs * DIFFICULTY_PRESETS[level].breakRatio;
  const roundedBreakMs = Math.round(breakMs / breakRoundingMs) * breakRoundingMs;
  return Math.max(roundedBreakMs, minimumBreakMs);
};

export const getAllottedBreaks = () => {
  const { level, custom } = getAppliedDifficultyConfigs();
  if (level === "CUSTOM") return custom.allottedBreaks;

  return DIFFICULTY_PRESETS[level].allottedBreaks;
};

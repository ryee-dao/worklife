import { DIFFICULTY_PRESETS } from "../constants";
import type { DifficultyConfigs } from "../../main/difficulty/difficultyConfigs";
import type { WorkdayConfigs } from "../../main/workday/workdayConfigs";
import { convertTimeToMinutes } from "./time";

const breakRoundingMs = 15 * 1000;
const minimumBreakMs = 30 * 1000;
const snoozeRoundingMs = 60 * 1000;
const minimumSnoozeMs = 60 * 1000;
const decayRoundingMs = 60 * 1000;
const minimumDecayMs = 60 * 1000;

const roundToNearest = (ms: number, stepMs: number) => {
  return Math.round(ms / stepMs) * stepMs;
};

// What a preset works out to for a timer length and workday. Shared so the settings cards show exactly what the app will use
export const getPresetConfigs = (
  level: keyof typeof DIFFICULTY_PRESETS, timerDurationMs: number, workday: Pick<WorkdayConfigs, "start" | "end">,
): DifficultyConfigs["custom"] => {
  const { breakRatio, snoozeRatio, allottedPowerups, lunchDurationMs, decayRatio } = DIFFICULTY_PRESETS[level];
  const workdayMs = (convertTimeToMinutes(workday.end) - convertTimeToMinutes(workday.start)) * 60 * 1000;
  return {
    breakDurationMs: Math.max(roundToNearest(timerDurationMs * breakRatio, breakRoundingMs), minimumBreakMs),
    snoozeDurationMs: Math.max(roundToNearest(timerDurationMs * snoozeRatio, snoozeRoundingMs), minimumSnoozeMs),
    allottedPowerups,
    lunchDurationMs,
    checkpointDecayMs: Math.max(roundToNearest(workdayMs * decayRatio, decayRoundingMs), minimumDecayMs),
  };
};

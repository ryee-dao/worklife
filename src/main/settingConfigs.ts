import { app } from "electron";
import { DEFAULTS } from "../shared/constants";
import path from "path";
import fs from "fs";

const timerSettingsFileName = "timerSettings.json";
const defaultTimerSettings: TimerConfig = {
  timerDurationMs: DEFAULTS.DEFAULT_TIMER_DURATION_MS,
  breakDurationMs: DEFAULTS.DEFAULT_BREAK_DURATION_MS,
};

export interface TimerConfig {
  timerDurationMs: number;
  breakDurationMs: number;
}

export function loadTimerSettingsFromFile() {
  const filePath = path.join(app.getPath("userData"), timerSettingsFileName);
  let fileContent: TimerConfig | undefined = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : undefined;
  return { filePath, fileContent };
}

export function getTimerSettingsData(): TimerConfig {
  let timerSettingsData = loadTimerSettingsFromFile();
  let timerSettings: TimerConfig;
  // If no timer settings data is returned, set new state in file
  if (!timerSettingsData.fileContent) {
    fs.writeFileSync(
      path.join(app.getPath("userData"), timerSettingsFileName),
      JSON.stringify(defaultTimerSettings)
    );
    timerSettings = defaultTimerSettings;
  } else {
    timerSettings = timerSettingsData.fileContent;
  }
  console.log(timerSettings)
  return timerSettings;
}

export function updateTimerSettings(timerSettings: TimerConfig) {
  // Write new state to file
  fs.writeFileSync(
    path.join(app.getPath("userData"), timerSettingsFileName),
    JSON.stringify(timerSettings)
  );
  console.log(JSON.stringify(timerSettings));
}

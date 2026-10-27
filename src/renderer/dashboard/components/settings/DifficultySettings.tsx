import { useState } from "react";
import { DifficultyConfigs, DifficultyLevel } from "../../../../main/difficulty/difficultyConfigs";
import { DIFFICULTY_PRESETS } from "../../../../shared/constants";
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds, convertSecondsToMs } from "../../../../shared/utils/time";
import { IS_DEV } from "../../../common/constants";
import SettingsPanel from "./SettingsPanel";
import NumberInput from "../../../common/components/NumberInput";

const levelNames: Record<DifficultyLevel, string> = {
  EASY: "Easy",
  NORMAL: "Normal",
  HARD: "Hard",
  CUSTOM: "Custom",
};

const describeLevel = (level: DifficultyLevel) => {
  if (level === "CUSTOM") return "choose your own breaks, skips and snoozes";
  const { breakRatio, allottedBreaks, snoozeRatio, allottedSnoozes, partialThreshold } = DIFFICULTY_PRESETS[level];
  return `breaks are ${breakRatio * 100}% of your timer, ${allottedBreaks} skip(s) per day, `
    + `${allottedSnoozes} snooze(s) of ${snoozeRatio * 100}% of your timer, `
    + `${partialThreshold * 100}% compliant for a partial after stopping`;
};

export default function DifficultySettings() {
  const [level, setLevel] = useState<DifficultyLevel>("NORMAL");
  const [breakDurationInSeconds, setBreakDurationInSeconds] = useState(0);
  const [allottedBreaks, setAllottedBreaks] = useState(0);
  const [snoozeDurationInMinutes, setSnoozeDurationInMinutes] = useState(0);
  const [allottedSnoozes, setAllottedSnoozes] = useState(0);
  const [partialThresholdPercent, setPartialThresholdPercent] = useState(0);

  const breakMinSeconds = IS_DEV ? 1 : 10;
  const breaksMaxLimit = IS_DEV ? 9999999 : 5;
  const breakValid = breakDurationInSeconds >= breakMinSeconds && breakDurationInSeconds <= 600;
  const allottedBreaksValid = allottedBreaks >= 0 && allottedBreaks <= breaksMaxLimit;
  const snoozeValid = snoozeDurationInMinutes >= 1 && snoozeDurationInMinutes <= 60;
  const allottedSnoozesValid = allottedSnoozes >= 0 && allottedSnoozes <= breaksMaxLimit;
  const partialThresholdValid = partialThresholdPercent >= 1 && partialThresholdPercent <= 100;
  const isCustom = level === "CUSTOM";

  return (
    <SettingsPanel<DifficultyConfigs>
      title="Difficulty Settings"
      isValid={!isCustom || (breakValid && allottedBreaksValid && snoozeValid && allottedSnoozesValid && partialThresholdValid)}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      load={() => window.electronAPI.loadDifficultyConfigs()}
      save={(configs) => window.electronAPI.saveDifficultyConfigs(configs)}
      buildConfig={() => ({
        level,
        custom: {
          breakDurationMs: convertSecondsToMs(breakDurationInSeconds),
          allottedBreaks,
          snoozeDurationMs: convertMinutesToMs(snoozeDurationInMinutes),
          allottedSnoozes,
          partialThreshold: partialThresholdPercent / 100,
        },
      })}
      onLoaded={(configs) => {
        setLevel(configs.level);
        setBreakDurationInSeconds(convertMsToSeconds(configs.custom.breakDurationMs));
        setAllottedBreaks(configs.custom.allottedBreaks);
        setSnoozeDurationInMinutes(convertMsToMinutes(configs.custom.snoozeDurationMs));
        setAllottedSnoozes(configs.custom.allottedSnoozes);
        setPartialThresholdPercent(Math.round(configs.custom.partialThreshold * 100));
      }}
    >
      <div data-testid="difficulty-level" className="tracking-wider p-2">
        {(Object.keys(levelNames) as DifficultyLevel[]).map((option) => (
          <label key={option} className="block">
            <input type="radio" name="difficulty" value={option}
              checked={level === option} onChange={() => setLevel(option)} />{" "}
            <span className="font-medium">{levelNames[option]}</span>: {describeLevel(option)}
          </label>
        ))}
      </div>

      {isCustom && (
        <>
          <div data-testid="break-duration" className="tracking-wider p-2">
            <label>
              This break will last{" "}
              <NumberInput min={breakMinSeconds} max={600} value={breakDurationInSeconds}
                onChange={(e) => setBreakDurationInSeconds(Number(e.target.value))} />{" "}
              seconds
            </label>
            {!breakValid && (
              <p className="text-sm text-red-600 mt-1">
                Must be between {breakMinSeconds} and 600 seconds
              </p>
            )}
          </div>

          <div data-testid="allowed-break-count" className="tracking-wider p-2">
            <label>
              I will be able to skip{" "}
              <NumberInput min={0} max={breaksMaxLimit} value={allottedBreaks}
                onChange={(e) => setAllottedBreaks(Number(e.target.value))} />{" "}
              break(s) per day
            </label>
            {!allottedBreaksValid && (
              <p className="text-sm text-red-600 mt-1">
                Must be between 0 and {breaksMaxLimit}
              </p>
            )}
          </div>

          <div data-testid="snooze-duration" className="tracking-wider p-2">
            <label>
              A snooze adds{" "}
              <NumberInput min={1} max={60} value={snoozeDurationInMinutes}
                onChange={(e) => setSnoozeDurationInMinutes(Number(e.target.value))} />{" "}
              minutes
            </label>
            {!snoozeValid && (
              <p className="text-sm text-red-600 mt-1">Must be between 1 and 60 minutes</p>
            )}
          </div>

          <div data-testid="allowed-snooze-count" className="tracking-wider p-2">
            <label>
              I will be able to snooze{" "}
              <NumberInput min={0} max={breaksMaxLimit} value={allottedSnoozes}
                onChange={(e) => setAllottedSnoozes(Number(e.target.value))} />{" "}
              time(s) per day
            </label>
            {!allottedSnoozesValid && (
              <p className="text-sm text-red-600 mt-1">
                Must be between 0 and {breaksMaxLimit}
              </p>
            )}
          </div>

          <div data-testid="partial-threshold" className="tracking-wider p-2">
            <label>
              After stopping, I still get a partial clean if I'm compliant for{" "}
              <NumberInput min={1} max={100} value={partialThresholdPercent}
                onChange={(e) => setPartialThresholdPercent(Number(e.target.value))} />{" "}
              % of my workday
            </label>
            {!partialThresholdValid && (
              <p className="text-sm text-red-600 mt-1">Must be between 1% and 100%</p>
            )}
          </div>
        </>
      )}
    </SettingsPanel>
  );
}

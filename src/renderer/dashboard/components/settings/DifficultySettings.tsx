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
  if (level === "CUSTOM") return "choose your own breaks, power-ups, snoozes and lunch";
  const { breakRatio, allottedPowerups, snoozeRatio, lunchDurationMs } = DIFFICULTY_PRESETS[level];
  return `breaks are ${breakRatio * 100}% of your timer, ${allottedPowerups} power-up(s) per day `
    + `(a snooze of ${snoozeRatio * 100}% of your timer, or a skipped break), `
    + `a ${convertMsToMinutes(lunchDurationMs)} minute lunch`;
};

export default function DifficultySettings() {
  const [level, setLevel] = useState<DifficultyLevel>("NORMAL");
  const [breakDurationInSeconds, setBreakDurationInSeconds] = useState(0);
  const [allottedPowerups, setAllottedPowerups] = useState(0);
  const [snoozeDurationInMinutes, setSnoozeDurationInMinutes] = useState(0);
  const [lunchDurationInMinutes, setLunchDurationInMinutes] = useState(0);

  const breakMinSeconds = IS_DEV ? 1 : 10;
  const powerupsMaxLimit = IS_DEV ? 9999999 : 5;
  const breakValid = breakDurationInSeconds >= breakMinSeconds && breakDurationInSeconds <= 600;
  const allottedPowerupsValid = allottedPowerups >= 0 && allottedPowerups <= powerupsMaxLimit;
  const snoozeValid = snoozeDurationInMinutes >= 1 && snoozeDurationInMinutes <= 60;
  const lunchValid = lunchDurationInMinutes >= 1 && lunchDurationInMinutes <= 120;
  const isCustom = level === "CUSTOM";

  return (
    <SettingsPanel<DifficultyConfigs>
      title="Difficulty Settings"
      isValid={!isCustom || (breakValid && allottedPowerupsValid && snoozeValid && lunchValid)}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      load={() => window.electronAPI.loadDifficultyConfigs()}
      save={(configs) => window.electronAPI.saveDifficultyConfigs(configs)}
      buildConfig={() => ({
        level,
        custom: {
          breakDurationMs: convertSecondsToMs(breakDurationInSeconds),
          allottedPowerups,
          snoozeDurationMs: convertMinutesToMs(snoozeDurationInMinutes),
          lunchDurationMs: convertMinutesToMs(lunchDurationInMinutes),
        },
      })}
      onLoaded={(configs) => {
        setLevel(configs.level);
        setBreakDurationInSeconds(convertMsToSeconds(configs.custom.breakDurationMs));
        setAllottedPowerups(configs.custom.allottedPowerups);
        setSnoozeDurationInMinutes(convertMsToMinutes(configs.custom.snoozeDurationMs));
        setLunchDurationInMinutes(convertMsToMinutes(configs.custom.lunchDurationMs));
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

          <div data-testid="allowed-powerup-count" className="tracking-wider p-2">
            <label>
              I get{" "}
              <NumberInput min={0} max={powerupsMaxLimit} value={allottedPowerups}
                onChange={(e) => setAllottedPowerups(Number(e.target.value))} />{" "}
              power-up(s) per day, each a snooze or a skipped break
            </label>
            {!allottedPowerupsValid && (
              <p className="text-sm text-red-600 mt-1">
                Must be between 0 and {powerupsMaxLimit}
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

          <div data-testid="lunch-duration" className="tracking-wider p-2">
            <label>
              Lunch lasts{" "}
              <NumberInput min={1} max={120} value={lunchDurationInMinutes}
                onChange={(e) => setLunchDurationInMinutes(Number(e.target.value))} />{" "}
              minutes
            </label>
            {!lunchValid && (
              <p className="text-sm text-red-600 mt-1">Must be between 1 and 120 minutes</p>
            )}
          </div>
        </>
      )}
    </SettingsPanel>
  );
}

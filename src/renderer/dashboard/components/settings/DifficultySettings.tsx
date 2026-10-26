import { useState } from "react";
import { DifficultyConfigs, DifficultyLevel } from "../../../../main/difficulty/difficultyConfigs";
import { DIFFICULTY_PRESETS } from "../../../../shared/constants";
import { convertMsToSeconds, convertSecondsToMs } from "../../../../shared/utils/time";
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
  if (level === "CUSTOM") return "choose your own break length and skips";
  const { breakRatio, allottedBreaks } = DIFFICULTY_PRESETS[level];
  return `breaks are ${breakRatio * 100}% of your timer, ${allottedBreaks} skip(s) per day`;
};

export default function DifficultySettings() {
  const [level, setLevel] = useState<DifficultyLevel>("NORMAL");
  const [breakDurationInSeconds, setBreakDurationInSeconds] = useState(0);
  const [allottedBreaks, setAllottedBreaks] = useState(0);

  const breakMinSeconds = IS_DEV ? 1 : 10;
  const breaksMaxLimit = IS_DEV ? 9999999 : 5;
  const breakValid = breakDurationInSeconds >= breakMinSeconds && breakDurationInSeconds <= 600;
  const allottedBreaksValid = allottedBreaks >= 0 && allottedBreaks <= breaksMaxLimit;
  const isCustom = level === "CUSTOM";

  return (
    <SettingsPanel<DifficultyConfigs>
      title="Difficulty Settings"
      isValid={!isCustom || (breakValid && allottedBreaksValid)}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      load={() => window.electronAPI.loadDifficultyConfigs()}
      save={(configs) => window.electronAPI.saveDifficultyConfigs(configs)}
      buildConfig={() => ({
        level,
        custom: { breakDurationMs: convertSecondsToMs(breakDurationInSeconds), allottedBreaks },
      })}
      onLoaded={(configs) => {
        setLevel(configs.level);
        setBreakDurationInSeconds(convertMsToSeconds(configs.custom.breakDurationMs));
        setAllottedBreaks(configs.custom.allottedBreaks);
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
        </>
      )}
    </SettingsPanel>
  );
}

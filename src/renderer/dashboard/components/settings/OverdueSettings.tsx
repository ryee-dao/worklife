import { useState } from "react";
import SettingsPanel from "./SettingsPanel";
import NumberInput, { inRange } from "@renderer/common/components/NumberInput";
import { OverdueConfigs } from "@main/overdue/overdueConfigs";
import { CONSTRAINTS } from "@shared/constants";
import { convertMsToSeconds, convertSecondsToMs } from "@shared/utils/time";

const PERCENT = { min: 10, max: CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_RATIO * 100 };
const LEVELS = { min: 1, max: CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_LEVEL, step: 1 as const };
const THRESHOLD_SECONDS = { min: 5, max: 3600 };

export default function OverdueSettings() {
  const [levelThresholdInSeconds, setLevelThresholdInSeconds] = useState(0)
  const [windowLevelCap, setWindowLevelCap] = useState(0)
  const [windowPercentageCap, setWindowPercentageCap] = useState(0)

  const thresholdValid = inRange(levelThresholdInSeconds, THRESHOLD_SECONDS);
  const levelsValid = inRange(windowLevelCap, LEVELS);
  const percentValid = inRange(windowPercentageCap, PERCENT);
  const growths = Math.max(0, windowLevelCap - 1) || 0;

  return (
    <SettingsPanel<OverdueConfigs>
      title="Overdue Settings"
      isValid={thresholdValid && levelsValid && percentValid}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      load={() => window.electronAPI.loadOverdueConfigs()}
      save={(configs) => window.electronAPI.saveOverdueConfigs(configs)}
      buildConfig={() => ({
        levelThresholdMs: convertSecondsToMs(levelThresholdInSeconds),
        windowLevelCap: windowLevelCap,
        windowRatioCap: windowPercentageCap / 100
      })}
      onLoaded={(configs) => {
        setLevelThresholdInSeconds(convertMsToSeconds(configs.levelThresholdMs));
        setWindowLevelCap(configs.windowLevelCap);
        setWindowPercentageCap(configs.windowRatioCap * 100);
      }}
    >
      <div data-testid="maximum-window-percentage" className="tracking-wider p-2">
        <label>
          I want the overdue window to take up maximum{" "}
          <NumberInput {...PERCENT} value={windowPercentageCap} onValueChange={setWindowPercentageCap} />{" "}
          % of my screen
        </label>
        {!percentValid && <p className="text-sm text-red-600 mt-1">Must be between {PERCENT.min}% and {PERCENT.max}%</p>}
      </div>

      <div data-testid="maximum-window-levels" className="tracking-wider p-2">
        <label>
          I want the overdue window to have{" "}
          <NumberInput {...LEVELS} value={windowLevelCap} onValueChange={setWindowLevelCap} />{" "}
          level{windowLevelCap !== 1 && "s"} {" "}
          <span className="italic">
            (this means it will expand in size <span className="font-semibold">{growths}</span> time{growths !== 1 && "s"})
          </span>
        </label>
        {!levelsValid && <p className="text-sm text-red-600 mt-1">Must be between {LEVELS.min} and {LEVELS.max}</p>}
      </div>

      <div data-testid="level-threshold" className="tracking-wider p-2">
        <label>
          I want the overdue window to increase in size every{" "}
          <NumberInput {...THRESHOLD_SECONDS} value={levelThresholdInSeconds} onValueChange={setLevelThresholdInSeconds} />{" "}
          seconds
        </label>
        {!thresholdValid && <p className="text-sm text-red-600 mt-1">Must be between {THRESHOLD_SECONDS.min} and {THRESHOLD_SECONDS.max} seconds</p>}
      </div>
    </SettingsPanel>
  );
}

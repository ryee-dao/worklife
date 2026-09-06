import { useState } from "react";
// import { isDev } from "../../../common/constants";
import SettingsPanel from "./SettingsPanel";
import NumberInput from "../../../common/components/NumberInput";
import { OverdueConfigs } from "../../../../main/overdue/overdueConfigs";
import { CONSTRAINTS } from "../../../../shared/constants";
import { convertMsToSeconds, convertSecondsToMs } from "../../../../shared/utils/time";

export default function OverdueConfigsForm() {

  const [levelThresholdInSeconds, setLevelThresholdInSeconds] = useState(0)
  const [windowLevelCap, setWindowLevelCap] = useState(0)
  const [windowPercentageCap, setWindowPercentageCap] = useState(0)

  const levelThresholdInSecondsValid = levelThresholdInSeconds >= 5 && levelThresholdInSeconds <= 3600
  const windowLevelCapValid = windowLevelCap >= 1 && windowLevelCap <= CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_LEVEL
  const windowPercentageValid = windowPercentageCap >= 10 && windowPercentageCap <= CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_RATIO * 100
  const isValid = levelThresholdInSecondsValid && windowLevelCapValid && windowPercentageValid

  return (
    <SettingsPanel<OverdueConfigs>
      title="Overdue Configs"
      isValid={isValid}
      successMessage="Overdue configs saved successfully. Changes will reflect after next break"
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
          <NumberInput
            min={10}
            max={CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_RATIO * 100}
            value={windowPercentageCap}
            onChange={(e) => setWindowPercentageCap(Number(e.target.value))}
          />{" "}
          % of my screen
        </label>
        {!windowPercentageValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between 10% and {CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_RATIO * 100}%
          </p>
        )}
      </div>

      <div data-testid="maximum-window-levels" className="tracking-wider p-2">
        <label>
          I want the overdue window to have{" "}
          <NumberInput
            min={1}
            max={CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_LEVEL}
            value={windowLevelCap}
            onChange={(e) => setWindowLevelCap(Number(e.target.value))}
          />{" "}
          level{windowLevelCap !== 1 && "s"} {" "}
          <span className="italic">
            (this means it will expand in size{" "}
            <span className="font-semibold">
              {windowLevelCap - 1} {" "}
            </span>
            time{windowLevelCap - 1 !== 1 && "s"})
          </span>
        </label>
        {!windowLevelCapValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between 1 and {CONSTRAINTS.OVERDUE.MAXIMUM_WINDOW_LEVEL}
          </p>
        )}
      </div>

      <div data-testid="maximum-window-levels" className="tracking-wider p-2">
        <label>
          I want the overdue window to increase in size every{" "}
          <NumberInput
            min={5}
            max={3600}
            value={levelThresholdInSeconds}
            onChange={(e) => setLevelThresholdInSeconds(Number(e.target.value))}
          />{" "}
          seconds
        </label>
        {!levelThresholdInSecondsValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between 5 and 3600 seconds
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
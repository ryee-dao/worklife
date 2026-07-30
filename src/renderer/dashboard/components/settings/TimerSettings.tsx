import { useState } from "react";
import {
  convertMinutesToMs,
  convertMsToMinutes,
  convertMsToSeconds,
  convertSecondsToMs,
} from "../../../../shared/utils/time";
import { TimerConfig } from "../../../../main/timer/timerConfigs";
import { isDev } from "../../../common/constants";
import SettingsPanel from "./SettingsPanel";
import NumberInput from "../../../common/components/NumberInput";

export default function TimerSettings() {
  const [timerDurationInMinutes, setTimerDurationInMinutes] = useState(0);
  const [breakDurationInSeconds, setBreakDurationInSeconds] = useState(0);
  const [warningThresholdInMinutes, setWarningThresholdInMinutes] = useState(0);

  const timerValid = timerDurationInMinutes >= 1 && timerDurationInMinutes <= 600;
  const breakValid = breakDurationInSeconds >= (isDev ? 1 : 10) && breakDurationInSeconds <= 600;
  const warningMax = Math.max(1, timerDurationInMinutes - 1);
  const warningValid = warningThresholdInMinutes >= 1 && warningThresholdInMinutes <= warningMax;

  return (
    <SettingsPanel<TimerConfig>
      title="Timer Settings"
      isValid={timerValid && breakValid && warningValid}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      load={() => window.electronAPI.loadTimerConfig()}
      save={(config) => window.electronAPI.saveTimerConfig(config)}
      buildConfig={() => ({
        timerDurationMs: convertMinutesToMs(timerDurationInMinutes),
        breakDurationMs: convertSecondsToMs(breakDurationInSeconds),
        warningThresholdMs: convertMinutesToMs(warningThresholdInMinutes),
      })}
      onLoaded={(config) => {
        setTimerDurationInMinutes(convertMsToMinutes(config.timerDurationMs));
        setBreakDurationInSeconds(convertMsToSeconds(config.breakDurationMs));
        setWarningThresholdInMinutes(convertMsToMinutes(config.warningThresholdMs));
      }}
    >
      <div data-testid="timer-duration" className="tracking-wider p-2">
        <label>
          I want to take a break every{" "}
          <NumberInput min={1} max={600} value={timerDurationInMinutes}
            onChange={(e) => setTimerDurationInMinutes(Number(e.target.value))} />{" "}
          minutes
        </label>
        {!timerValid && (
          <p className="text-sm text-red-600 mt-1">Must be between 1 and 600 minutes</p>
        )}
      </div>

      <div data-testid="break-duration" className="tracking-wider p-2">
        <label>
          This break will last{" "}
          <NumberInput min={isDev ? 1 : 10} max={600} value={breakDurationInSeconds}
            onChange={(e) => setBreakDurationInSeconds(Number(e.target.value))} />{" "}
          seconds
        </label>
        {!breakValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between {isDev ? 1 : 10} and 600 seconds
          </p>
        )}
      </div>

      <div data-testid="warning-threshold" className="tracking-wider p-2">
        <label>
          I want a warning{" "}
          <NumberInput min={1} max={warningMax} value={warningThresholdInMinutes}
            onChange={(e) => setWarningThresholdInMinutes(Number(e.target.value))} />{" "}
          minutes before the break starts
        </label>
        {!warningValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between 1 and {warningMax} minutes
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
import { useState } from "react";
import { convertMinutesToMs, convertMsToMinutes } from "@shared/utils/time";
import { TimerConfigs } from "@main/timer/timerConfigs";
import SettingsPanel from "./SettingsPanel";
import NumberInput, { inRange } from "@renderer/common/components/NumberInput";

const BLOCK_MINUTES = { min: 1, max: 600 };

export default function TimerSettings() {
  const [timerDurationInMinutes, setTimerDurationInMinutes] = useState(0);
  const [warningThresholdInMinutes, setWarningThresholdInMinutes] = useState(0);

  const timerValid = inRange(timerDurationInMinutes, BLOCK_MINUTES);
  const warningMinutes = { min: 1, max: Math.max(1, timerDurationInMinutes - 1) }; // The warning comes before the end of the block
  const warningValid = inRange(warningThresholdInMinutes, warningMinutes);

  return (
    <SettingsPanel<TimerConfigs>
      title="Timer Settings"
      isValid={timerValid && warningValid}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      load={() => window.electronAPI.loadTimerConfigs()}
      save={(configs) => window.electronAPI.saveTimerConfigs(configs)}
      buildConfig={() => ({
        timerDurationMs: convertMinutesToMs(timerDurationInMinutes),
        warningThresholdMs: convertMinutesToMs(warningThresholdInMinutes),
      })}
      onLoaded={(configs) => {
        setTimerDurationInMinutes(convertMsToMinutes(configs.timerDurationMs));
        setWarningThresholdInMinutes(convertMsToMinutes(configs.warningThresholdMs));
      }}
    >
      <div data-testid="timer-duration" className="tracking-wider p-2">
        <label>
          I want to take a break every{" "}
          <NumberInput {...BLOCK_MINUTES} value={timerDurationInMinutes} onValueChange={setTimerDurationInMinutes} />{" "}
          minutes
        </label>
        {!timerValid && (
          <p className="text-sm text-red-600 mt-1">Must be between {BLOCK_MINUTES.min} and {BLOCK_MINUTES.max} minutes</p>
        )}
      </div>

      <div data-testid="warning-threshold" className="tracking-wider p-2">
        <label>
          I want a warning{" "}
          <NumberInput {...warningMinutes} value={warningThresholdInMinutes} onValueChange={setWarningThresholdInMinutes} />{" "}
          minutes before the break starts
        </label>
        {!warningValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between {warningMinutes.min} and {warningMinutes.max} minutes
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
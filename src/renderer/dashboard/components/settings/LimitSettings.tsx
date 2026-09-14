import { useState } from "react";
import { LimitConfigs } from "../../../../main/limit/limitConfigs";
import { isDev } from "../../../common/constants";
import SettingsPanel from "./SettingsPanel";
import NumberInput from "../../../common/components/NumberInput";

export default function LimitSettings() {
  const [allottedBreaks, setAllottedBreaks] = useState(0);

  const breaksMaxLimit = isDev ? 9999999 : 5;
  const allottedBreaksValid = allottedBreaks >= 0 && allottedBreaks <= breaksMaxLimit;

  return (
    <SettingsPanel<LimitConfigs>
      title="Limit Settings"
      isValid={allottedBreaksValid}
      successMessage="Settings saved successfully. Limits will reset after midnight"
      load={() => window.electronAPI.loadLimitConfigs()}
      save={(configs) => window.electronAPI.saveLimitConfigs(configs)}
      buildConfig={() => ({ allottedBreaks })}
      onLoaded={(configs) => setAllottedBreaks(configs.allottedBreaks)}
    >
      <div data-testid="allowed-break-count" className="tracking-wider p-2">
        <label>
          I will be able to skip{" "}
          <NumberInput
            min={0}
            max={breaksMaxLimit}
            value={allottedBreaks}
            onChange={(e) => setAllottedBreaks(Number(e.target.value))}
          />{" "}
          break(s) per day
        </label>
        {!allottedBreaksValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between 0 and {breaksMaxLimit}
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
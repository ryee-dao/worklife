import { useState } from "react";
import { LimitConfigs } from "../../../../main/limit/limitConfigs";
import { isDev } from "../../../common/constants";
import SettingsPanel from "./SettingsPanel";
import NumberInput from "../../../common/components/NumberInput";

export default function LimitSettings() {
  const [allotedBreaks, setAllotedBreaks] = useState(0);

  const breaksMaxLimit = isDev ? 9999999 : 5;
  const allotedBreaksValid = allotedBreaks >= 0 && allotedBreaks <= breaksMaxLimit;

  return (
    <SettingsPanel<LimitConfigs>
      title="Limit Settings"
      isValid={allotedBreaksValid}
      successMessage="Settings saved successfully. Limits will reset after midnight"
      load={() => window.electronAPI.loadLimitConfigs()}
      save={(configs) => window.electronAPI.saveLimitConfigs(configs)}
      buildConfig={() => ({ allotedBreaks })}
      onLoaded={(configs) => setAllotedBreaks(configs.allotedBreaks)}
    >
      <div data-testid="allowed-break-count" className="tracking-wider p-2">
        <label>
          I will be able to skip{" "}
          <NumberInput
            min={0}
            max={breaksMaxLimit}
            value={allotedBreaks}
            onChange={(e) => setAllotedBreaks(Number(e.target.value))}
          />{" "}
          break(s) per day
        </label>
        {!allotedBreaksValid && (
          <p className="text-sm text-red-600 mt-1">
            Must be between 0 and {breaksMaxLimit}
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
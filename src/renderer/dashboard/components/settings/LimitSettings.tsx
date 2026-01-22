import { useEffect, useState } from "react";
import { LimitConfig } from "../../../../main/limitConfigs";
import { isDev } from "../../../common/constants"

export default function LimitSettings() {
  const [allotedBreaks, setAllotedBreaks] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  const breaksMaxLimit = isDev ? 9999999 : 5;
  const allotedBreaksValid = allotedBreaks >= 0 && allotedBreaks <= breaksMaxLimit;
  const [saveMessage, setSaveMessage] = useState<string>("");

  useEffect(() => {
    setIsValid(validateSave());
  }, [allotedBreaksValid]);

  function validateSave() {
    return allotedBreaksValid;
  }

  useEffect(() => {
    const loadLimitsConfig = async () => {
      const limitConfig = await window.electronAPI.loadLimitConfig();
      setAllotedBreaks(limitConfig.allotedBreaks);
    };
    loadLimitsConfig();
    setIsLoading(false);
  }, []);

  async function saveChanges() {
    if (isValid) {
      const limitConfigs: LimitConfig = {
        allotedBreaks,
      };
      try {
        setIsSaving(true);
        await window.electronAPI.saveLimitConfig(limitConfigs);
        setSaveStatus("success");
        setSaveMessage(
          "Settings saved successfully. Limits will reset after midnight"
        );
      } catch (err) {
        setSaveStatus("error");
        setSaveMessage(String(err));
      } finally {
        setIsSaving(false);
      }
    }
  }

  return (
    <>
      {!isLoading && (
        <div className="p-3 flex flex-col h-full">
          <h2 className="font-semibold text-lg md:text-2xl">Limit Settings</h2>
          <hr className="text-slate-400 my-1" />
          <div className="grow text-sm md:text-lg">
            <div className="tracking-wider p-2">
              <label>
                I will be able to skip{" "}
                <input
                  className="w-12 text-center border rounded"
                  type="number"
                  min="0"
                  max={breaksMaxLimit}
                  value={allotedBreaks}
                  onChange={(e) => setAllotedBreaks(Number(e.target.value))}
                />{" "}
                break(s) per day
              </label>
              {!allotedBreaksValid && (
                <p className="text-sm text-red-600 mt-1">
                  Must be between 0 and 5
                </p>
              )}
            </div>
          </div>
          <div className="w-3/4 self-center text-xs lg:text-base text-slate-800 tracking-wider font-medium flex flex-col items-center">
            <button
              disabled={!isValid}
              onClick={saveChanges}
              className={`px-3 py-0.5 border rounded bg-blue-300 w-3/4 sm:w-48 ${!isValid
                ? "cursor-not-allowed bg-slate-400"
                : "active:bg-blue-500"
                }`}
            >
              SAVE CHANGES
            </button>
            {saveMessage && (
              <p
                className={`text-sm ${saveStatus === "error" ? "text-red-600" : "text-green-600"
                  } mt-1`}
              >
                {saveMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

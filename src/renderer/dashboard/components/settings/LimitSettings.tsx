import { useEffect, useState } from "react";
import { LimitConfig } from "../../../../main/limitConfigs";

export default function LimitSettings() {
  const [allotedBreaks, setAllotedBreaks] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const allotedBreaksValid = allotedBreaks >= 0 && allotedBreaks <= 5;
  const [saveMessage, setSaveMessage] = useState<string>("");

  useEffect(() => {
    setIsValid(validateSave());
  }, [allotedBreaksValid]);

  function validateSave() {
    return allotedBreaksValid;
  }

  useEffect(() => {
    console.log('usereffect')
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
          "Settings saved successfully. Changes will reflect after midnight"
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
          <h2 className="font-semibold text-2xl">Limit Settings</h2>
          <hr className="text-slate-400 my-1" />
          <div className="grow">
            <div className="tracking-wider p-2">
              <label>
                I will be able to skip{" "}
                <input
                  className="w-12 text-center border rounded"
                  type="number"
                  min="0"
                  max="5"
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
          <div className="self-center text-slate-800 tracking-wider font-medium flex flex-col items-center">
            <button
              disabled={!isValid}
              onClick={saveChanges}
              className={`px-3 py-0.5 border rounded bg-blue-300 w-48 ${
                !isValid
                  ? "cursor-not-allowed bg-slate-400"
                  : "active:bg-blue-500"
              }`}
            >
              SAVE CHANGES
            </button>
            {saveMessage && (
              <p
                className={`text-sm ${
                  saveStatus === "error" ? "text-red-600" : "text-green-600"
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

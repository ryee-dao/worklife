import { useEffect, useState } from "react";
import {
  convertMinutesToMs,
  convertMsToMinutes,
  convertMsToSeconds,
  convertSecondsToMs,
} from "../../../../shared/utils/time";
import { TimerConfig } from "../../../../main/timerConfigs";
import { isDev } from "../../../common/constants";

export default function TimerSettings() {
  const [timerDurationInMinutes, setTimerDurationInMinutes] =
    useState<number>(0);
  const [breakDurationInSeconds, setBreakDurationInSeconds] =
    useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [saveMessage, setSaveMessage] = useState<string>("");
  const timerValid =
    timerDurationInMinutes >= 1 && timerDurationInMinutes <= 600;
  const breakValid =
    breakDurationInSeconds >= (isDev ? 1 : 10) && breakDurationInSeconds <= 600;

  useEffect(() => {
    setIsValid(validateSave());
  }, [timerValid, breakValid]);

  function validateSave() {
    return timerValid && breakValid;
  }

  async function saveChanges() {
    if (isValid) {
      const timerConfig: TimerConfig = {
        timerDurationMs: convertMinutesToMs(timerDurationInMinutes),
        breakDurationMs: convertSecondsToMs(breakDurationInSeconds),
      };
      try {
        setIsSaving(true);
        await window.electronAPI.saveTimerConfig(timerConfig);
        setSaveStatus("success");
        setSaveMessage(
          "Settings saved successfully. Changes will reflect after next break"
        );
      } catch (err) {
        setSaveStatus("error");
        setSaveMessage(String(err));
      } finally {
        setIsSaving(false);
      }
    }
  }

  useEffect(() => {
    const loadTimerConfig = async () => {
      const timerConfig = await window.electronAPI.loadTimerConfig();
      setTimerDurationInMinutes(
        convertMsToMinutes(timerConfig.timerDurationMs)
      );
      setBreakDurationInSeconds(
        convertMsToSeconds(timerConfig.breakDurationMs)
      );
    };
    loadTimerConfig();
    setIsLoading(false);
  }, []);

  return (
    <>
      {!isLoading && (
        <div className="p-3 flex flex-col h-full">
          <h2 className="font-semibold text-lg md:text-2xl">Timer Settings</h2>
          <hr className="text-slate-400 my-1" />
          <div className="grow text-sm md:text-lg">
            <div className="tracking-wider p-2">
              <label>
                I want to take a break every{" "}
                <input
                  className="w-12 text-center border rounded"
                  type="number"
                  min="1"
                  max="600"
                  value={timerDurationInMinutes}
                  onChange={(e) =>
                    setTimerDurationInMinutes(Number(e.target.value))
                  }
                />{" "}
                minutes
              </label>
              {!timerValid && (
                <p className="text-sm text-red-600 mt-1">
                  Must be between 1 and 600 minutes
                </p>
              )}
            </div>
            <div className="tracking-wider p-2">
              <label>
                This break will last{" "}
                <input
                  className="w-12 text-center border rounded"
                  type="number"
                  min={(isDev ? 1 : 10)}
                  max="600"
                  value={breakDurationInSeconds}
                  onChange={(e) =>
                    setBreakDurationInSeconds(Number(e.target.value))
                  }
                />{" "}
                seconds
              </label>
              {!breakValid && (
                <p className="text-sm text-red-600 mt-1">
                  Must be between 10 and 600 seconds
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

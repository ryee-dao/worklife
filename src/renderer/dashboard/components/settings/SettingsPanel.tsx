import { ReactNode, useEffect, useState } from "react";

interface SettingsPanelProps<T> {
  title: string;
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
  buildConfig: () => T;        // caller assembles the config from its own state
  isValid: boolean;
  successMessage: string;
  onLoaded: (value: T) => void; // caller pushes loaded values into its own state
  children: ReactNode;          // the bespoke fields
}

export default function SettingsPanel<T>({
  title, load, save, buildConfig, isValid, successMessage, onLoaded, children,
}: SettingsPanelProps<T>) {
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    load().then((value) => {
      onLoaded(value);
      setIsLoading(false);
    });
  }, []);

  async function saveChanges() {
    if (!isValid) return;
    try {
      await save(buildConfig());
      setSaveStatus("success");
      setSaveMessage(successMessage);
    } catch (err) {
      setSaveStatus("error");
      setSaveMessage(String(err));
    }
  }

  if (isLoading) return null;

  return (
    <div className="p-3 flex flex-col h-full">
      <h2 className="font-semibold text-lg md:text-2xl">{title}</h2>
      <hr className="text-slate-400 my-1" />
      <div className="grow text-sm md:text-lg">{children}</div>
      <div className="w-3/4 self-center text-xs lg:text-base text-slate-800 tracking-wider font-medium flex flex-col items-center">
        <button
          disabled={!isValid}
          onClick={saveChanges}
          className={`px-3 py-0.5 border rounded bg-blue-300 w-3/4 sm:w-48 ${!isValid ? "cursor-not-allowed bg-slate-400" : "active:bg-blue-500"
            }`}
        >
          SAVE CHANGES
        </button>
        {saveMessage && (
          <p className={`text-sm ${saveStatus === "error" ? "text-red-600" : "text-green-600"} mt-1`}>
            {saveMessage}
          </p>
        )}
      </div>
    </div>
  );
}
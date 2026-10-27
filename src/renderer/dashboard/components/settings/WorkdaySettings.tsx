import { useState } from "react";
import { WorkdayConfigs } from "../../../../main/workday/workdayConfigs";
import SettingsPanel from "./SettingsPanel";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // Index matches Date.getDay()

export default function WorkdaySettings() {
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [autoStopAtEnd, setAutoStopAtEnd] = useState(false);

  // shortcut: overnight workdays aren't supported yet, so the end must come after the start
  const hoursValid = start < end; // "HH:MM" strings compare correctly as text

  const toggleDay = (day: number) => {
    const newDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setDays(newDays.sort((a, b) => a - b));
  };

  return (
    <SettingsPanel<WorkdayConfigs>
      title="Workday Settings"
      isValid={hoursValid}
      successMessage="Settings saved successfully. Changes will reflect starting tomorrow"
      load={() => window.electronAPI.loadWorkdayConfigs()}
      save={(configs) => window.electronAPI.saveWorkdayConfigs(configs)}
      buildConfig={() => ({ days, start, end, autoStopAtEnd })}
      onLoaded={(configs) => {
        setDays(configs.days);
        setStart(configs.start);
        setEnd(configs.end);
        setAutoStopAtEnd(configs.autoStopAtEnd);
      }}
    >
      <div data-testid="workday-days" className="tracking-wider p-2">
        I work on{" "}
        {dayNames.map((dayName, day) => (
          <label key={dayName} className="mr-2">
            <input type="checkbox" checked={days.includes(day)} onChange={() => toggleDay(day)} />{" "}
            {dayName}
          </label>
        ))}
      </div>

      <div data-testid="workday-hours" className="tracking-wider p-2">
        <label>
          from{" "}
          <input type="time" className="border rounded px-1" value={start}
            onChange={(e) => setStart(e.target.value)} />
        </label>{" "}
        <label>
          to{" "}
          <input type="time" className="border rounded px-1" value={end}
            onChange={(e) => setEnd(e.target.value)} />
        </label>
        {!hoursValid && (
          <p className="text-sm text-red-600 mt-1">The workday must end after it starts</p>
        )}
      </div>

      <div data-testid="workday-auto-stop" className="tracking-wider p-2">
        <label>
          <input type="checkbox" checked={autoStopAtEnd}
            onChange={(e) => setAutoStopAtEnd(e.target.checked)} />{" "}
          Stop the timer when my workday ends
        </label>
      </div>
    </SettingsPanel>
  );
}

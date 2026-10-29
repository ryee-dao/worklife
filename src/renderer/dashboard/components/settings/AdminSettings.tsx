import { useState } from "react";
import { TimerConfigs } from "../../../../main/timer/timerConfigs";
import { DifficultyConfigs } from "../../../../main/difficulty/difficultyConfigs";
import { WorkdayConfigs } from "../../../../main/workday/workdayConfigs";
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds, convertSecondsToMs } from "../../../../shared/utils/time";
import SettingsPanel from "./SettingsPanel";
import NumberInput from "../../../common/components/NumberInput";

interface AdminConfigs {
  timer: TimerConfigs;
  difficulty: DifficultyConfigs;
  workday: WorkdayConfigs;
}

// Dev only: the settings worth changing while testing, in one place. They save through the same calls as their own tabs,
// so they apply after the next break like always. Only the workday applies right away instead of tomorrow
export default function AdminSettings() {
  const [loaded, setLoaded] = useState<AdminConfigs>();
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [allottedPowerups, setAllottedPowerups] = useState(0);
  const [snoozeMinutes, setSnoozeMinutes] = useState(0);
  const [lunchMinutes, setLunchMinutes] = useState(0);
  const [decayMinutes, setDecayMinutes] = useState(0);
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");

  const isValid = timerSeconds >= 5 && breakSeconds >= 1 && allottedPowerups >= 0
    && snoozeMinutes >= 1 && lunchMinutes >= 1 && decayMinutes >= 1 && workStart < workEnd;

  const save = async ({ timer, difficulty, workday }: AdminConfigs) => {
    await Promise.all([
      window.electronAPI.saveTimerConfigs(timer),
      window.electronAPI.saveDifficultyConfigs(difficulty),
      window.electronAPI.saveWorkdayConfigs(workday),
    ]);
    await window.electronAPI.devApplyWorkday();
  };

  return (
    <SettingsPanel<AdminConfigs>
      title="Admin (dev only)"
      isValid={isValid}
      successMessage="Saved. The workday applies now, the rest after the next break"
      load={async () => ({
        timer: await window.electronAPI.loadTimerConfigs(),
        difficulty: await window.electronAPI.loadDifficultyConfigs(),
        workday: await window.electronAPI.loadWorkdayConfigs(),
      })}
      save={save}
      buildConfig={() => {
        const timerDurationMs = convertSecondsToMs(timerSeconds);
        return {
          // The warning has to fit inside a short test timer
          timer: { timerDurationMs, warningThresholdMs: Math.min(loaded!.timer.warningThresholdMs, timerDurationMs / 2) },
          difficulty: {
            level: "CUSTOM",
            custom: {
              breakDurationMs: convertSecondsToMs(breakSeconds),
              allottedPowerups,
              snoozeDurationMs: convertMinutesToMs(snoozeMinutes),
              lunchDurationMs: convertMinutesToMs(lunchMinutes),
              checkpointDecayMs: convertMinutesToMs(decayMinutes),
            },
          },
          workday: { ...loaded!.workday, start: workStart, end: workEnd },
        };
      }}
      onLoaded={(configs) => {
        setLoaded(configs);
        setTimerSeconds(convertMsToSeconds(configs.timer.timerDurationMs));
        setBreakSeconds(convertMsToSeconds(configs.difficulty.custom.breakDurationMs));
        setAllottedPowerups(configs.difficulty.custom.allottedPowerups);
        setSnoozeMinutes(convertMsToMinutes(configs.difficulty.custom.snoozeDurationMs));
        setLunchMinutes(convertMsToMinutes(configs.difficulty.custom.lunchDurationMs));
        setDecayMinutes(convertMsToMinutes(configs.difficulty.custom.checkpointDecayMs));
        setWorkStart(configs.workday.start);
        setWorkEnd(configs.workday.end);
      }}
    >
      <div className="tracking-wider p-2 flex flex-col gap-1">
        <label>Timer <NumberInput min={5} max={36000} value={timerSeconds} onChange={(e) => setTimerSeconds(Number(e.target.value))} /> seconds</label>
        <label>Break <NumberInput min={1} max={600} value={breakSeconds} onChange={(e) => setBreakSeconds(Number(e.target.value))} /> seconds</label>
        <label>Power-ups <NumberInput min={0} max={999} value={allottedPowerups} onChange={(e) => setAllottedPowerups(Number(e.target.value))} /> per day</label>
        <label>Snooze <NumberInput min={1} max={60} value={snoozeMinutes} onChange={(e) => setSnoozeMinutes(Number(e.target.value))} /> minutes</label>
        <label>Lunch <NumberInput min={1} max={120} value={lunchMinutes} onChange={(e) => setLunchMinutes(Number(e.target.value))} /> minutes</label>
        <label>Checkpoint drain <NumberInput min={1} max={120} value={decayMinutes} onChange={(e) => setDecayMinutes(Number(e.target.value))} /> minutes</label>
        <label>
          Workday{" "}
          <input type="time" className="border rounded px-1" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />{" "}
          to{" "}
          <input type="time" className="border rounded px-1" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
        </label>
        <p className="text-xs text-slate-500">Saving switches the difficulty to Custom.</p>
        <button
          type="button"
          data-testid="admin-reset-day"
          onClick={() => window.electronAPI.devResetDay()}
          className="self-start mt-2 border rounded px-2 py-1 cursor-pointer hover:bg-slate-200"
        >
          Reset today's power-ups and lunch
        </button>
        <div className="flex items-center gap-2">
          Today's checkpoint
          <button type="button" data-testid="admin-checkpoint-down" onClick={() => window.electronAPI.devAdjustCheckpoint(-1)}
            className="border rounded px-2 cursor-pointer hover:bg-slate-200">−1</button>
          <button type="button" data-testid="admin-checkpoint-up" onClick={() => window.electronAPI.devAdjustCheckpoint(1)}
            className="border rounded px-2 cursor-pointer hover:bg-slate-200">+1</button>
        </div>
      </div>
    </SettingsPanel>
  );
}

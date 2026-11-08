import { Fragment, useState } from "react";
import { AlarmClockPlus, Hourglass, Sandwich, TreePalm, Wrench, Zap } from "lucide-react";
import { DifficultyConfigs, DifficultyLevel } from "@main/difficulty/difficultyConfigs";
import { WorkdayConfigs } from "@main/workday/workdayConfigs";
import { getPresetConfigs } from "@shared/utils/difficulty";
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds, convertSecondsToMs } from "@shared/utils/time";
import { IS_DEV } from "@renderer/common/constants";
import SettingsPanel from "./SettingsPanel";
import NumberInput, { inRange } from "@renderer/common/components/NumberInput";
import DifficultyCard, { DifficultyValues, PresetLevel } from "./DifficultyCard";

const presetNames: Record<PresetLevel, string> = {
  EASY: "Easy",
  NORMAL: "Normal",
  HARD: "Hard",
};
const presetLevels = Object.keys(presetNames) as PresetLevel[];

const legendIcon = "size-3.5 sm:size-4";

export default function DifficultySettings() {
  const [level, setLevel] = useState<DifficultyLevel>("NORMAL");
  const [timerDurationMs, setTimerDurationMs] = useState<number>();
  const [workday, setWorkday] = useState<WorkdayConfigs>();
  const [breakDurationInSeconds, setBreakDurationInSeconds] = useState(0);
  const [allottedPowerups, setAllottedPowerups] = useState(0);
  const [snoozeDurationInMinutes, setSnoozeDurationInMinutes] = useState(0);
  const [lunchDurationInMinutes, setLunchDurationInMinutes] = useState(0);
  const [decayInMinutes, setDecayInMinutes] = useState(0);

  // Dev gets room to make breaks and power-ups trivial for testing
  const customFields = [
    { testId: "break-duration", icon: <TreePalm className="size-5 text-green-700" />, label: "Break", unit: "sec", range: { min: IS_DEV ? 1 : 10, max: 600 }, value: breakDurationInSeconds, set: setBreakDurationInSeconds },
    { testId: "allowed-powerup-count", icon: <Zap className="size-5 text-amber-500 fill-amber-400" />, label: "Power-ups", unit: "a day", range: { min: 0, max: IS_DEV ? 9999999 : 5, step: 1 as const }, value: allottedPowerups, set: setAllottedPowerups },
    { testId: "snooze-duration", icon: <AlarmClockPlus className="size-5 text-slate-600" />, label: "Snooze", unit: "min", range: { min: 1, max: 60 }, value: snoozeDurationInMinutes, set: setSnoozeDurationInMinutes },
    { testId: "lunch-duration", icon: <Sandwich className="size-5 text-orange-500" />, label: "Lunch", unit: "min", range: { min: 1, max: 120 }, value: lunchDurationInMinutes, set: setLunchDurationInMinutes },
    { testId: "checkpoint-decay", icon: <Hourglass className="size-5 text-red-600" />, label: "Stopped, lose a checkpoint every", unit: "min", range: { min: 1, max: 120 }, value: decayInMinutes, set: setDecayInMinutes },
  ];
  const isCustom = level === "CUSTOM";

  const presets = timerDurationMs === undefined || !workday ? []
    : presetLevels.map((preset) => ({ preset, values: getPresetConfigs(preset, timerDurationMs, workday) }));
  const largest = (stat: keyof DifficultyValues) => Math.max(...presets.map(({ values }) => values[stat]));
  const maximums: DifficultyValues = {
    breakDurationMs: largest("breakDurationMs"),
    allottedPowerups: largest("allottedPowerups"),
    snoozeDurationMs: largest("snoozeDurationMs"),
    lunchDurationMs: largest("lunchDurationMs"),
    checkpointDecayMs: largest("checkpointDecayMs"),
  };

  return (
    <SettingsPanel<DifficultyConfigs>
      title="Difficulty"
      isValid={!isCustom || customFields.every(({ value, range }) => inRange(value, range))}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      // Break and snooze scale with the saved timer length, and the checkpoint drain with the workday, so the page waits for all three
      load={async () => {
        const [difficulty, timer, workday] = await Promise.all([window.electronAPI.loadDifficultyConfigs(), window.electronAPI.loadTimerConfigs(), window.electronAPI.loadWorkdayConfigs()]);
        setTimerDurationMs(timer.timerDurationMs);
        setWorkday(workday);
        return difficulty;
      }}
      save={(configs) => window.electronAPI.saveDifficultyConfigs(configs)}
      buildConfig={() => ({
        level,
        custom: {
          breakDurationMs: convertSecondsToMs(breakDurationInSeconds),
          allottedPowerups,
          snoozeDurationMs: convertMinutesToMs(snoozeDurationInMinutes),
          lunchDurationMs: convertMinutesToMs(lunchDurationInMinutes),
          checkpointDecayMs: convertMinutesToMs(decayInMinutes),
        },
      })}
      onLoaded={(configs) => {
        setLevel(configs.level);
        setBreakDurationInSeconds(convertMsToSeconds(configs.custom.breakDurationMs));
        setAllottedPowerups(configs.custom.allottedPowerups);
        setSnoozeDurationInMinutes(convertMsToMinutes(configs.custom.snoozeDurationMs));
        setLunchDurationInMinutes(convertMsToMinutes(configs.custom.lunchDurationMs));
        setDecayInMinutes(convertMsToMinutes(configs.custom.checkpointDecayMs));
      }}
    >
      <div data-testid="difficulty-level" className="pt-3 sm:pt-4 px-1 sm:px-2 flex flex-col items-center">
        {presets.length > 0 && (
          <div data-testid="difficulty-presets" className="w-full max-w-3xl grid grid-cols-3 gap-2 sm:gap-4 rounded-2xl">
            {presets.map(({ preset, values }) => (
              <DifficultyCard
                key={preset}
                level={preset}
                name={presetNames[preset]}
                values={values}
                maximums={maximums}
                selected={level === preset}
                onSelect={() => setLevel(preset)}
              />
            ))}
          </div>
        )}

        {/* What the icons stand for, once, instead of on every card */}
        <div className="mt-4 sm:mt-5 flex flex-wrap justify-center gap-x-3 sm:gap-x-4 gap-y-1 text-[10px] sm:text-xs text-slate-500">
          <span className="flex items-center gap-1"><TreePalm className={`${legendIcon} text-green-700`} />break</span>
          <span className="flex items-center gap-1"><Zap className={`${legendIcon} text-amber-500 fill-amber-400`} />power-ups: snooze or skip a break</span>
          <span className="flex items-center gap-1"><AlarmClockPlus className={`${legendIcon} text-slate-600`} />snooze</span>
          <span className="flex items-center gap-1"><Sandwich className={`${legendIcon} text-orange-500`} />lunch</span>
          <span className="flex items-center gap-1"><Hourglass className={`${legendIcon} text-red-600`} />stopped: lose a checkpoint every</span>
        </div>

        <button
          data-testid="difficulty-custom"
          aria-pressed={isCustom}
          onClick={() => setLevel("CUSTOM")}
          className={`mt-2 sm:mt-3 flex items-center gap-1 rounded-full px-3 py-0.5 text-xs sm:text-sm cursor-pointer
            ${isCustom ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Wrench className="size-3.5 sm:size-4" /> Custom
        </button>
      </div>

      {isCustom && (
        <div className="mt-2 grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 items-center justify-center text-slate-700 tracking-wider px-2">
          {customFields.map(({ testId, icon, label, unit, range, value, set }) => (
            <Fragment key={testId}>
              {icon}
              <label data-testid={testId} className="col-span-2">
                {label}{" "}
                <NumberInput {...range} value={value} onValueChange={set} />{" "}
                {unit}
                {!inRange(value, range) && <span className="ml-2 text-sm text-red-600">{range.min} to {range.max}</span>}
              </label>
            </Fragment>
          ))}
        </div>
      )}
    </SettingsPanel>
  );
}

import { useEffect, useState } from "react";
import { AlarmClockPlus, Hourglass, Sandwich, TreePalm, Wrench, Zap } from "lucide-react";
import { DifficultyConfigs, DifficultyLevel } from "../../../../main/difficulty/difficultyConfigs";
import { WorkdayConfigs } from "../../../../main/workday/workdayConfigs";
import { getPresetConfigs } from "../../../../shared/utils/difficulty";
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds, convertSecondsToMs } from "../../../../shared/utils/time";
import { IS_DEV } from "../../../common/constants";
import SettingsPanel from "./SettingsPanel";
import NumberInput from "../../../common/components/NumberInput";
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

  // Break and snooze scale with the saved timer length, and the checkpoint drain with the workday
  useEffect(() => {
    window.electronAPI.loadTimerConfigs().then((configs) => setTimerDurationMs(configs.timerDurationMs));
    window.electronAPI.loadWorkdayConfigs().then(setWorkday);
  }, []);

  const breakMinSeconds = IS_DEV ? 1 : 10;
  const powerupsMaxLimit = IS_DEV ? 9999999 : 5;
  const breakValid = breakDurationInSeconds >= breakMinSeconds && breakDurationInSeconds <= 600;
  const allottedPowerupsValid = allottedPowerups >= 0 && allottedPowerups <= powerupsMaxLimit;
  const snoozeValid = snoozeDurationInMinutes >= 1 && snoozeDurationInMinutes <= 60;
  const lunchValid = lunchDurationInMinutes >= 1 && lunchDurationInMinutes <= 120;
  const decayValid = decayInMinutes >= 1 && decayInMinutes <= 120;
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
      isValid={!isCustom || (breakValid && allottedPowerupsValid && snoozeValid && lunchValid && decayValid)}
      successMessage="Settings saved successfully. Changes will reflect after next break"
      load={() => window.electronAPI.loadDifficultyConfigs()}
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
          <div className="w-full max-w-3xl grid grid-cols-3 gap-2 sm:gap-4">
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
          <TreePalm className="size-5 text-green-700" />
          <label data-testid="break-duration" className="col-span-2">
            Break{" "}
            <NumberInput min={breakMinSeconds} max={600} value={breakDurationInSeconds}
              onChange={(e) => setBreakDurationInSeconds(Number(e.target.value))} />{" "}
            sec
            {!breakValid && <span className="ml-2 text-sm text-red-600">{breakMinSeconds} to 600</span>}
          </label>

          <Zap className="size-5 text-amber-500 fill-amber-400" />
          <label data-testid="allowed-powerup-count" className="col-span-2">
            Power-ups{" "}
            <NumberInput min={0} max={powerupsMaxLimit} value={allottedPowerups}
              onChange={(e) => setAllottedPowerups(Number(e.target.value))} />{" "}
            a day
            {!allottedPowerupsValid && <span className="ml-2 text-sm text-red-600">0 to {powerupsMaxLimit}</span>}
          </label>

          <AlarmClockPlus className="size-5 text-slate-600" />
          <label data-testid="snooze-duration" className="col-span-2">
            Snooze{" "}
            <NumberInput min={1} max={60} value={snoozeDurationInMinutes}
              onChange={(e) => setSnoozeDurationInMinutes(Number(e.target.value))} />{" "}
            min
            {!snoozeValid && <span className="ml-2 text-sm text-red-600">1 to 60</span>}
          </label>

          <Sandwich className="size-5 text-orange-500" />
          <label data-testid="lunch-duration" className="col-span-2">
            Lunch{" "}
            <NumberInput min={1} max={120} value={lunchDurationInMinutes}
              onChange={(e) => setLunchDurationInMinutes(Number(e.target.value))} />{" "}
            min
            {!lunchValid && <span className="ml-2 text-sm text-red-600">1 to 120</span>}
          </label>

          <Hourglass className="size-5 text-red-600" />
          <label data-testid="checkpoint-decay" className="col-span-2">
            Stopped, lose a checkpoint every{" "}
            <NumberInput min={1} max={120} value={decayInMinutes}
              onChange={(e) => setDecayInMinutes(Number(e.target.value))} />{" "}
            min
            {!decayValid && <span className="ml-2 text-sm text-red-600">1 to 120</span>}
          </label>
        </div>
      )}
    </SettingsPanel>
  );
}

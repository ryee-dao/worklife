import { Sandwich, Zap } from "lucide-react";
import { TimerState } from "../../../../main/timer/timerState";
import { convertMsToMinutes } from "../../../../shared/utils/time";

interface PowerupBarProps {
  timerState: TimerState;
}

// What's left today: power-ups (spent by snoozing or skipping a break) and lunch, which can be taken from here
export default function PowerupBar({ timerState }: PowerupBarProps) {
  const canLunch = timerState.availableActions.includes("lunch");
  const lunchMinutes = convertMsToMinutes(timerState.lunchDurationMs);

  return (
    <div data-testid="timer-powerup-bar" className="
      absolute top-0 left-1/2 -translate-x-1/2 border-b-4 border-x-4 border-slate-600 hidden xsm:flex justify-center items-center
      gap-6 px-5 xsm:h-10 sm:h-12 md:h-14 sm:gap-10 sm:px-8 font-semibold text-lg sm:text-xl lg:text-3xl text-slate-700
    ">
      <span data-testid="powerup-count" title="Power-ups: snooze while working, or skip a break" className="flex items-center gap-1">
        <Zap className="size-5 sm:size-6 lg:size-8 text-amber-500 fill-amber-400" />
        {timerState.remainingPowerups}
      </span>
      <button
        data-testid="lunch-button"
        title={`Lunch, ${lunchMinutes} min`}
        aria-label={`Lunch, ${lunchMinutes} min`}
        disabled={!canLunch}
        onClick={() => window.electronAPI.startLunch()}
        className="flex items-center gap-1 rounded-md px-1 enabled:cursor-pointer enabled:hover:bg-slate-200 disabled:opacity-40"
      >
        <Sandwich className="size-5 sm:size-6 lg:size-8 text-orange-500" />
        <span data-testid="lunch-count">{timerState.remainingLunches}</span>
      </button>
    </div>
  );
}

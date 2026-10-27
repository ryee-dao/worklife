import { TimerState, TimerStatus } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface TimerTimeDisplayProps {
  timerState: TimerState;
}

const timerColorMapper: Record<TimerStatus | "WARNING", string> = {
  RUNNING: "text-green-600",
  BREAK: "text-blue-600",
  STOPPED: "text-slate-600",
  WARNING: "text-yellow-600",
  OVERDUE: "text-red-700",
  LUNCH: "text-cyan-600",
};

export default function TimerTimeDisplay({ timerState }: TimerTimeDisplayProps) {
  const formattedTime = formatMsToMMSS(timerState.currentCountdownMs || timerState.overdueTimeMs);
  const [minutes, seconds] = formattedTime.split(":");
  const timerColor = timerState.isWarning
    ? timerColorMapper.WARNING
    : timerColorMapper[timerState.status];

  return (
    // Top padding is the power-up bar's height (see PowerupBar) plus a gap, so the time always sits below it
    <div data-testid="timer-time-display" className={`h-2/3 pt-6 xsm:pt-11 sm:pt-13 md:pt-15 font-bold flex flex-col justify-center items-center ${timerColor}`}>
      <div data-testid="timer-time-digits" className="whitespace-nowrap tracking-widest leading-none text-[2rem] xsm:text-[4rem] sm:text-[7rem] md:text-[10rem] lg:text-[14rem]">
        <span>{minutes}</span> : <span>{seconds}</span>
      </div>
      {timerState.status === "LUNCH" && (
        <span data-testid="timer-lunch-label" className="text-sm sm:text-lg lg:text-2xl tracking-wide">Lunch · doesn't break your run</span>
      )}
    </div>
  );
}

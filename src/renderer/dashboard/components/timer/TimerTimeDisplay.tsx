import { TimerState, TimerStatus } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface TimerTimeDisplayProps {
  timerState: TimerState;
}

const timerColorMapper: Record<TimerStatus | "WARNING", string> = {
  RUNNING: "text-green-600",
  BREAK: "text-blue-600",
  PAUSED: "text-slate-600",
  WARNING: "text-yellow-600",
  OVERDUE: "text-red-700",
};

export default function TimerTimeDisplay({ timerState }: TimerTimeDisplayProps) {
  const formattedTime = formatMsToMMSS(timerState.currentCountdownMs || timerState.overdueTimeMs);
  const [minutes, seconds] = formattedTime.split(":");
  const timerColor = timerState.isWarning
    ? timerColorMapper.WARNING
    : timerColorMapper[timerState.status];

  return (
    <div data-testid="timer-time-display" className={`h-2/3 font-bold flex justify-center items-center ${timerColor}`}>
      <div className="tracking-widest text-[2rem] xsm:text-[4rem] sm:text-[7rem] md:text-[10rem] lg:text-[14rem]">
        <span>{minutes}</span> : <span>{seconds}</span>
      </div>
    </div>
  );
}
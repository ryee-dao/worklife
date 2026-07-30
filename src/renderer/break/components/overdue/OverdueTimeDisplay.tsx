import { TimerState } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface OverdueTimeDisplayProps {
  timerState: TimerState;
}

export default function OverdueTimeDisplay({ timerState }: OverdueTimeDisplayProps) {
  const [minutes, seconds] = formatMsToMMSS(timerState.overdueTimeMs).split(':');

  return (
    <div
      data-testid="overdue-time-display"
      className="text-red-700 font-bold text-3xl sm:text-6xl md:text-8xl lg:text-[9rem] tracking-wide md:tracking-widest"
    >
      <span>{minutes}</span> : <span>{seconds}</span>
    </div>
  );
}
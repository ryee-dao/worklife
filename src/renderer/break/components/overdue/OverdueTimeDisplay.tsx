import { TimerState } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface OverdueTimeDisplayProps {
  timerState: TimerState;
}

export default function OverdueTimeDisplay({ timerState }: OverdueTimeDisplayProps) {
  const [minutes, seconds] = formatMsToMMSS(timerState.overdueTimeMs).split(':');

  return (
    <div data-testid="overdue-time-display">
      <div className="h-full text-red-700 font-bold text-9xl tracking-widest">
        <span>{minutes}</span> : <span>{seconds}</span>
      </div>
      <div></div>
    </div>
  );
}

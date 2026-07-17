import { TimerState } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface OverdueTimeDisplay {
  timerState: TimerState;
}

export default function OverdueTimeDisplay({
  timerState,
}: OverdueTimeDisplay) {
  const formattedTime = formatMsToMMSS(timerState.overdueTimeMs);
  const hours = formattedTime.split(":")[0];
  const minutes = formattedTime.split(":")[1];
  return (
    <div data-testid="break-time-display">
      <div className="h-full text-red-700 font-bold text-9xl tracking-widest">
        <span>{hours}</span> : <span>{minutes}</span>
      </div>
      <div></div>
    </div>
  );
}

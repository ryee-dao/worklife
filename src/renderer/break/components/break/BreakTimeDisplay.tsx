import { TimerState } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface BreakTimeDisplayProps {
  timerState: TimerState;
}

export default function BreakTimeDisplay({
  timerState,
}: BreakTimeDisplayProps) {
  const [minutes, seconds] = formatMsToMMSS(timerState.currentCountdownMs).split(":");
  return (
    <div data-testid="break-window-time-display">
      <div className="h-full text-blue-800 font-bold text-4xl md:text-9xl tracking-widest">
        <span>{minutes}</span> : <span>{seconds}</span>
      </div>
    </div>
  );
}

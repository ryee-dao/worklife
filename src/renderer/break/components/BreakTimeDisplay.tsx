import { TimerState } from "../../../main/timerState";
import { formatMsToMMSS } from "../../../shared/utils/time";

interface BreakTimeDisplayProps {
  timerState: TimerState;
}

export default function BreakTimeDisplay({
  timerState,
}: BreakTimeDisplayProps) {
  const formattedTime = formatMsToMMSS(timerState.currentCountdownMs);
  const hours = formattedTime.split(":")[0];
  const minutes = formattedTime.split(":")[1];
  return (
    <div>
      <div className="h-full text-blue-800 font-bold text-9xl tracking-widest">
        <span>{hours}</span> : <span>{minutes}</span>
      </div>
      <div></div>
    </div>
  );
}

import { TimerState } from "@main/timer/timerState";
import { formatMsToMMSS } from "@shared/utils/time";

interface OverdueTimeDisplayProps {
  timerState: TimerState;
}

export default function OverdueTimeDisplay({ timerState }: OverdueTimeDisplayProps) {
  const [minutes, seconds] = formatMsToMMSS(timerState.overdueTimeMs).split(':');

  return (
    <div
      data-testid="overdue-window-time-display"
      className="text-red-700 font-bold text-xl @window-xsm:text-3xl @window-sm:text-6xl @window-md:text-8xl @window-lg:text-[9rem]
        tracking-normal @window-xsm:tracking-wide @window-md:tracking-widest @window-xsm:pl-[0.025em] @window-md:pl-[0.1em]"
    >
      <span>{minutes}</span> : <span>{seconds}</span>
    </div>
  );
}

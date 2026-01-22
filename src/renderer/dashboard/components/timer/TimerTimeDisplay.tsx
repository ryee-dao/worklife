import { TimerState, TimerStatus } from "../../../../main/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface TimerTimeDisplayProps {
  timerState: TimerState;
}

export default function TimerTimeDisplay({ timerState }: TimerTimeDisplayProps) {
  const formattedTime = formatMsToMMSS(timerState.currentCountdownMs);
  const hours = formattedTime.split(":")[0];
  const minutes = formattedTime.split(":")[1];

  const timerColorMapper: Record<TimerStatus, string> = {
    RUNNING: "text-green-600",
    BREAK: "text-blue-600",
    PAUSED: "text-slate-600",
  };
  const timerColor = timerColorMapper[timerState.status];

  return (
    <div className={`h-2/3 font-bold flex justify-center items-center ${timerColor}`}>
      <div className="tracking-widest text-[2rem] xsm:text-[4rem] sm:text-[7rem] md:text-[10rem] lg:text-[14rem]">
        <span>{hours}</span> : <span>{minutes}</span>
      </div>
    </div>
  );
}

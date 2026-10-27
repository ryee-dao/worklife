import { TimerState, TimerStatus } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";
import { DayScore } from "../../../../main/stats/cleanDays";
import ComplianceRing from "./ComplianceRing";

interface TimerTimeDisplayProps {
  timerState: TimerState;
  todayScore: DayScore | null;
}

const timerColorMapper: Record<TimerStatus | "WARNING", string> = {
  RUNNING: "text-green-600",
  BREAK: "text-blue-600",
  STOPPED: "text-slate-600",
  WARNING: "text-yellow-600",
  OVERDUE: "text-red-700",
};

export default function TimerTimeDisplay({ timerState, todayScore }: TimerTimeDisplayProps) {
  const formattedTime = formatMsToMMSS(timerState.currentCountdownMs || timerState.overdueTimeMs);
  const [minutes, seconds] = formattedTime.split(":");
  const timerColor = timerState.isWarning
    ? timerColorMapper.WARNING
    : timerColorMapper[timerState.status];

  return (
    // Ring sits at the bottom, leaving room for the skip box above it
    <div data-testid="timer-time-display" className={`h-2/3 font-bold flex justify-center items-end ${timerColor}`}>
      <ComplianceRing todayScore={todayScore}>
        <div className="whitespace-nowrap tracking-wider text-[17cqw] leading-none">
          <span>{minutes}</span> : <span>{seconds}</span>
        </div>
      </ComplianceRing>
    </div>
  );
}
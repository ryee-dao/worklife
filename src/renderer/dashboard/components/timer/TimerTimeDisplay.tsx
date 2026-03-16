import { useState, useEffect } from "react";
import { TimerState, TimerStatus } from "../../../../main/timer/timerState";
import { formatMsToMMSS } from "../../../../shared/utils/time";

interface TimerTimeDisplayProps {
  timerState: TimerState;
}

export default function TimerTimeDisplay({ timerState }: TimerTimeDisplayProps) {
  const [warningThresholdMs, setWarningThresholdMs] = useState<number | null>(null);
  const formattedTime = formatMsToMMSS(timerState.currentCountdownMs);
  const hours = formattedTime.split(":")[0];
  const minutes = formattedTime.split(":")[1];
  const warningThresholdMet = warningThresholdMs && timerState.currentCountdownMs <= warningThresholdMs

  const timerColorMapper: Record<TimerStatus | "WARNING", string> = {
    RUNNING: "text-green-600",
    BREAK: "text-blue-600",
    PAUSED: "text-slate-600",
    WARNING: "text-yellow-600"
  };
  const timerColor = timerColorMapper[timerState.status];

  function determineTimerColor() {
    if (warningThresholdMet && timerState.status !== "PAUSED") {
      return timerColorMapper["WARNING"]
    }
    return timerColor;
  }

  useEffect(() => {
    window.electronAPI.loadTimerConfig().then(config => {
      setWarningThresholdMs(config.warningThresholdMs);
    });
  }, []);


  return (
    <div data-testid="timer-time-display" className={`h-2/3 font-bold text- flex justify-center items-center ${determineTimerColor()}`}>
      <div className="tracking-widest text-[2rem] xsm:text-[4rem] sm:text-[7rem] md:text-[10rem] lg:text-[14rem]">
        <span>{hours}</span> : <span>{minutes}</span>
      </div>
    </div>
  );
}

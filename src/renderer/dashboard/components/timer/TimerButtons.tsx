import { PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import { AlarmClockPlus, SkipForward } from "lucide-react";
import { TimerState } from "../../../../main/timer/timerState";
import { convertMsToMinutes } from "../../../../shared/utils/time";
import CircularButton from "../../../common/components/CircularButton";
import PowerupCost from "../../../common/components/PowerupCost";

interface TimerButtonProps {
  timerState: TimerState;
}

export default function TimerButtons({ timerState }: TimerButtonProps) {
  const timerStatus = timerState.status;
  const canStop = timerState.availableActions.includes("stop");
  const canStart = timerState.availableActions.includes("start");
  const canForward = timerState.availableActions.includes("forward");
  const canSnooze = timerState.availableActions.includes("snooze");

  const toggleTimer = () => {
    if (canStop && canStart) throw new Error("Invalid state");
    if (canStop) window.electronAPI.stop();
    if (canStart) window.electronAPI.start();
  };

  return (
    <>
      {timerStatus !== "BREAK" && timerStatus !== "OVERDUE" && (
        <div data-testid="timer-buttons-container" className="grow">
          <div className="h-full flex justify-center gap-8">
            {(canStop || canStart) && (
              <CircularButton
                testId="toggle-timer-button"
                title={canStop ? "Stop (costs a checkpoint)" : timerStatus === "LUNCH" ? "Back from lunch" : "Resume"}
                onClick={toggleTimer}
                // Stopping costs a checkpoint, so it's the one red button
                className={`h-2/3 ${canStop ? "bg-red-100 border-red-400 hover:bg-red-200" : "bg-slate-200 hover:bg-slate-300"}`}
              >
                {canStop && <StopIcon className="h-2/3 text-red-700" />}
                {canStart && <PlayIcon className="h-2/3 text-slate-700 ml-1 lg:ml-4" />}
              </CircularButton>
            )}
            {canForward && (
              <CircularButton
                testId="forward-button"
                title="Forward to break"
                onClick={() => window.electronAPI.forwardToBreak()}
                className="h-2/3 bg-slate-200 hover:bg-slate-300"
              >
                <SkipForward className="h-1/2 w-1/2 text-slate-700" />
              </CircularButton>
            )}
            {canSnooze && (
              <CircularButton
                testId="snooze-button"
                title="Snooze (uses a power-up)"
                onClick={() => window.electronAPI.snooze()}
                className="h-2/3 bg-slate-200 hover:bg-slate-300"
              >
                <div className="flex flex-col items-center leading-none text-slate-700">
                  <AlarmClockPlus className="size-5 sm:size-7 lg:size-12" />
                  <span className="font-semibold text-base sm:text-lg lg:text-4xl">+{convertMsToMinutes(timerState.snoozeDurationMs)}m</span>
                </div>
                <PowerupCost />
              </CircularButton>
            )}
          </div>
        </div>
      )}
    </>
  );
}
import { PlayIcon, StopIcon, ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../../main/timer/timerState";
import { convertMsToMinutes } from "../../../../shared/utils/time";
import CircularButton from "../../../common/components/CircularButton";

interface TimerButtonProps {
  timerState: TimerState;
}

export default function TimerButtons({ timerState }: TimerButtonProps) {
  const timerStatus = timerState.status;
  const canStop = timerState.availableActions.includes("stop");
  const canStart = timerState.availableActions.includes("start");
  const canSkip = timerState.availableActions.includes("skip");
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
                onClick={toggleTimer}
                className="h-2/3 bg-slate-200 hover:bg-slate-300"
              >
                {canStop && <StopIcon className="h-2/3 text-slate-700" />}
                {canStart && <PlayIcon className="h-2/3 text-slate-700 ml-1 lg:ml-4" />}
              </CircularButton>
            )}
            {canSkip && (
              <CircularButton
                testId="skip-button"
                onClick={() => window.electronAPI.skipTimer()}
                className="h-2/3 bg-slate-200 hover:bg-slate-300"
              >
                <ForwardIcon className="h-2/3 text-slate-700 sm:ml-1 lg:ml-3" />
              </CircularButton>
            )}
            {canSnooze && (
              <CircularButton
                testId="snooze-button"
                onClick={() => window.electronAPI.snooze()}
                className="h-2/3 bg-slate-200 hover:bg-slate-300"
              >
                <div className="flex flex-col items-center leading-none text-slate-700">
                  <span className="font-semibold text-lg lg:text-4xl">+{convertMsToMinutes(timerState.snoozeDurationMs)}m</span>
                  <span className="text-xs lg:text-base">{timerState.remainingSnoozes} left</span>
                </div>
              </CircularButton>
            )}
          </div>
        </div>
      )}
    </>
  );
}
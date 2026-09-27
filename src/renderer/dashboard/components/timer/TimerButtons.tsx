import { PlayIcon, PauseIcon, ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../../main/timer/timerState";
import CircularButton from "../../../common/components/CircularButton";

interface TimerButtonProps {
  timerState: TimerState;
}

export default function TimerButtons({ timerState }: TimerButtonProps) {
  const timerStatus = timerState.status;
  const canPause = timerState.availableActions.includes("pause");
  const canStart = timerState.availableActions.includes("start");
  const canSkip = timerState.availableActions.includes("skip");

  const changePauseState = () => {
    if (canPause && canStart) throw new Error("Invalid state");
    if (canPause) window.electronAPI.pause();
    if (canStart) window.electronAPI.start();
  };

  return (
    <>
      {timerStatus !== "BREAK" && timerStatus !== "OVERDUE" && (
        <div data-testid="timer-buttons-container" className="grow">
          <div className="h-full flex justify-center gap-8">
            {(canPause || canStart) && (
              <CircularButton
                testId="toggle-timer-button"
                onClick={changePauseState}
                className="h-2/3 bg-slate-200 hover:bg-slate-300"
              >
                {canPause && <PauseIcon className="h-2/3 text-slate-700" />}
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
          </div>
        </div>
      )}
    </>
  );
}
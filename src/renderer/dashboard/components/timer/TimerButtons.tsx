import { PlayIcon, PauseIcon, ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../../main/timerState";

interface TimerButtonProps {
  timerState: TimerState;
}

export default function TimerButtons({ timerState }: TimerButtonProps) {
  const canPause = timerState.availableActions.includes("pause");
  const canStart = timerState.availableActions.includes("start");
  const canSkip = timerState.availableActions.includes("skip");

  const changePauseState = () => {
    if (canPause && canStart) {
      throw new Error("Invalid state");
    }
    if (canPause) window.electronAPI.pause();
    if (canStart) window.electronAPI.start();
  };

  const skipToBreak = () => {
    if (canSkip) window.electronAPI.skipTimer();
  };

  return (
    <div className="grow">
      <div className="h-full flex justify-center gap-8">
        {(canPause || canStart) && (
          <button
            onClick={changePauseState}
            className="aspect-square h-2/3 bg-green-200 rounded-full flex items-center justify-center hover:bg-green-300 transition-colors cursor-pointer"
          >
            {canPause && <PauseIcon className="h-2/3 text-green-700" />}
            {canStart && (
              <PlayIcon className="h-2/3 text-green-700 ml-1 lg:ml-4" />
            )}
          </button>
        )}
        {canSkip && (
          <button
            onClick={skipToBreak}
            disabled={timerState.availableActions.length === 0}
            className="aspect-square h-2/3 bg-green-200 rounded-full flex items-center justify-center hover:bg-green-300 transition-colors cursor-pointer"
          >
            <ForwardIcon className="h-2/3 text-green-700 ml-1 lg:ml-4" />
          </button>
        )}
      </div>
    </div>
  );
}

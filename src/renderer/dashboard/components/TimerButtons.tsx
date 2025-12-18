import { PlayIcon, PauseIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../main/timerState";

interface TimerButtonProps {
  timerState: TimerState;
}

export default function TimerButtons({ timerState }: TimerButtonProps) {
  const canPause = timerState.availableActions.includes("pause");
  const canStart = timerState.availableActions.includes("start");

  const changePauseState = () => {
    if (canPause && canStart) {
      throw new Error("Invalid state");
    }
    if (canPause) window.electronAPI.pause();
    if (canStart) window.electronAPI.start();
  };

  return (
    <div className="grow">
      <div className="h-full flex justify-center">
        {(canPause || canStart) && (
          <button
            onClick={changePauseState}
            disabled={timerState.availableActions.length === 0}
            className="aspect-square h-2/3 bg-green-200 rounded-full flex items-center justify-center hover:bg-green-300 transition-colors cursor-pointer"
          >
            {canPause && <PauseIcon className="h-2/3 text-green-700" />}
            {canStart && (
              <PlayIcon className="h-2/3 text-green-700 ml-1 lg:ml-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

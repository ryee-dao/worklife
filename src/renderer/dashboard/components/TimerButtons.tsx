import { PlayIcon, PauseIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../main/timerState";

interface TimerButtonProps {
  timerState: TimerState;
}

export default function TimerButtons({ timerState }: TimerButtonProps) {
  const isPaused = timerState.status === "PAUSED";

  const changePauseState = () => {
    if (isPaused) {
      window.electronAPI.start();
    } else {
      window.electronAPI.pause();
    }
  };

  return (
    <div className="grow">
      <div className="h-full flex justify-center">
        <button
          onClick={changePauseState}
          className="aspect-square h-2/3 bg-green-200 rounded-full flex items-center justify-center hover:bg-green-300 transition-colors cursor-pointer"
        >
          {!isPaused ? (
            <PauseIcon className="h-2/3 text-green-700" />
          ) : (
            <PlayIcon className="h-2/3 text-green-700 ml-1 lg:ml-4" />
          )}
        </button>
      </div>
    </div>
  );
}

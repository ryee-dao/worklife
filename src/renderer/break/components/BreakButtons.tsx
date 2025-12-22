import { ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../main/timerState";

interface BreakButtonProps {
  timerState: TimerState;
}

export default function BreakButtons({ timerState }: BreakButtonProps) {
  const isSkipping = timerState.currentCountdownMs <= 0;
  const canSkip = timerState.availableActions.includes("skip") && !isSkipping;

  const changeBreakState = () => {
    if (canSkip) window.electronAPI.skip();
  };

  return (
    <div className="h-full flex justify-center">
      {canSkip && (
        <button
          onClick={changeBreakState}
          disabled={timerState.availableActions.length === 0}
          className="h-full bg-green-200 rounded-full flex items-center justify-center hover:bg-green-300 transition-colors cursor-pointer"
        >
          {canSkip && <ForwardIcon className="h-2/3 text-blue-800" />}
        </button>
      )}
    </div>
  );
}

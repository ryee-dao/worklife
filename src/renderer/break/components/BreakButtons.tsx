import { ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../main/timerState";
import SlashedIcon from "../../common/components/SlashedIcon";

interface BreakButtonProps {
  timerState: TimerState;
}

export default function BreakButtons({ timerState }: BreakButtonProps) {
  const isSkipping = timerState.currentCountdownMs <= 0;
  const canSkip = timerState.availableActions.includes("skip") && !isSkipping;

  const changeBreakState = () => {
    if (canSkip) window.electronAPI.skipBreak();
  };

  return (
    <div className="h-full flex justify-center">
      <button
        onClick={changeBreakState}
        disabled={!canSkip}
        className={`h-full aspect-square bg-green-200 rounded-full flex items-center justify-center transition-colors ${
          canSkip
            ? "hover:bg-blue-300 cursor-pointer text-blue-800"
            : "cursor-not-allowed text-slate-700 hover:bg-slate-300"
        }`}
      >
        {canSkip ? (
          <ForwardIcon className="h-2/3" />
        ) : (
          <SlashedIcon icon={ForwardIcon} className="h-2/3" />
        )}
      </button>
    </div>
  );
}

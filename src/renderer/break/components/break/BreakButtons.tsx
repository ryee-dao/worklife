import { ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../../main/timer/timerState";
import SlashedIcon from "../../../common/components/SlashedIcon";
import CircularButton from "../../../common/components/CircularButton";

interface BreakButtonProps {
  timerState: TimerState;
}

export default function BreakButtons({ timerState }: BreakButtonProps) {
  const isSkipping = timerState.currentCountdownMs <= 0;
  const canSkip = timerState.availableActions.includes("skip") && !isSkipping;

  return (
    <CircularButton
      testId="break-skip"
      onClick={() => canSkip && window.electronAPI.skipBreak()}
      disabled={!canSkip}
      className={`h-full ${canSkip
        ? "bg-blue-300 text-blue-800 hover:bg-blue-300"
        : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
    >
      {canSkip ? (
        <ForwardIcon className="h-2/3" />
      ) : (
        <SlashedIcon icon={ForwardIcon} className="h-2/3" />
      )}
    </CircularButton>
  );
}
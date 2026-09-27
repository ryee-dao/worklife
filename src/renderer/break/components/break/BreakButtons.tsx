import { ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../../main/timer/timerState";
import SlashedIcon from "../../../common/components/SlashedIcon";
import CircularButton from "../../../common/components/CircularButton";

interface BreakButtonProps {
  timerState: TimerState;
}

export default function BreakButtons({ timerState }: BreakButtonProps) {
  const canSkip = timerState.availableActions.includes("skip");

  return (
    <CircularButton
      testId="break-window-skip-break-button"
      onClick={() => canSkip && window.electronAPI.skipBreak()}
      disabled={!canSkip}
      className={`h-full ${canSkip
        ? "bg-blue-200 text-slate-600 hover:bg-slate-300"
        : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
    >
      {canSkip ? (
        <ForwardIcon className="h-2/3" />
      ) : (
        <SlashedIcon icon={ForwardIcon} slashSize={4} className="h-2/3" />
      )}
    </CircularButton>
  );
}
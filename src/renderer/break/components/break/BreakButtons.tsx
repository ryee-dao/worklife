import { FastForward, Square } from "lucide-react";
import { TimerState } from "../../../../main/timer/timerState";
import SlashedIcon from "../../../common/components/SlashedIcon";
import CircularButton from "../../../common/components/CircularButton";

interface BreakButtonProps {
  timerState: TimerState;
}

export default function BreakButtons({ timerState }: BreakButtonProps) {
  const canSkip = timerState.availableActions.includes("skip");

  return (
    <div className="h-full flex items-center gap-[4vw]">
      <CircularButton
        testId="break-window-skip-break-button"
        title="Skip break (uses a power-up)"
        onClick={() => canSkip && window.electronAPI.skipBreak()}
        disabled={!canSkip}
        className={`h-full ${canSkip
          ? "bg-blue-200 text-slate-600 hover:bg-slate-300"
          : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
      >
        {canSkip ? (
          <FastForward className="h-1/2 w-1/2" />
        ) : (
          <SlashedIcon icon={FastForward} slashSize={4} className="h-1/2 w-1/2" />
        )}
      </CircularButton>

      {/* The escape hatch, which costs a checkpoint like any stop */}
      <CircularButton
        testId="break-window-stop-button"
        title="Stop (costs a checkpoint)"
        onClick={() => window.electronAPI.stop()}
        className="h-2/5 bg-slate-100 border-slate-400 text-slate-700 hover:bg-slate-200"
      >
        <Square className="h-2/5 w-2/5" />
      </CircularButton>
    </div>
  );
}

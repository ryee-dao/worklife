import { TimerState } from "../../../../main/timer/timerState";
import { TreePalm } from 'lucide-react';
import { ForwardIcon } from "@heroicons/react/24/outline";
import CircularButton from "../../../common/components/CircularButton";
import SlashedIcon from "../../../common/components/SlashedIcon";

interface OverdueButtonsProps {
  timerState: TimerState;
}

export default function OverdueButtons({ timerState }: OverdueButtonsProps) {
  const canStartBreak = timerState.availableActions.includes("breaktime");
  const canSkip = timerState.availableActions.includes("skip");

  return (
    <div className="flex gap-2 sm:gap-14 lg:gap-30">

      <CircularButton
        testId="overdue-window-skip-break-button"
        onClick={() => canSkip && window.electronAPI.skipBreak()}
        disabled={!canSkip}
        className={`h-[30vh] bg-blue-100 border-slate-500 text-slate-600
        hover:bg-slate-300 hover:text-slate-700`}
      >
        {canSkip ? (
          <ForwardIcon className="h-2/3" />
        ) : (
          <SlashedIcon icon={ForwardIcon} slashSize={1} className="h-2/3" />
        )}
      </CircularButton>
      
      <CircularButton
        testId="overdue-window-start-break-button"
        onClick={() => canStartBreak && window.electronAPI.startBreak()}
        disabled={!canStartBreak}
        className="h-[30vh] bg-blue-200 border-blue-500 text-green-800
        hover:bg-blue-300"
      >
        <TreePalm className="size:8 xsm:size-12 sm:size-18 md:size-24 lg:size-32" />
      </CircularButton>

    </div>

  );
}
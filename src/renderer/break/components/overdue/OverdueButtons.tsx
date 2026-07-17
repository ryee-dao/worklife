// import { ForwardIcon } from "@heroicons/react/24/outline";
import { TimerState } from "../../../../main/timer/timerState";
// import SlashedIcon from "../../../common/components/SlashedIcon";
import { TreePalm } from 'lucide-react';

interface OverdueButtonsProps {
  timerState: TimerState;
}

export default function OverdueButtons({ timerState }: OverdueButtonsProps) {
  const canStartBreak = timerState.availableActions.includes("breaktime"); // This is a little redundant but can stay to keep {timerState}
  const startBreak = () => {
    if (canStartBreak) window.electronAPI.startBreak();
  };


  return (
    <div className="h-full flex justify-center">
      <button
        data-testid="start-break"
        onClick={startBreak}
        disabled={!canStartBreak} // Ideally should never be disabled
        className={`h-full aspect-square bg-yellow-200 rounded-full flex items-center 
          justify-center transition-colors hover:bg-blue-300 
          cursor-pointer text-green-800`
        }
      >
        <TreePalm className="size-24"/>
      </button>
    </div>
  );
}

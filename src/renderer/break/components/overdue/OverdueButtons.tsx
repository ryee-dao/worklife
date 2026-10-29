import { TimerState } from "../../../../main/timer/timerState";
import { FastForward, Sandwich, Square, TreePalm } from 'lucide-react';
import CircularButton from "../../../common/components/CircularButton";
import SlashedIcon from "../../../common/components/SlashedIcon";
import PowerupCost from "../../../common/components/PowerupCost";

interface OverdueButtonsProps {
  timerState: TimerState;
}

// Every button in the window is the same size
const buttonSize = "h-[min(22vh,20vw)] w-[min(22vh,20vw)]";

export default function OverdueButtons({ timerState }: OverdueButtonsProps) {
  const canStartBreak = timerState.availableActions.includes("breaktime");
  const canSkip = timerState.availableActions.includes("skip");
  const canLunch = timerState.availableActions.includes("lunch");

  return (
    <div className="flex gap-[3vw]">
      <CircularButton
        testId="overdue-window-skip-break-button"
        title="Skip break (uses a power-up)"
        onClick={() => canSkip && window.electronAPI.skipBreak()}
        disabled={!canSkip}
        className={`${buttonSize} bg-blue-100 border-slate-500 text-slate-600
        hover:bg-slate-300 hover:text-slate-700`}
      >
        {canSkip ? (
          <FastForward className="h-1/2 w-1/2" />
        ) : (
          <SlashedIcon icon={FastForward} slashSize={1} className="h-1/2 w-1/2" />
        )}
        <PowerupCost />
      </CircularButton>

      <CircularButton
        testId="overdue-window-start-break-button"
        title="Start break"
        onClick={() => canStartBreak && window.electronAPI.startBreak()}
        disabled={!canStartBreak}
        className={`${buttonSize} bg-blue-200 border-blue-500 text-green-800 hover:bg-blue-300`}
      >
        <TreePalm className="h-1/2 w-1/2" />
      </CircularButton>

      {/* Lunch counts as taking the break. Stop is the escape hatch, and costs a checkpoint like any stop */}
      {canLunch && (
        <CircularButton
          testId="overdue-window-lunch-button"
          title="Lunch"
          onClick={() => window.electronAPI.startLunch()}
          className={`${buttonSize} bg-orange-50 border-orange-300 text-orange-500 hover:bg-orange-100`}
        >
          <Sandwich className="h-1/2 w-1/2" />
        </CircularButton>
      )}
      <CircularButton
        testId="overdue-window-stop-button"
        title="Stop (costs a checkpoint)"
        onClick={() => window.electronAPI.stop()}
        className={`${buttonSize} bg-red-100 border-red-400 text-red-700 hover:bg-red-200`}
      >
        <Square className="h-2/5 w-2/5" />
      </CircularButton>
    </div>
  );
}

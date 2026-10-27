import { TimerState } from "../../../../main/timer/timerState";
import { FastForward, Sandwich, Square, TreePalm } from 'lucide-react';
import CircularButton from "../../../common/components/CircularButton";
import SlashedIcon from "../../../common/components/SlashedIcon";

interface OverdueButtonsProps {
  timerState: TimerState;
}

export default function OverdueButtons({ timerState }: OverdueButtonsProps) {
  const canStartBreak = timerState.availableActions.includes("breaktime");
  const canSkip = timerState.availableActions.includes("skip");
  const canLunch = timerState.availableActions.includes("lunch");

  return (
    <div className="flex flex-col items-center gap-[3vh]">
      <div className="flex gap-[4vw]">
        <CircularButton
          testId="overdue-window-skip-break-button"
          title="Skip break (uses a power-up)"
          onClick={() => canSkip && window.electronAPI.skipBreak()}
          disabled={!canSkip}
          className={`h-[min(30vh,40vw)] w-[min(30vh,40vw)] bg-blue-100 border-slate-500 text-slate-600
          hover:bg-slate-300 hover:text-slate-700`}
        >
          {canSkip ? (
            <FastForward className="h-1/2 w-1/2" />
          ) : (
            <SlashedIcon icon={FastForward} slashSize={1} className="h-1/2 w-1/2" />
          )}
        </CircularButton>

        <CircularButton
          testId="overdue-window-start-break-button"
          title="Start break"
          onClick={() => canStartBreak && window.electronAPI.startBreak()}
          disabled={!canStartBreak}
          className="h-[min(30vh,40vw)] w-[min(30vh,40vw)] bg-blue-200 border-blue-500 text-green-800
          hover:bg-blue-300"
        >
          <TreePalm className="size-8 xsm:size-12 sm:size-18 md:size-24 lg:size-32" />
        </CircularButton>
      </div>

      {/* Lunch counts as taking the break. Stop is the escape hatch, and costs a checkpoint like any stop */}
      <div className="flex gap-[4vw]">
        {canLunch && (
          <CircularButton
            testId="overdue-window-lunch-button"
            title="Lunch"
            onClick={() => window.electronAPI.startLunch()}
            className="h-[min(12vh,16vw)] w-[min(12vh,16vw)] bg-orange-100 border-orange-400 text-orange-700 hover:bg-orange-200"
          >
            <Sandwich className="h-1/2 w-1/2" />
          </CircularButton>
        )}
        <CircularButton
          testId="overdue-window-stop-button"
          title="Stop (costs a checkpoint)"
          onClick={() => window.electronAPI.stop()}
          className="h-[min(12vh,16vw)] w-[min(12vh,16vw)] bg-slate-100 border-slate-400 text-slate-700 hover:bg-slate-200"
        >
          <Square className="h-2/5 w-2/5" />
        </CircularButton>
      </div>
    </div>
  );
}

import { TimerState } from "../../../../main/timer/timerState";
import { TreePalm } from 'lucide-react';
import CircularButton from "../../../common/components/CircularButton";

interface OverdueButtonsProps {
  timerState: TimerState;
}

export default function OverdueButtons({ timerState }: OverdueButtonsProps) {
  const canStartBreak = timerState.availableActions.includes("breaktime");

  return (
    <CircularButton
      testId="start-break"
      onClick={() => canStartBreak && window.electronAPI.startBreak()}
      disabled={!canStartBreak}
      className="h-[30vh] bg-blue-200 border-blue-500 text-green-800
        hover:bg-blue-300"
    >
      <TreePalm className="size-12 sm:size-18 md:size-24 lg:size-32" />
    </CircularButton>
  );
}
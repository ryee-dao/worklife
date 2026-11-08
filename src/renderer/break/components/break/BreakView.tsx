import BreakTimeDisplay from "@renderer/break/components/break/BreakTimeDisplay";
import { TimerState } from "@main/timer/timerState";
import BreakButtons from "@renderer/break/components/break/BreakButtons";

interface BreakViewProps {
  timerState: TimerState;
}

// Sizes follow the box it's in (container queries), so it looks the same full screen and in a demo box.
// Letter-spacing trails the last letter, so the same amount of left padding keeps the title centered
export default function BreakView({ timerState }: BreakViewProps) {

  return (
    <div className="[container-type:size] flex flex-col items-center h-full bg-green-200">
      <div
        data-testid="break-window-title"
        className="h-1/3 text-blue-800 font-bold flex items-end text-4xl @window-md:text-9xl @window-lg:text-[12rem] tracking-[.35em] pl-[.35em]"
      >
        <span>BREAK</span>
      </div>
      <div className="h-2/3 flex flex-col items-center">
        <div className="h-1/2 flex justify-center pt-4">
          <BreakButtons timerState={timerState} />
        </div>
        <div className="h-1/2 flex justify-center">
          <BreakTimeDisplay timerState={timerState} />
        </div>
      </div>
    </div>
  );
}

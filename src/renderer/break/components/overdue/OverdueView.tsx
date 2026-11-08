import { TimerState } from "@main/timer/timerState";
import OverdueButtons from "./OverdueButtons";
import OverdueTimeDisplay from "./OverdueTimeDisplay";

interface OverdueViewProps {
  timerState: TimerState;
}

// Sizes follow the box it's in (container queries), so it looks the same in its own window and in a demo box.
// Letter-spacing trails the last letter, so the same amount of left padding keeps the text centered
export default function OverdueView({ timerState }: OverdueViewProps) {
  return (
    <div className="[container-type:size] flex flex-col items-center justify-between py-[8cqh] h-full bg-yellow-200">
      <span
        data-testid="overdue-window-title"
        className="text-red-700 font-bold text-xl @window-xsm:text-3xl @window-sm:text-6xl @window-md:text-8xl @window-lg:text-[9rem]
          tracking-normal @window-xsm:tracking-[.5rem] @window-md:tracking-[2rem] @window-xsm:pl-[.5rem] @window-md:pl-[2rem]"
      >
        OVERDUE
      </span>
      <OverdueButtons timerState={timerState} />
      <OverdueTimeDisplay timerState={timerState} />
    </div>
  );
}

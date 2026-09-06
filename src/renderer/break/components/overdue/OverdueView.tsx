import { TimerState } from "../../../../main/timer/timerState";
import OverdueButtons from "./OverdueButtons";
import OverdueTimeDisplay from "./OverdueTimeDisplay";

interface OverdueViewProps {
  timerState: TimerState;
}

export default function OverdueView({ timerState }: OverdueViewProps) {
  if (!timerState) return null;

  return (
    <div className="flex flex-col items-center justify-between py-[8vh] h-screen bg-yellow-200">
      <span className="text-red-700 font-bold text-xl xsm:text-3xl sm:text-6xl md:text-8xl lg:text-[9rem] tracking-normal xsm:tracking-[.5rem] md:tracking-[2rem]">
        OVERDUE
      </span>
      <OverdueButtons timerState={timerState} />
      <OverdueTimeDisplay timerState={timerState} />
    </div>
  );
}
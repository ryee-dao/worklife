import { TimerState } from "../../../../main/timer/timerState";
import OverdueButtons from "./OverdueButtons";
import OverdueTimeDisplay from "./OverdueTimeDisplay";

interface OverdueViewProps {
  timerState: TimerState;
}

export default function OverdueView({ timerState }: OverdueViewProps) {

  return (
    <div className="flex flex-col items-center h-screen bg-yellow-200">
      <div className="h-1/3 text-red-700 font-bold flex items-end text-9xl lg:text-[12rem] tracking-widest">
        <span>OVERDUE</span>
      </div>
      <div className="h-2/3 flex-col">
        {timerState && (
          <>
            <div className="h-1/2 pt-4">
              <OverdueButtons timerState={timerState} />
            </div>
            <div className="h-1/2 flex">
              <OverdueTimeDisplay timerState={timerState} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import BreakTimeDisplay from "../break/BreakTimeDisplay";
import { TimerState } from "../../../../main/timer/timerState";
import BreakButtons from "../break/BreakButtons";

interface BreakViewProps {
  timerState: TimerState;
}

export default function BreakView({ timerState }: BreakViewProps) {

  return (
    <div className="flex flex-col items-center h-screen bg-green-200">
      <div className="h-1/3 text-blue-800 font-bold flex items-end text-9xl lg:text-[12rem] tracking-[.35em]">
        <span>BREAK</span>
      </div>
      <div className="h-2/3 flex-col">
        {timerState && (
          <>
            <div className="h-1/2 pt-4">
              <BreakButtons timerState={timerState} />
            </div>
            <div className="h-1/2 flex">
              <BreakTimeDisplay timerState={timerState} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

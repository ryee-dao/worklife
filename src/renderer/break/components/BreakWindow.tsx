import { useEffect, useState } from "react";
import BreakTimeDisplay from "./BreakTimeDisplay";
import { TimerState } from "../../../main/timerState";
import BreakButtons from "./BreakButtons";

export default function BreakWindow() {
  let [timerStateObject, setTimerStateObject] = useState<TimerState>();
  useEffect(() => {
    window.electronAPI.onTimerUpdate((timerState) => {
      setTimerStateObject(timerState);
    });
  }, []);

  return (
    <div className="flex flex-col items-center h-screen bg-green-200">
      <div className="h-1/3 text-blue-600 font-bold flex items-end text-9xl lg:text-[12rem] tracking-[.35em]">
        <span>BREAK</span>
      </div>
      <div className="h-2/3 flex-col">
        {timerStateObject && (
          <>
            <div className="h-1/2">
              <BreakButtons timerState={timerStateObject} />
            </div>
            <div className="h-1/2 flex">
              <BreakTimeDisplay timerState={timerStateObject} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

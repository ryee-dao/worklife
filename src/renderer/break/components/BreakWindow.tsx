import { useEffect, useState } from "react";
import BreakTimeDisplay from "./BreakTimeDisplay";
import { TimerState } from "../../../main/timerState";

export default function BreakWindow() {
  let [timerStateObject, setTimerStateObject] = useState<TimerState>();
  useEffect(() => {
    window.electronAPI.onTimerUpdate((timerState) => {
      setTimerStateObject(timerState);
    });
  }, []);

  console.log(JSON.stringify(timerStateObject));

  return (
    <div className="flex flex-col items-center h-screen bg-blue-200">
      <div className="h-2/3 text-green-600 font-bold flex items-center text-9xl tracking-[.35em]">
        <span>BREAK</span>
      </div>
      {timerStateObject && (
        <div className="h-1/3 flex text-blue-800 font-bold text-6xl tracking-widest">
          <BreakTimeDisplay timerState={timerStateObject}></BreakTimeDisplay>
        </div>
      )}
    </div>
  );
}

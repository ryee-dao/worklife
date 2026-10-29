import { useEffect, useState } from "react";
import { TimerState } from "../../../main/timer/timerState";
import BreakView from "./break/BreakView";
import OverdueView from "./overdue/OverdueView";


export default function BreakWindow() {
  const [timerStateObject, setTimerStateObject] = useState<TimerState>();
  useEffect(() => {
    window.electronAPI.getTimerState().then(setTimerStateObject);
    return window.electronAPI.onTimerUpdate(setTimerStateObject);
  }, []);

  return (
    <>
      {
        timerStateObject?.status === "OVERDUE" && <OverdueView timerState={timerStateObject} />
      }
      {
        timerStateObject?.status === "BREAK" && <BreakView timerState={timerStateObject} />
      }
    </>
  )
}

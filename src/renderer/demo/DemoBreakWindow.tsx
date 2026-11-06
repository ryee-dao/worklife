import { useEffect, useState } from "react";
import { TimerState } from "@main/timer/timerState";
import { OverdueLevelObject } from "@main/overdue/overdueGeometry";
import BreakWindowFrame from "@renderer/common/components/BreakWindowFrame";

interface DemoBreakWindowProps {
  getLevels: () => OverdueLevelObject[]; // Read each time, since saved overdue settings apply after a break
}

// Stands in for the app's second window: it opens over the dashboard when the timer goes overdue, as the real one opens over
// the screen. Only the window itself takes clicks, so the tabs behind it still work, like the app
export default function DemoBreakWindow({ getLevels }: DemoBreakWindowProps) {
  const [timerState, setTimerState] = useState<TimerState>();
  const [screen, setScreen] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => window.electronAPI.onTimerUpdate(setTimerState), []);
  useEffect(() => {
    const measure = () => setScreen({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (!timerState || (timerState.status !== "OVERDUE" && timerState.status !== "BREAK")) return null;

  return (
    <div data-testid="demo-break-host" className="fixed inset-0 z-40 pointer-events-none">
      <BreakWindowFrame timerState={timerState} screen={screen} levels={getLevels()} />
    </div>
  );
}

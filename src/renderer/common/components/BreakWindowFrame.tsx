import { TimerState } from "@main/timer/timerState";
import { convertOverdueLevelObjectToScreenSize, convertOverdueTimeToOverdueLevelObject, OverdueLevelObject } from "@main/overdue/overdueGeometry";
import OverdueView from "@renderer/break/components/overdue/OverdueView";
import BreakView from "@renderer/break/components/break/BreakView";

interface BreakWindowFrameProps {
  timerState: TimerState;
  screen: { width: number; height: number }; // What the window grows against: the box this is drawn in
  levels: OverdueLevelObject[];
}

// The break window as it appears on screen, drawn inside a box: overdue grows a level at a time, a break fills the screen.
// Used by the first-run tour and the web demo, which have no second window to open
export default function BreakWindowFrame({ timerState, screen, levels }: BreakWindowFrameProps) {
  const size = timerState.status === "BREAK"
    ? screen
    : convertOverdueLevelObjectToScreenSize(screen, convertOverdueTimeToOverdueLevelObject(timerState.overdueTimeMs, levels));

  // Overdue grows smoothly between levels; a break takes the screen at once, as the real window does.
  // The box is a container too, so the view's own container units (its padding) size to the box, not the dashboard
  return (
    <div
      data-testid="demo-break-window"
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden shadow-2xl pointer-events-auto [container-type:size]
        ${timerState.status === "OVERDUE" ? "transition-[width,height] duration-500 ease-out" : ""}`}
      style={{ width: size.width, height: size.height }}
    >
      {timerState.status === "OVERDUE" && <OverdueView timerState={timerState} />}
      {timerState.status === "BREAK" && <BreakView timerState={timerState} />}
    </div>
  );
}

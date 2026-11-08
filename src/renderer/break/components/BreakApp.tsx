import { useEffect, useRef, useState } from "react";
import { TimerState } from "@main/timer/timerState";
import { TourUpdate } from "@shared/tour/session";
import BreakView from "./break/BreakView";
import OverdueView from "./overdue/OverdueView";
import TourCard from "@renderer/common/tour/TourCard";
import { useElementRect } from "@renderer/common/tour/useElementRect";

const PULSE_GAP_PX = 6;

export default function BreakApp() {
  const [timerState, setTimerState] = useState<TimerState>();
  const [tour, setTour] = useState<TourUpdate | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // In the tour's overdue beat the palm is the one live button, so it gets the ring
  const palm = useElementRect(tour?.beat.advanceOn === "breaktime" ? "overdue-window-start-break-button" : undefined, root);

  useEffect(() => {
    window.electronAPI.getTimerState().then(setTimerState);
    return window.electronAPI.onTimerUpdate(setTimerState);
  }, []);
  useEffect(() => {
    window.electronAPI.getTour().then(setTour);
    return window.electronAPI.onTourUpdate(setTour);
  }, []);

  return (
    <div ref={root} className="relative h-full">
      {timerState?.status === "OVERDUE" && <OverdueView timerState={timerState} />}
      {timerState?.status === "BREAK" && <BreakView timerState={timerState} />}
      {tour && (
        <div className={`absolute inset-0 pointer-events-none select-none transition-opacity ${tour.fading ? "opacity-0 duration-[5000ms]" : "duration-150"}`}>
          {palm && (
            <span
              data-testid="tour-pulse"
              className="absolute rounded-full border-[3px] border-amber-400 animate-tour-pulse"
              style={{ left: palm.left - PULSE_GAP_PX, top: palm.top - PULSE_GAP_PX, width: palm.width + 2 * PULSE_GAP_PX, height: palm.height + 2 * PULSE_GAP_PX }}
            />
          )}
          {/* The overdue window starts small, so it repeats the dashboard's card, which goes by fast, as one strip in the gap between the buttons and the clock */}
          {tour.beat.demo === "OVERDUE" && (
            <p data-testid="tour-note" className="absolute inset-x-3 top-[62%] rounded-xl bg-white px-4 py-2 text-sm text-slate-700 shadow-2xl">
              {tour.beat.windowBody}
            </p>
          )}
          {/* The break covers the screen, so its card is drawn here, above the title, which leaves the countdown clear */}
          {tour.beat.demo === "BREAK" && <TourCard tour={tour} className="top-4" />}
        </div>
      )}
    </div>
  )
}

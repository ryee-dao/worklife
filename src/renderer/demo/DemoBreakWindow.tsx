import { useEffect, useRef, useState } from "react";
import { TimerState } from "@main/timer/timerState";
import { convertOverdueLevelObjectToScreenSize, convertOverdueTimeToOverdueLevelObject, OverdueLevelObject } from "@main/overdue/overdueGeometry";
import { TourUpdate } from "@shared/tour/session";
import BreakApp from "@renderer/break/components/BreakApp";

interface DemoBreakWindowProps {
  getLevels: () => OverdueLevelObject[]; // Read each time, since the tour and saved overdue settings change them
}

const CLAMP_MS = 200;
const isOpen = (state?: TimerState) => state?.status === "OVERDUE" || state?.status === "BREAK";

// Stands in for the app's second window. In the tour it's a real browser window, where the browser allows one, so its growth and
// its edges can be felt. Otherwise it's drawn over the dashboard, and only the window itself takes clicks, so the tabs still work
export default function DemoBreakWindow({ getLevels }: DemoBreakWindowProps) {
  const [timerState, setTimerState] = useState<TimerState>();
  const [tour, setTour] = useState<TourUpdate | null>(null);
  const [screen, setScreen] = useState({ width: window.innerWidth, height: window.innerHeight });
  const popup = useRef<Window | null>(null);
  const [inPopup, setInPopup] = useState(false);
  const open = isOpen(timerState);
  const inTour = tour !== null;

  useEffect(() => window.electronAPI.onTimerUpdate(setTimerState), []);
  useEffect(() => window.electronAPI.onTourUpdate(setTour), []);
  useEffect(() => {
    const measure = () => setScreen({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // The window's size on whatever it's drawn against: overdue grows a level at a time, a break takes all of it
  const sizeOn = (box: { width: number; height: number }) => {
    if (timerState!.status === "BREAK") return box;
    return convertOverdueLevelObjectToScreenSize(box, convertOverdueTimeToOverdueLevelObject(timerState!.overdueTimeMs, getLevels()));
  };

  // The real window opens as the tour goes overdue, within the click that got it there, and closes when the window would
  useEffect(() => {
    if (!open) {
      popup.current?.close();
      popup.current = null;
      setInPopup(false);
      return;
    }
    if (!inTour || popup.current) return;
    popup.current = window.open("../break/index.html", "worklife-demo", "popup,width=400,height=300");
    setInPopup(popup.current !== null);
  }, [open, inTour]);

  useEffect(() => {
    const win = popup.current;
    if (!win || win.closed || !timerState) return;
    const { width, height } = sizeOn({ width: window.screen.availWidth, height: window.screen.availHeight });
    win.resizeTo(Math.round(width), Math.round(height));
    if (timerState.status === "BREAK") win.moveTo(0, 0);
  }, [timerState]);

  // Dragged off the screen, it's put back, as the app does it. Closed by hand, the page draws it instead
  // shortcut: one screen, from its top-left corner; a second monitor isn't clamped against
  useEffect(() => {
    const interval = setInterval(() => {
      const win = popup.current;
      if (!win) return;
      if (win.closed) {
        popup.current = null;
        setInPopup(false);
        return;
      }
      const x = Math.max(0, Math.min(win.screenX, window.screen.availWidth - win.outerWidth));
      const y = Math.max(0, Math.min(win.screenY, window.screen.availHeight - win.outerHeight));
      if (x !== win.screenX || y !== win.screenY) win.moveTo(x, y);
    }, CLAMP_MS);
    return () => clearInterval(interval);
  }, []);

  if (!open || inPopup) return null;
  const box = sizeOn(screen);

  // Above the tour's dim layer, as the real window is above everything. The box is a container, so the view sizes to it
  return (
    <div data-testid="demo-break-host" className="fixed inset-0 z-[60] pointer-events-none">
      <div
        data-testid="demo-break-window"
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden shadow-2xl pointer-events-auto [container-type:size]
          ${timerState!.status === "OVERDUE" ? "transition-[width,height] duration-500 ease-out" : ""}`}
        style={{ width: box.width, height: box.height }}
      >
        <BreakApp />
      </div>
    </div>
  );
}

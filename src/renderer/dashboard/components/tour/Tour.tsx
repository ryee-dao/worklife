import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { TourUpdate } from "@shared/tour/session";
import { useElementRect } from "@renderer/common/tour/useElementRect";
import TourCard from "@renderer/common/tour/TourCard";
import { placeCard } from "./placeCard";

const CARD_BAND_PX = 140; // Room kept for the card until it's measured

// The tour over the dashboard: a card and a spotlight over the real tabs. Everything behind it is blocked, and the one live
// control is the real button a beat names, reached through the ring drawn over it. The break window shows its own part
export default function Tour({ tour }: { tour: TourUpdate }) {
  const { beat } = tour;
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const target = useElementRect(beat.target, root);
  const start = useElementRect(beat.advanceOn === "start" ? "toggle-timer-button" : undefined, root);
  const card = useElementRect("tour-card", root);

  useEffect(() => {
    const measure = () => {
      if (root.current) setScreen({ width: root.current.clientWidth, height: root.current.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Only when the beat changes: navigate itself changes on every route change, and that must not pull the user back
  useEffect(() => {
    navigate(beat.route);
  }, [beat.route]);

  const placement = placeCard(target, screen.height, card?.height ?? CARD_BAND_PX);

  const dimsWholeTab = (beat.demo || beat.target) && !target;

  return (
    <div
      ref={root}
      data-testid="tour"
      data-fading={tour.fading}
      className={`fixed inset-0 z-50 select-none pointer-events-none transition-opacity ${tour.fading ? "opacity-0 duration-[5000ms]" : "duration-150"}`}
    >
      {/* The spotlight dims the tab around its target. Without one on screen (a demo beat, or a replay mid-break) the whole tab is dimmed */}
      {dimsWholeTab && (
        <div className={`absolute inset-0 pointer-events-auto ${beat.demo ? "bg-slate-900/85" : "bg-slate-900/60"}`} />
      )}
      {beat.target && (
        <div
          data-testid="tour-spotlight"
          className={`absolute ring-4 ring-amber-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.58)] transition-all duration-300 pointer-events-none ${target ? "" : "hidden"}`}
          style={target ? { left: target.left, top: target.top, width: target.width, height: target.height, borderRadius: target.radius } : undefined}
        />
      )}

      {start && (
        <button
          data-testid="tour-advance"
          title="Start"
          onClick={() => window.electronAPI.start()}
          className="absolute z-20 rounded-full pointer-events-auto cursor-pointer"
          style={{ left: start.left, top: start.top, width: start.width, height: start.height }}
        >
          <span data-testid="tour-pulse" className="absolute -inset-1.5 rounded-full border-[3px] border-amber-400 animate-tour-pulse" />
        </button>
      )}

      {/* The break covers the screen, so its card is drawn in the break window */}
      {beat.demo !== "BREAK" && <TourCard tour={tour} className={placement === "top" ? "top-4" : "bottom-4"} />}
    </div>
  );
}
